import db from "../db/database.js";

/**
 * Create album and optionally its songs
 * @param {object} param0
 * @param {string} param0.title
 * @param {string} param0.artist
 * @param {string} param0.releaseDate
 * @param {Array} param0.songs [{ title, num, value }]
 */
export function createAlbum({ title, artist, releaseDate, songs = [], cover_art, userId }) {
  const tx = db.transaction(() => {
    // 1. Insert or get artist
    let artistEntry = db.prepare("SELECT * FROM artists WHERE name = ?").get(artist);
    if (!artistEntry) {
      const result = db.prepare("INSERT INTO artists (name) VALUES (?)").run(artist);
      artistEntry = { id: result.lastInsertRowid, name: artist };
    }

    // 2. Insert album
    const albumResult = db.prepare(
      "INSERT INTO albums (title, artist_id, release_date, cover_art, user_id) VALUES (?, ?, ?, ?, ?)"
    ).run(title, artistEntry.id, releaseDate, cover_art, userId);
    const albumId = albumResult.lastInsertRowid;

    // 3. Insert songs and collect song objects
    const insertSong = db.prepare(
      "INSERT INTO songs (album_id, track_number, title) VALUES (?, ?, ?)"
    );
    const songObjects = [];
    for (const [i, song] of songs.entries()) {
      const songResult = insertSong.run(albumId, song.track_number ?? i + 1, song.title);
      songObjects.push({ ...song, id: songResult.lastInsertRowid, num: song.track_number ?? i + 1 });
    }

    // 4. Return album object synchronously
    return {
      id: albumId,
      title,
      artist: artistEntry.name,
      artistId: artistEntry.id,
      releaseDate,
      cover_art,
      songs: songObjects
    };
  });

  return tx();
}

/**
 * Get all albums (regardless of user) with calculated ratings
 */
export function getAllAlbums(userId) {
  return db.prepare(`
    SELECT
      a.*,
      ar2.id AS artistId,
      ar2.name AS artist,
      COALESCE(AVG(ar.rating), 0) AS rating,
      COUNT(ar.user_id) AS ratingCount
    FROM albums a
    JOIN artists ar2 ON ar2.id = a.artist_id
    LEFT JOIN album_ratings ar ON ar.album_id = a.id
    ${userId ? "WHERE a.user_id = ?" : ""}
    GROUP BY a.id
    ORDER BY rating DESC
  `).all(userId ? userId : undefined);
}

/**
 * Get one album by ID (with songs)
 */
export async function getAlbumById(id) {
  const album = db.prepare(`
    SELECT
      a.id,
      a.title,
      a.release_date AS releaseDate,
      a.user_id AS userId,
      ar.id AS artistId,
      ar.name AS artist
    FROM albums a
    JOIN artists ar ON ar.id = a.artist_id
    WHERE a.id = ?
  `).get(id);

  if (!album) return null;

  // selects all songs with album id, orders by track number
  const songs = db.prepare(`
    SELECT 
      s.id, 
      s.track_number AS num,
      s.title,
      COALESCE(sr.rating, 0) AS rating
    FROM songs s
    LEFT JOIN song_ratings sr ON sr.song_id = s.id
    WHERE s.album_id = ?
    ORDER BY s.track_number
  `).all(id);

  // Only count non-NULL ratings for stats
  const stats = db.prepare(`
    SELECT
      COUNT(sr.rating) AS numRatedSongs,       -- excludes NULL, includes 0
      SUM(CASE WHEN sr.rating = 2 THEN 1 ELSE 0 END) AS greatSongs,
      SUM(CASE WHEN sr.rating = 1 THEN 1 ELSE 0 END) AS goodSongs,
      SUM(COALESCE(sr.rating, 0)) AS totalValue
    FROM songs s
    LEFT JOIN song_ratings sr ON sr.song_id = s.id
    WHERE s.album_id = ?
  `).get(id);

  const albumRating = db.prepare(`
  SELECT
    COUNT(*) AS ratingCount,
    AVG(rating) AS avgScore
  FROM album_ratings
  WHERE album_id = ?
`).get(id);

  return {
    ...album,
    avgScore: albumRating?.avgScore ?? 0,
    ratingCount: albumRating?.ratingCount ?? 0,
    songs
  };
}

/**
 * update album metadata
 * @param {*} id album id
 * @param {*} data data fields (title, release datem artist)
 * @returns updated album
 */
export function updateAlbum(id, data) {
  const fields = [];
  const values = [];

  if (data.title) {
    fields.push("title = ?");
    values.push(data.title);
  }
  if (data.releaseDate) {
    fields.push("release_date = ?");
    values.push(data.releaseDate);
  }
  if (data.artist) {
    // Update artist name
    const artist = db.prepare("SELECT * FROM artists WHERE name = ?").get(data.artist);
    let artistId;
    if (!artist) {
      const result = db.prepare("INSERT INTO artists (name) VALUES (?)").run(data.artist);
      artistId = result.lastInsertRowid;
    } else artistId = artist.id;
    fields.push("artist_id = ?");
    values.push(artistId);
  }

  if (!fields.length) return null;

  const result = db
    .prepare(`UPDATE albums SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values, id);

  return result.changes ? getAlbumById(id) : null;
}

/**
 * Delete album (songs automatically deleted via FK cascade)
 * @param {*} id album id
 */
export function deleteAlbum(id) {
  // now delete album
  db.prepare("DELETE FROM albums WHERE id = ?").run(id);
}

export function getArtistId(albumId) {
  const row = db.prepare("SELECT artist_id FROM albums WHERE id = ?")
    .get(albumId);

  return row ? row.artist_id : null;
}

///////////////////////////////////////////////
/// PUBLIC ROUTES
///////////////////////////////////////////////


// Returns array of all albums with average score and rating count
export function getAllAlbumsWithAggregates() {
  const query = db.prepare(`
    SELECT
      artist_id,
      title,
      COUNT(*) AS ratingCount,
      AVG(score) AS avgScore
    FROM albums
    GROUP BY artist_id, title
    ORDER BY avgScore DESC
  `);

  return query.all();
}

export function getAlbumDetailsPublic(albumId) {
  // Album info
  const albumStmt = db.prepare(`
    SELECT
      a.id,
      a.title,
      a.release_date AS releaseDate,
      a.cover_art AS coverArt,
      ar.id AS artistId,
      ar.name AS artist
    FROM albums a
    JOIN artists ar ON a.artist_id = ar.id
    WHERE a.id = ?
  `);
  const album = albumStmt.get(albumId);
  if (!album) return null;

  const albumScore = db.prepare(`
  SELECT
    COUNT(*) AS ratingCount,
    ROUND(AVG(rating), 2) AS avgScore
  FROM album_ratings
  WHERE album_id = ?
`).get(albumId);

  // Track-level stats including skip % calculation
  const tracksStmt = db.prepare(`
    SELECT
      s.id,
      s.track_number AS num,
      s.title,
      COALESCE(ROUND(AVG(sr.rating), 2), 0) AS avgScore,
      COUNT(sr.rating) AS totalRatings,
      SUM(CASE WHEN sr.rating = 0 THEN 1 ELSE 0 END) AS skipCount
    FROM songs s
    LEFT JOIN song_ratings sr ON sr.song_id = s.id
    WHERE s.album_id = ?
    GROUP BY s.id
    ORDER BY s.track_number ASC
  `);
  const tracksRaw = tracksStmt.all(albumId);

  // Map to include skip % as "not skipped %"
  const tracks = tracksRaw.map(t => {
    const total = t.totalRatings || 0;
    const notSkippedPercent = total > 0 ? Math.round(((total - t.skipCount) / total) * 100) : 0;
    return {
      ...t,
      notSkippedPercent,
      ratings: [] // optional: for frontend per-user breakdown if you want
    };
  });

  return {
    ...album,
    avgScore: albumScore?.avgScore ?? 0,
    ratingCount: albumScore?.ratingCount ?? 0,
    tracks
  };
}

/**
 * Get all albums rated by a user
 * @param {*} userId 
 * @returns all albums rated by a user
 */
export function getAlbumsByUser(userId) {
  return db.prepare(`
     SELECT a.*, ar.id AS artistId, ar.name AS artist
    FROM albums a
    JOIN artists ar ON a.artist_id = ar.id
    WHERE a.user_id = ?
    ORDER BY a.created_at DESC
  `).all(userId);
}

export function getAllAlbumsPublic() {
  return db.prepare(`
    SELECT
      a.id,
      a.title,
      a.release_date AS releaseDate,
      a.cover_art AS coverArt,
      ar.id AS artistId,
      ar.name AS artist,
      COUNT(alr.user_id) AS ratingCount,
      ROUND(AVG(alr.rating), 2) AS avgScore
    FROM albums a
    JOIN artists ar ON ar.id = a.artist_id
    LEFT JOIN album_ratings alr ON alr.album_id = a.id
    GROUP BY a.id
    ORDER BY a.title
  `).all();
}

// Update album title
export function updateAlbumTitle(albumId, title) {
  const result = db
    .prepare(`UPDATE albums SET title = ? WHERE id = ?`)
    .run(title, albumId);

  return result.changes > 0;
}

// Update album artist (find or create artist)
export function updateAlbumArtist(albumId, artistName) {
  // find or create artist
  let artist = db
    .prepare(`SELECT id FROM artists WHERE name = ?`)
    .get(artistName);

  if (!artist) {
    const info = db
      .prepare(`INSERT INTO artists (name) VALUES (?)`)
      .run(artistName);
    artist = { id: info.lastInsertRowid };
  }

  const result = db
    .prepare(`UPDATE albums SET artist_id = ? WHERE id = ?`)
    .run(artist.id, albumId);

  return result.changes > 0;
}

// Update album cover
export function updateAlbumCover(albumId, coverArt) {
  const result = db
    .prepare(`
      UPDATE albums
      SET cover_art = ?
      WHERE id = ?
    `)
    .run(coverArt, albumId);

  if (!coverArt || !/^https?:\/\//.test(coverArt)) return false;

  return result.changes > 0;
}

/**
 * Get all albums for a specific user, optionally including the viewer's ratings
 */
export function getUserRatedAlbums(userId) {
  return db.prepare(`
    SELECT
      a.id,
      a.title,
      a.release_date AS releaseDate,
      a.cover_art AS coverArt,
      ar.id AS artistId,
      ar.name AS artist,
      alr.rating,
      alr.non_skips,
      alr.rated_songs
    FROM album_ratings alr
    JOIN albums a ON a.id = alr.album_id
    JOIN artists ar ON ar.id = a.artist_id
    WHERE alr.user_id = ?
    ORDER BY alr.rating DESC
  `).all(userId).map(a => ({
    ...a,
    rate: `${a.non_skips}/${a.rated_songs}`
  }));
}

/**
 * Get a single album for a specific user, optionally including viewer ratings
 */
export function getAlbumDetailsPrivate(albumId, userId) {
  const album = db.prepare(`
  SELECT
    a.id,
    a.title,
    a.release_date AS releaseDate,
    a.cover_art AS coverArt,
    ar.id AS artistId,
    ar.name AS artist,
    alr.rating AS userRating,
    alr.rated_songs
  FROM albums a
  JOIN artists ar ON a.artist_id = ar.id
  LEFT JOIN album_ratings alr
    ON alr.album_id = a.id
   AND alr.user_id = ?
  WHERE a.id = ?
`).get(userId, albumId);

  if (!album) return null;

  const tracksStmt = db.prepare(`
    SELECT s.id, s.track_number AS num, s.title,
           ROUND(AVG(sr.rating), 2) AS avgScore,
           ur.rating AS rating
    FROM songs s
    LEFT JOIN song_ratings sr ON sr.song_id = s.id
    LEFT JOIN song_ratings ur ON ur.song_id = s.id AND ur.user_id = ?
    WHERE s.album_id = ?
    GROUP BY s.id
    ORDER BY s.track_number ASC
  `);

  album.tracks = tracksStmt.all(userId, albumId);

  return album;
}

export function getUserAlbumScores(userId, power = 0.6) {
  // 1. Get all album ratings for this user
  const albums = db.prepare(`
    SELECT
      ar.album_id,
      ar.rating
    FROM album_ratings ar
    WHERE ar.user_id = ?
    ORDER BY ar.rating ASC
  `).all(userId);

  const n = albums.length;
  if (n === 0) return [];

  // 2. Assign percentiles + power adjustment
  return albums.map((album, index) => {
    const percentile =
      n === 1 ? 1 : index / (n - 1); // avoid divide-by-zero

    const adjusted = Math.pow(percentile, power);

    const score10 = Math.round(adjusted * 9 + 1); // maps to [1,10]

    return {
      albumId: album.album_id,
      rawRating: album.rating,
      percentile,
      score10
    };
  });
}

export function getUserAlbumScoreSingle(userId, albumId, power = 0.6) {
  // Get this album’s raw rating
  const target = db.prepare(`
    SELECT rating
    FROM album_ratings
    WHERE user_id = ? AND album_id = ?
  `).get(userId, albumId);

  if (!target) return null;

  // Count how many albums are below / equal to this rating
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN rating <= ? THEN 1 ELSE 0 END) - 1 AS below
    FROM album_ratings
    WHERE user_id = ?
  `).get(target.rating, userId);

  if (stats.total <= 1) {
    return {
      rawRating: target.rating,
      percentile: 1,
      score10: 10
    };
  }

  const percentile = stats.below / (stats.total - 1);
  const adjusted = Math.pow(percentile, power);
  const score10 = Math.round(adjusted * 9 + 1);

  return {
    rawRating: target.rating,
    percentile,
    score10
  };
}