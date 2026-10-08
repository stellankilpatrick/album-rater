import pool from "../db/database.js";
import { searchAlbums, getAlbumWithTracks } from "../spotify/spotify.client.js";

// Importing from Spotify only ever INSERTs new albums, album_artists links, songs
// and (when no match exists) artists. Existing rows are read for matching but
// never updated or deleted.

/**
 * The app separates multiple artists with " & ", so an "&" inside a single
 * artist's name (Simon & Garfunkel) is stored as "and" (Simon and Garfunkel).
 */
export function normalizeArtistName(name) {
  return name.replace(/\s*&\s*/g, " and ").replace(/\s+/g, " ").trim();
}

/**
 * Spotify only has album / single / compilation; EPs are reported as singles,
 * so a "single" with 4+ tracks is treated as an EP.
 */
export function mapAlbumType(spotifyAlbum) {
  if (spotifyAlbum.album_type === "compilation") return "compilation";
  if (spotifyAlbum.album_type === "single") return spotifyAlbum.total_tracks >= 4 ? "ep" : "single";
  return "album";
}

/**
 * Spotify dates can be "1999", "1999-06" or "1999-06-15"; the DATE column needs a full date.
 */
export function toReleaseDate(releaseDate, precision) {
  if (!releaseDate) return null;
  if (precision === "year") return `${releaseDate}-01-01`;
  if (precision === "month") return `${releaseDate}-01`;
  return releaseDate;
}

/**
 * Turn a Spotify album into the fields this app stores.
 * Expects the album's full tracklist in spotifyAlbum.tracks (an array).
 */
export function toAlbumData(spotifyAlbum) {
  const type = mapAlbumType(spotifyAlbum);
  const albumArtistIds = new Set(spotifyAlbum.artists.map(a => a.id));

  // Spotify restarts track numbers on each disc; number 1..N across the whole album
  const sortedTracks = [...(spotifyAlbum.tracks || [])].sort(
    (a, b) => a.disc_number - b.disc_number || a.track_number - b.track_number
  );

  return {
    spotifyId: spotifyAlbum.id,
    title: spotifyAlbum.name,
    artistNames: [...new Set(spotifyAlbum.artists.map(a => normalizeArtistName(a.name)))],
    releaseDate: toReleaseDate(spotifyAlbum.release_date, spotifyAlbum.release_date_precision),
    coverArt: spotifyAlbum.images?.[0]?.url ?? null,
    type,
    // Matches the add-album form, which defaults albums and EPs to official
    official: ["album", "ep"].includes(type),
    songs: sortedTracks.map((track, i) => {
      const featured = track.artists.filter(a => !albumArtistIds.has(a.id)).map(a => a.name);
      return { num: i + 1, title: track.name, featured: featured.length ? featured.join(", ") : null };
    }),
  };
}

/**
 * Comparison key that ignores case, accents and punctuation, so Spotify's
 * "JAŸ-Z" matches a hand-typed "Jay-Z" and "Beyoncé" matches "Beyonce".
 */
export function matchKey(text) {
  const key = text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return key || text.toLowerCase();
}

// Edition labels Spotify adds to titles: "(Deluxe)", "[Remastered 2011]", "(Explicit Version)",
// "- 20th Anniversary Edition". "(Live)" and "(Taylor's Version)" are deliberately not stripped;
// those are different albums.
const EDITION_SUFFIX = /\s*(?:[([][^)\]]*\b(?:deluxe|edition|remaster(?:ed)?|expanded|anniversary|bonus|explicit|edited|clean)\b[^)\]]*[)\]]|-\s+[^-]*\b(?:deluxe|edition|remaster(?:ed)?|expanded|anniversary)\b[^-]*)\s*$/i;

/**
 * Comparison key for album titles: matchKey without edition labels, so
 * "Watch The Throne (Deluxe)" matches "Watch the Throne".
 */
export function titleKey(title) {
  let base = title;
  for (let prev = null; prev !== base;) {
    prev = base;
    base = base.replace(EDITION_SUFFIX, "");
  }
  return matchKey(base || title);
}

/**
 * Map of matchKey(name) -> artist id for every artist on the site
 * (oldest artist wins if two names share a key).
 */
export async function loadArtistIndex(db) {
  const { rows } = await db.query(`SELECT id, name FROM artists ORDER BY id`);
  const index = new Map();
  for (const { id, name } of rows) {
    const key = matchKey(name);
    if (!index.has(key)) index.set(key, id);
  }
  return index;
}

/**
 * Find an album already on the site: first by Spotify id, then by an album of
 * one of the same artists whose title matches (ignoring case, accents,
 * punctuation and edition labels).
 */
export async function findExistingAlbumId(db, data, artistIndex) {
  if (data.spotifyId) {
    const bySpotifyId = await db.query(`SELECT id FROM albums WHERE spotify_id = $1 LIMIT 1`, [data.spotifyId]);
    if (bySpotifyId.rows.length > 0) return bySpotifyId.rows[0].id;
  }

  const artistIds = data.artistNames.map(n => artistIndex.get(matchKey(n))).filter(Boolean);
  if (artistIds.length === 0) return null;

  const { rows } = await db.query(
    `SELECT DISTINCT a.id, a.title FROM albums a
     JOIN album_artists aa ON aa.album_id = a.id
     WHERE aa.artist_id = ANY($1::int[])
     ORDER BY a.id`,
    [artistIds]
  );
  const wanted = titleKey(data.title);
  return rows.find(r => titleKey(r.title) === wanted)?.id ?? null;
}

/**
 * Reuse an existing artist (see matchKey), otherwise create one.
 */
async function findOrCreateArtistId(client, name, artistIndex) {
  const existingId = artistIndex.get(matchKey(name));
  if (existingId) return existingId;

  const inserted = await client.query(
    `INSERT INTO artists (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id`,
    [name]
  );
  // No row back means a concurrent request created it between loading the index and now
  const id = inserted.rows[0]?.id
    ?? (await client.query(`SELECT id FROM artists WHERE name = $1`, [name])).rows[0].id;
  artistIndex.set(matchKey(name), id);
  return id;
}

/**
 * Add a Spotify album to the site unless it's already here.
 * @returns {{ albumId: number, created: boolean }}
 */
export async function importSpotifyAlbum(spotifyAlbum) {
  const data = toAlbumData(spotifyAlbum);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const artistIndex = await loadArtistIndex(client);
    const existingId = await findExistingAlbumId(client, data, artistIndex);
    if (existingId) {
      await client.query("ROLLBACK");
      return { albumId: existingId, created: false };
    }

    const artistIds = [];
    for (const name of data.artistNames) {
      const id = await findOrCreateArtistId(client, name, artistIndex);
      if (!artistIds.includes(id)) artistIds.push(id);
    }

    const albumRes = await client.query(
      `INSERT INTO albums (title, release_date, cover_art, type, official, spotify_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [data.title, data.releaseDate, data.coverArt, data.type, data.official, data.spotifyId]
    );
    const albumId = albumRes.rows[0].id;

    for (const artistId of artistIds) {
      await client.query(
        `INSERT INTO album_artists (album_id, artist_id) VALUES ($1, $2)`,
        [albumId, artistId]
      );
    }

    for (const song of data.songs) {
      await client.query(
        `INSERT INTO songs (album_id, track_number, title, featured) VALUES ($1, $2, $3, $4)`,
        [albumId, song.num, song.title, song.featured]
      );
    }

    await client.query("COMMIT");
    return { albumId, created: true };
  } catch (err) {
    await client.query("ROLLBACK");
    // Same album imported by a concurrent request (unique index on spotify_id)
    if (err.code === "23505" && err.constraint === "albums_spotify_id_key") {
      const albumId = await findExistingAlbumId(pool, data, await loadArtistIndex(pool));
      return { albumId, created: false };
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * For the add-album form: find the album someone typed in, on the site or on
 * Spotify (importing it), so they're sent to it instead of creating a duplicate.
 * `artist` uses the form's " & " separator. Returns the album id, or null.
 * Spotify problems (not configured, rate limited, down) count as no match.
 */
export async function findOrImportTypedAlbum(title, artist) {
  const artistNames = artist.split(" & ").map(a => a.trim()).filter(Boolean);
  // Also try the whole text as one name, so "Mumford & Sons" isn't only read as "Mumford" and "Sons"
  if (artistNames.length > 1) artistNames.push(artist.trim());
  const typed = { title, artistNames };

  const onSite = await findExistingAlbumId(pool, typed, await loadArtistIndex(pool));
  if (onSite) return onSite;

  let results;
  try {
    results = await searchAlbums(`album:${title} artist:${artistNames[0]}`);
  } catch (err) {
    console.error("Spotify lookup for typed album skipped:", err.message);
    return null;
  }

  const wantedTitle = titleKey(title);
  const wantedArtists = new Set(artistNames.map(matchKey));
  const match = results.find(item =>
    titleKey(item.name) === wantedTitle &&
    item.artists.some(a => wantedArtists.has(matchKey(normalizeArtistName(a.name))))
  );
  if (!match) return null;

  try {
    const { albumId } = await importSpotifyAlbum(await getAlbumWithTracks(match.id));
    return albumId;
  } catch (err) {
    console.error("Spotify import for typed album failed:", err.message);
    return null;
  }
}
