import api from "./api";

// Albums from Spotify that can be opened on the site; each has existingAlbumId
// when it's already here. Returns [] if Spotify isn't available, so callers can
// keep showing site results.
export async function searchSpotifyAlbums(query) {
  try {
    const res = await api.get("/spotify/search", { params: { q: query } });
    return res.data.albums;
  } catch {
    return [];
  }
}

// Site album id for a Spotify search result, importing the album first if needed
export async function openSpotifyAlbum(spotifyAlbum) {
  if (spotifyAlbum.existingAlbumId) return spotifyAlbum.existingAlbumId;
  const res = await api.post(`/spotify/import/${spotifyAlbum.spotifyId}`);
  return res.data.albumId;
}
