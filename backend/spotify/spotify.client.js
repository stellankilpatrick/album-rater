// Thin wrapper around the Spotify Web API using the Client Credentials flow
// (app-only token: no Spotify login for users). Needs SPOTIFY_CLIENT_ID and
// SPOTIFY_CLIENT_SECRET; without them every call throws SpotifyNotConfiguredError.

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_URL = "https://api.spotify.com/v1";

export class SpotifyNotConfiguredError extends Error {}

export class SpotifyApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function isSpotifyConfigured() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

// Tokens last an hour; reuse one until shortly before it expires
let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken() {
  if (!isSpotifyConfigured()) throw new SpotifyNotConfiguredError("Spotify is not configured");
  if (cachedToken && Date.now() < cachedTokenExpiresAt) return cachedToken;

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new SpotifyApiError(res.status, `Spotify token request failed (${res.status})`);

  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function spotifyGet(pathOrUrl) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_URL}${pathOrUrl}`;
  let res = await fetch(url, { headers: { Authorization: `Bearer ${await getAccessToken()}` } });

  // Token revoked or expired early: fetch a fresh one and retry once
  if (res.status === 401) {
    cachedToken = null;
    res = await fetch(url, { headers: { Authorization: `Bearer ${await getAccessToken()}` } });
  }
  if (!res.ok) throw new SpotifyApiError(res.status, `Spotify request failed (${res.status})`);
  return res.json();
}

// Spotify caps search `limit` at 10 for development-mode apps
export const SEARCH_PAGE_SIZE = 10;

/**
 * Search albums, one page of up to SEARCH_PAGE_SIZE results.
 */
export async function searchAlbums(query, offset = 0) {
  const params = new URLSearchParams({ q: query, type: "album", limit: String(SEARCH_PAGE_SIZE), offset: String(offset) });
  const data = await spotifyGet(`/search?${params}`);
  return data.albums.items.filter(Boolean);
}

/**
 * Get an album with its full tracklist (follows pagination for albums over 50 tracks).
 */
export async function getAlbumWithTracks(spotifyId) {
  const album = await spotifyGet(`/albums/${encodeURIComponent(spotifyId)}`);
  const tracks = [...album.tracks.items];
  let next = album.tracks.next;
  while (next) {
    const page = await spotifyGet(next);
    tracks.push(...page.items);
    next = page.next;
  }
  return { ...album, tracks: tracks };
}
