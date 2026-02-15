import pool from "../db/database.js";

/**
 * Create album and optionally its songs
 */
export async function createAlbum({ title, artist, releaseDate, songs = [], cover_art, userId }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Insert or get artist
    let artistRes = await client.query("SELECT * FROM artists WHERE name = $1", [artist]);
    let artistId;
    if (artistRes.rows.length) {
      artistId = artistRes.rows[0].id;
    } else {
      const insertArtist = await client.query(
        "INSERT INTO artists (name) VALUES ($1) RETURNING id",
        [artist]
      );
      artistId = insertArtist.rows[0].id;
    }

    // 2. Insert album
    const albumRes = await client.query(
      `INSERT INTO albums (title, artist_id, release_date, cover_art, user_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [title, artistId, releaseDate, cover_art, userId]
    );
    const albumId = albumRes.rows[0].id;

    // 3. Insert songs
    const songObjects = [];
    for (const [i, song] of songs.entries()) {
      const trackNumber = song.track_number ?? i + 1;
      const songRes = await client.query(
        `INSERT INTO songs (album_id, track_number, title)
         VALUES ($1, $2, $3) RETURNING id`,
        [albumId, trackNumber, song.title]
      );
      songObjects.push({ ...song, id: songRes.rows[0].id, num: trackNumber });
    }

    await client.query("COMMIT");

    return {
      id: albumId,
      title,
      artist,
      artistId,
      releaseDate,
      cover_art,
      songs: songObjects
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getAllAlbumsPublic() {
  const { rows } = await pool.query(`
    SELECT 
      a.id,
      a.title,
      a.release_date AS "releaseDate",
      a.cover_art AS "coverArt",
      ar.id AS "artistId",
      ar.name AS artist,
      COUNT(alr.user_id) AS "ratingCount",
      ROUND(AVG(alr.rating)::numeric, 2) AS "avgScore"
    FROM albums a
    JOIN artists ar ON ar.id = a.artist_id
    LEFT JOIN album_ratings alr ON alr.album_id = a.id
    GROUP BY a.id, ar.id
    ORDER BY a.title
  `);
  return rows;
}

/**
 * Get all albums (with optional user filter)
 */
export async function getAllAlbums(userId) {
  const res = await pool.query(
    `
      SELECT
        a.*,
        ar.id AS "artistId",
        ar.name AS artist,
        COALESCE(AVG(alr.rating),0) AS rating,
        COUNT(alr.user_id) AS "ratingCount"
      FROM albums a
      JOIN artists ar ON ar.id = a.artist_id
      LEFT JOIN album_ratings alr ON alr.album_id = a.id
      ${userId ? "WHERE a.user_id = $1" : ""}
      GROUP BY a.id, ar.id
      ORDER BY rating DESC
    `,
    userId ? [userId] : []
  );

  return res.rows;
}

/**
 * Get one album by ID (with songs and ratings)
 */
export async function getAlbumById(id) {
  const albumRes = await pool.query(
    `
    SELECT
      a.id, a.title, a.release_date AS "releaseDate",
      a.user_id AS "userId",
      ar.id AS "artistId", ar.name AS artist
    FROM albums a
    JOIN artists ar ON ar.id = a.artist_id
    WHERE a.id = $1
    `,
    [id]
  );
  const album = albumRes.rows[0];
  if (!album) return null;

  const songsRes = await pool.query(
    `
    SELECT
      s.id, s.track_number AS num, s.title,
      COALESCE(sr.rating,0) AS rating
    FROM songs s
    LEFT JOIN song_ratings sr ON sr.song_id = s.id
    WHERE s.album_id = $1
    ORDER BY s.track_number
    `,
    [id]
  );

  const albumRatingRes = await pool.query(
    `
    SELECT COUNT(*) AS "ratingCount", AVG(rating) AS "avgScore"
    FROM album_ratings
    WHERE album_id = $1
    `,
    [id]
  );

  return {
    ...album,
    songs: songsRes.rows,
    avgScore: parseFloat(albumRatingRes.rows[0].avgScore) || 0,
    ratingCount: parseInt(albumRatingRes.rows[0].ratingCount) || 0
  };
}

/**
 * Update album metadata
 */
export async function updateAlbum(id, data) {
  const fields = [];
  const values = [];
  let i = 1;

  if (data.title) {
    fields.push(`title = $${i++}`);
    values.push(data.title);
  }
  if (data.releaseDate) {
    fields.push(`release_date = $${i++}`);
    values.push(data.releaseDate);
  }
  if (data.artist) {
    // find or create artist
    const artistRes = await pool.query("SELECT id FROM artists WHERE name = $1", [data.artist]);
    let artistId;
    if (artistRes.rows.length) {
      artistId = artistRes.rows[0].id;
    } else {
      const insertArtist = await pool.query(
        "INSERT INTO artists (name) VALUES ($1) RETURNING id",
        [data.artist]
      );
      artistId = insertArtist.rows[0].id;
    }
    fields.push(`artist_id = $${i++}`);
    values.push(artistId);
  }

  if (!fields.length) return null;

  values.push(id);
  const res = await pool.query(
    `UPDATE albums SET ${fields.join(", ")} WHERE id = $${i} RETURNING id`,
    values
  );

  return res.rows.length ? getAlbumById(id) : null;
}

/**
 * Delete album
 */
export async function deleteAlbum(id) {
  await pool.query("DELETE FROM albums WHERE id = $1", [id]);
}

/**
 * Get artist ID for a given album
 */
export async function getArtistId(albumId) {
  const res = await pool.query(
    `SELECT artist_id FROM albums WHERE id = $1`,
    [albumId]
  );
  return res.rows[0]?.artist_id ?? null;
}

/**
 * Get all albums with aggregates (average score and rating count)
 */
export async function getAllAlbumsWithAggregates() {
  const res = await pool.query(
    `
    SELECT
      artist_id,
      title,
      COUNT(*) AS "ratingCount",
      AVG(score) AS "avgScore"
    FROM albums
    GROUP BY artist_id, title
    ORDER BY "avgScore" DESC
    `
  );
  return res.rows;
}

/**
 * Get public album details (with track stats)
 */
export async function getAlbumDetailsPublic(albumId) {
  // Album info
  const albumRes = await pool.query(
    `
    SELECT
      a.id, a.title, a.release_date AS "releaseDate", a.cover_art AS "coverArt",
      ar.id AS "artistId", ar.name AS artist
    FROM albums a
    JOIN artists ar ON a.artist_id = ar.id
    WHERE a.id = $1
    `,
    [albumId]
  );
  const album = albumRes.rows[0];
  if (!album) return null;

  const albumScoreRes = await pool.query(
    `
    SELECT COUNT(*) AS "ratingCount", ROUND(AVG(rating)::numeric,2) AS "avgScore"
    FROM album_ratings
    WHERE album_id = $1
    `,
    [albumId]
  );

  const tracksRes = await pool.query(
    `
    SELECT
      s.id, s.track_number AS num, s.title,
      COALESCE(ROUND(AVG(sr.rating)::numeric,2),0) AS "avgScore",
      COUNT(sr.rating) AS "totalRatings",
      SUM(CASE WHEN sr.rating = 0 THEN 1 ELSE 0 END) AS "skipCount"
    FROM songs s
    LEFT JOIN song_ratings sr ON sr.song_id = s.id
    WHERE s.album_id = $1
    GROUP BY s.id
    ORDER BY s.track_number ASC
    `,
    [albumId]
  );

  const tracks = tracksRes.rows.map(t => {
    const total = parseInt(t.totalRatings) || 0;
    const notSkippedPercent = total > 0 ? Math.round(((total - t.skipCount) / total) * 100) : 0;
    return { ...t, notSkippedPercent, ratings: [] };
  });

  return {
    ...album,
    avgScore: parseFloat(albumScoreRes.rows[0].avgScore) || 0,
    ratingCount: parseInt(albumScoreRes.rows[0].ratingCount) || 0,
    tracks
  };
}

/**
 * Get all albums rated by a user
 */
export async function getAlbumsByUser(userId) {
  const res = await pool.query(
    `
    SELECT a.*, ar.id AS "artistId", ar.name AS artist
    FROM albums a
    JOIN artists ar ON a.artist_id = ar.id
    WHERE a.user_id = $1
    ORDER BY a.created_at DESC
    `,
    [userId]
  );
  return res.rows;
}
/**
 * Update album title
 */
export async function updateAlbumTitle(albumId, title) {
  const res = await pool.query(
    `UPDATE albums SET title = $1 WHERE id = $2`,
    [title, albumId]
  );
  return res.rowCount > 0;
}

/**
 * Update album artist
 */
export async function updateAlbumArtist(albumId, artistName) {
  let artistRes = await pool.query("SELECT id FROM artists WHERE name = $1", [artistName]);
  let artistId;
  if (artistRes.rows.length) {
    artistId = artistRes.rows[0].id;
  } else {
    const insertArtist = await pool.query(
      "INSERT INTO artists (name) VALUES ($1) RETURNING id",
      [artistName]
    );
    artistId = insertArtist.rows[0].id;
  }

  const res = await pool.query(
    `UPDATE albums SET artist_id = $1 WHERE id = $2`,
    [artistId, albumId]
  );
  return res.rowCount > 0;
}

/**
 * Update album cover
 */
export async function updateAlbumCover(albumId, coverArt) {
  if (!coverArt || !/^https?:\/\//.test(coverArt)) return false;

  const res = await pool.query(
    `UPDATE albums SET cover_art = $1 WHERE id = $2`,
    [coverArt, albumId]
  );
  return res.rowCount > 0;
}

/**
 * Get all albums rated by a user (with viewer stats)
 */
export async function getUserRatedAlbums(userId) {
  const res = await pool.query(
    `SELECT
      a.id, a.title, a.release_date AS "releaseDate", a.cover_art AS "coverArt",
      ar.id AS "artistId", ar.name AS artist,
      alr.rating, alr.non_skips, alr.rated_songs
    FROM album_ratings alr
    LEFT JOIN albums a ON a.id = alr.album_id
    LEFT JOIN artists ar ON ar.id = a.artist_id
    WHERE alr.user_id = $1
    ORDER BY alr.rating DESC`,
    [userId]
  );
  return res.rows.map(a => ({ ...a, rate: `${a.non_skips}/${a.rated_songs}` }));
}

/**
 * Get album details for a specific user (private)
 */
export async function getAlbumDetailsPrivate(albumId, userId) {
  const albumRes = await pool.query(
    `
    SELECT
      a.id, a.title, a.release_date AS "releaseDate", a.cover_art AS "coverArt",
      ar.id AS "artistId", ar.name AS artist,
      alr.rating AS "userRating", alr.rated_songs
    FROM albums a
    JOIN artists ar ON a.artist_id = ar.id
    LEFT JOIN album_ratings alr
      ON alr.album_id = a.id AND alr.user_id = $1
    WHERE a.id = $2
    `,
    [userId, albumId]
  );

  const album = albumRes.rows[0];
  if (!album) return null;

  const tracksRes = await pool.query(
    `
    SELECT
      s.id, s.track_number AS num, s.title,
      ROUND(AVG(sr.rating)::numeric,2) AS "avgScore",
      ur.rating AS rating
    FROM songs s
    LEFT JOIN song_ratings sr ON sr.song_id = s.id
    LEFT JOIN song_ratings ur
      ON ur.song_id = s.id AND ur.user_id = $1
    WHERE s.album_id = $2
    GROUP BY s.id, ur.rating
    ORDER BY s.track_number ASC
    `,
    [userId, albumId]
  );

  album.tracks = tracksRes.rows;
  return album;
}

/**
 * Get user album scores
 */
export async function getUserAlbumScores(userId, power = 0.6) {
  const res = await pool.query(
    `
    SELECT album_id, rating
    FROM album_ratings
    WHERE user_id = $1
    ORDER BY rating ASC
    `,
    [userId]
  );
  const albums = res.rows;
  const n = albums.length;
  if (!n) return [];

  return albums.map((album, index) => {
    const percentile = n === 1 ? 1 : index / (n - 1);
    const adjusted = Math.pow(percentile, power);
    const score10 = Math.round(adjusted * 9 + 1);
    return {
      albumId: album.album_id,
      rawRating: album.rating,
      percentile,
      score10
    };
  });
}

/**
 * Get a single user album score
 */
export async function getUserAlbumScoreSingle(userId, albumId, power = 0.6) {
  const targetRes = await pool.query(
    `SELECT rating FROM album_ratings WHERE user_id = $1 AND album_id = $2`,
    [userId, albumId]
  );
  const target = targetRes.rows[0];
  if (!target) return null;

  const statsRes = await pool.query(
    `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN rating <= $1 THEN 1 ELSE 0 END) - 1 AS below
    FROM album_ratings
    WHERE user_id = $2
    `,
    [target.rating, userId]
  );
  const stats = statsRes.rows[0];

  if (parseInt(stats.total) <= 1) return { rawRating: target.rating, percentile: 1, score10: 10 };

  const percentile = stats.below / (stats.total - 1);
  const adjusted = Math.pow(percentile, power);
  const score10 = Math.round(adjusted * 9 + 1);

  return { rawRating: target.rating, percentile, score10 };
}