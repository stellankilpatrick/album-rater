import pool from "../db/database.js";

/**
 * Create album and optionally its songs
 */
export async function createAlbum({ title, artist, releaseDate, songs = [], cover_art }) {
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
      `INSERT INTO albums (title, artist_id, release_date, cover_art)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [title, artistId, releaseDate, cover_art]
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
  const res = await pool.query(`
    WITH user_album_scores AS (
      SELECT
        a.id AS album_id,
        sr.user_id,
        (SUM(sr.rating) * SUM(sr.rating))::float / COUNT(sr.rating) AS userScore
      FROM albums a
      JOIN songs s ON s.album_id = a.id
      JOIN song_ratings sr ON sr.song_id = s.id
      GROUP BY a.id, sr.user_id
    ),
    album_scores AS (
      SELECT
        album_id,
        AVG(userScore) AS albumScore,
        COUNT(user_id) AS ratingCount
      FROM user_album_scores
      GROUP BY album_id
    )
    SELECT
      a.id,
      a.title,
      a.release_date AS "releaseDate",
      a.cover_art AS "coverArt",
      ar.id AS "artistId",
      ar.name AS artist,
      ROUND(COALESCE(album_scores.albumScore, 0)::numeric, 2)::float AS "avgScore",
      COALESCE(album_scores.ratingCount, 0) AS "ratingCount"
    FROM albums a
    JOIN artists ar ON ar.id = a.artist_id
    LEFT JOIN album_scores ON album_scores.album_id = a.id
    ORDER BY a.title
  `);

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
    `SELECT
      a.id, a.title, a.release_date AS "releaseDate", a.cover_art AS "coverArt",
      ar.id AS "artistId", ar.name AS artist
    FROM albums a
    JOIN artists ar ON a.artist_id = ar.id
    WHERE a.id = $1`,
    [albumId]
  );
  const album = albumRes.rows[0];
  if (!album) return null;

  // Calculate album-level rating per user
  const albumScoreRes = await pool.query(
    `SELECT
      COUNT(*) AS "ratingCount",
      ROUND(AVG(user_album_score)::numeric, 2) AS "avgScore"
    FROM (
      SELECT
        sr.user_id,
        (SUM(sr.rating) * SUM(sr.rating))::float
          / NULLIF(COUNT(sr.rating), 0) AS user_album_score
      FROM songs s
      JOIN song_ratings sr ON sr.song_id = s.id
      WHERE s.album_id = $1
      GROUP BY sr.user_id
    ) AS per_user_scores`,
    [albumId]
  );

  const tracksRes = await pool.query(
    `SELECT
      s.id, s.track_number AS num, s.title,
      COALESCE(ROUND(AVG(sr.rating)::numeric,2),0) AS "avgScore",
      COUNT(sr.rating) AS "totalRatings",
      SUM(CASE WHEN sr.rating = 0 THEN 1 ELSE 0 END) AS "skipCount"
    FROM songs s
    LEFT JOIN song_ratings sr ON sr.song_id = s.id
    WHERE s.album_id = $1
    GROUP BY s.id
    ORDER BY s.track_number ASC`,
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

export async function updateAlbumReleaseDate(albumId, releaseDate) {
  const res = await pool.query(
    `UPDATE albums SET release_date = $1 WHERE id = $2`,
    [releaseDate, albumId]
  );

  return res.rowCount > 0;
}


/**
 * Get all albums rated by a user (with viewer stats)
 */
export async function getUserRatedAlbums(userId) {

  const res = await pool.query(
    `SELECT
      a.id,
      a.title,
      a.release_date AS "releaseDate",
      a.cover_art AS "coverArt",
      ar.id AS "artistId",
      ar.name AS artist,
      COUNT(sr.rating) AS "ratedSongs",
      COALESCE(SUM(sr.rating), 0) AS "totalRating",
      COUNT(sr.rating) FILTER (WHERE sr.rating > 0) AS "nonSkips"
    FROM albums a
    JOIN artists ar ON ar.id = a.artist_id
    JOIN songs s ON s.album_id = a.id
    LEFT JOIN song_ratings sr
      ON sr.song_id = s.id AND sr.user_id = $1
    GROUP BY a.id, ar.id
    HAVING COUNT(sr.rating) > 0
    ORDER BY "totalRating" DESC`,
    [userId]
  );
  return res.rows.map(a => {
    const ratedSongs = Number(a.ratedSongs);
    const totalRating = Number(a.totalRating);
    const nonSkips = Number(a.nonSkips);

    const rating =
      ratedSongs > 0 ? (totalRating * totalRating) / ratedSongs : 0;

    return {
      ...a,
      rating,
      rate: `${nonSkips}/${ratedSongs}`,
    };
  });
}

/**
 * Get album details for a specific user (private)
 */
export async function getAlbumDetailsPrivate(albumId, userId) {
  const albumRes = await pool.query(
    `
    SELECT
      a.id, 
      a.title, 
      a.release_date AS "releaseDate", 
      a.cover_art AS "coverArt",
      ar.id AS "artistId", 
      ar.name AS artist,
      alr.rating AS "userRating", 
      alr.rated_songs
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
 * Get user album scores as ratings then finds percentiles to turn
 * into score10s
 */
// Get all user album scores dynamically
export async function getUserAlbumScores(userId, power = 0.6) {
  // Pull all albums the user has rated
  const res = await pool.query(
    `
    SELECT
      a.id AS album_id,
      COALESCE(SUM(sr.rating), 0) AS total_rating,
      COUNT(sr.rating) FILTER (WHERE sr.rating IS NOT NULL) AS rated_songs
    FROM albums a
    JOIN songs s ON s.album_id = a.id
    LEFT JOIN song_ratings sr ON sr.song_id = s.id AND sr.user_id = $1
    GROUP BY a.id
    HAVING COUNT(sr.rating) FILTER (WHERE sr.rating IS NOT NULL) > 0
    ORDER BY total_rating DESC
    `,
    [userId]
  );

  const albums = res.rows.map(a => {
    const totalRating = Number(a.total_rating);
    const ratedSongs = Number(a.rated_songs);
    const rating = ratedSongs > 0 ? (totalRating * totalRating) / ratedSongs : 0;
    return { albumId: a.album_id, rating };
  });

  const n = albums.length;
  if (!n) return [];

  // Sort by rating ascending to compute percentiles
  albums.sort((a, b) => a.rating - b.rating);

  return albums.map((album, index) => {
    const percentile = n === 1 ? 1 : index / (n - 1);
    const adjusted = Math.pow(percentile, power);
    const score10 = adjusted * 9 + 1;
    return { ...album, percentile, score10 };
  });
}

// Get a single album score dynamically
export async function getUserAlbumScoreSingle(userId, albumId, power = 0.6) {
  // Get rating for target album
  const targetRes = await pool.query(
    `SELECT
      COALESCE(SUM(sr.rating), 0) AS total_rating,
      COUNT(sr.rating) FILTER (WHERE sr.rating IS NOT NULL) AS rated_songs
    FROM songs s
    LEFT JOIN song_ratings sr ON sr.song_id = s.id AND sr.user_id = $1
    WHERE s.album_id = $2
    GROUP BY s.album_id`,
    [userId, albumId]
  );

  const targetRow = targetRes.rows[0];
  if (!targetRow) return null;

  const totalRating = Number(targetRow.total_rating);
  const ratedSongs = Number(targetRow.rated_songs);
  const rating = ratedSongs > 0 ? (totalRating * totalRating) / ratedSongs : 0;

  // Get all album ratings for this user
  const allRes = await pool.query(
    `
    SELECT
      a.id AS album_id,
      COALESCE(SUM(sr.rating), 0) AS total_rating,
      COUNT(sr.rating) FILTER (WHERE sr.rating IS NOT NULL) AS rated_songs
    FROM albums a
    JOIN songs s ON s.album_id = a.id
    LEFT JOIN song_ratings sr ON sr.song_id = s.id AND sr.user_id = $1
    GROUP BY a.id
    HAVING COUNT(sr.rating) FILTER (WHERE sr.rating IS NOT NULL) > 0
    `,
    [userId]
  );

  const albums = allRes.rows.map(a => {
    const tr = Number(a.total_rating);
    const rs = Number(a.rated_songs);
    return rs > 0 ? (tr * tr) / rs : 0;
  });

  if (!albums.length) return { rawRating: rating, percentile: 1, score10: 10 };

  // Compute percentile
  const sortedRatings = albums.slice().sort((a, b) => a - b);
  const below = sortedRatings.filter(r => r < rating).length;
  const percentile = sortedRatings.length === 1 ? 1 : below / (sortedRatings.length - 1);
  const adjusted = Math.pow(percentile, power);
  const score10 = adjusted * 9 + 1;

  return { rawRating: rating, percentile, score10 };
}

/**
 * Calculate and upsert album rating for a specific user
 */
export async function updateAlbumRatingForUser(userId, albumId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get aggregate data from song_ratings
    const res = await client.query(
      `
      SELECT 
        COUNT(*) AS rated_songs,
        SUM(CASE WHEN rating > 0 THEN 1 ELSE 0 END) AS non_skips,
        COALESCE(SUM(rating), 0) AS total_rating
      FROM song_ratings sr
      JOIN songs s ON s.id = sr.song_id
      WHERE sr.user_id = $1 AND s.album_id = $2
      `,
      [userId, albumId]
    );

    const stats = res.rows[0];
    const ratedSongs = Number(stats.rated_songs);
    const nonSkips = Number(stats.non_skips);
    const totalRating = Number(stats.total_rating);

    if (ratedSongs === 0) {
      // Remove album rating if no songs are rated
      await client.query(
        `DELETE FROM album_ratings WHERE user_id = $1 AND album_id = $2`,
        [userId, albumId]
      );
    } else {
      // Upsert into album_ratings
      await client.query(
        `
        INSERT INTO album_ratings (user_id, album_id, rating, non_skips, rated_songs, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, album_id)
        DO UPDATE SET 
          rating = EXCLUDED.rating,
          non_skips = EXCLUDED.non_skips,
          rated_songs = EXCLUDED.rated_songs,
          updated_at = NOW()
        `,
        [userId, albumId, totalRating, nonSkips, ratedSongs]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteUserAlbumRating(userId, albumId) {
  try {
    // Delete all song ratings for this album by the user
    const res = await pool.query(
      `DELETE FROM song_ratings
      WHERE user_id = $1
        AND song_id IN (
          SELECT id FROM songs WHERE album_id = $2
        )`,
      [userId, albumId]
    );

    return res.rowCount;
  } catch (err) {
    console.error("Failed to delete album rating:", err);
    throw err;
  }
}
