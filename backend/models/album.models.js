import pool from "../db/database.js";

/**
 * Create album and optionally its songs
 */
export async function createAlbum({ title, artist, releaseDate, songs = [], cover_art }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Support multiple artists split by ' & '
    const artistNames = artist.split(' & ').map(a => a.trim());
    const artistIds = [];

    for (const name of artistNames) {
      const artistRes = await client.query(
        `INSERT INTO artists (name) VALUES ($1)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id`,
        [name]
      );
      artistIds.push(artistRes.rows[0].id);
    }

    // Check for existing album with the same title and any of the same artists
    const duplicateCheck = await client.query(
      `SELECT a.id FROM albums a
       JOIN album_artists aa ON aa.album_id = a.id
       WHERE LOWER(a.title) = LOWER($1)
       AND aa.artist_id = ANY($2::int[])
       LIMIT 1`,
      [title, artistIds]
    );

    if (duplicateCheck.rows.length > 0) {
      throw new Error(`An album titled "${title}" by "${artist}" already exists.`);
    }

    const albumRes = await client.query(
      `INSERT INTO albums (title, release_date, cover_art)
       VALUES ($1, $2, $3) RETURNING id`,
      [title, releaseDate, cover_art]
    );
    const albumId = albumRes.rows[0].id;

    for (const artistId of artistIds) {
      await client.query(
        `INSERT INTO album_artists (album_id, artist_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [albumId, artistId]
      );
    }

    const songObjects = [];
    for (const [i, song] of songs.entries()) {
      const trackNumber = song.track_number ?? i + 1;
      const songRes = await client.query(
        `INSERT INTO songs (album_id, track_number, title) VALUES ($1, $2, $3) RETURNING id`,
        [albumId, trackNumber, song.title]
      );
      songObjects.push({ ...song, id: songRes.rows[0].id, num: trackNumber });
    }

    await client.query("COMMIT");

    return {
      id: albumId,
      title,
      artist: artistNames.join(' & '),
      artistId: artistIds[0],
      artistIds,
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
    SELECT
      a.id,
      a.title,
      a.release_date AS "releaseDate",
      a.cover_art AS "coverArt",
      artists.ids AS "artistIds",
      artists.names AS artist,
      ROUND(COALESCE(AVG(alr.score10), 0)::numeric, 2)::float AS "avgScore",
      COUNT(alr.user_id) AS "ratingCount"
    FROM albums a
    JOIN (
      SELECT
        aa.album_id,
        ARRAY_AGG(ar.id ORDER BY ar.name) AS ids,
        STRING_AGG(ar.name, ' & ' ORDER BY ar.name) AS names
      FROM album_artists aa
      JOIN artists ar ON ar.id = aa.artist_id
      GROUP BY aa.album_id
    ) artists ON artists.album_id = a.id
    LEFT JOIN album_ratings alr ON alr.album_id = a.id AND alr.score10 IS NOT NULL
    GROUP BY a.id, artists.ids, artists.names
    ORDER BY a.title
  `);

  return res.rows.map(a => ({ ...a, artistId: a.artistIds[0] }));
}

/**
 * Get one album by ID (with songs and ratings)
 */
export async function getAlbumById(id) {
  const albumRes = await pool.query(
    `SELECT
      a.id, a.title, a.release_date AS "releaseDate",
      ARRAY_AGG(ar.id ORDER BY ar.name) AS "artistIds",
      STRING_AGG(ar.name, ' & ' ORDER BY ar.name) AS artist
    FROM albums a
    JOIN album_artists aa ON aa.album_id = a.id
    JOIN artists ar ON ar.id = aa.artist_id
    WHERE a.id = $1
    GROUP BY a.id`,
    [id]
  );
  const album = albumRes.rows[0];
  if (!album) return null;

  album.artistId = album.artistIds[0];

  const songsRes = await pool.query(
    `SELECT
      s.id, s.track_number AS num, s.title,
      COALESCE(sr.rating,0) AS rating
    FROM songs s
    LEFT JOIN song_ratings sr ON sr.song_id = s.id
    WHERE s.album_id = $1
    ORDER BY s.track_number`,
    [id]
  );

  const albumRatingRes = await pool.query(
    `SELECT COUNT(*) AS "ratingCount", AVG(rating) AS "avgScore"
    FROM album_ratings
    WHERE album_id = $1`,
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
  const albumRes = await pool.query(
    `SELECT
      a.id, a.title, a.release_date AS "releaseDate", a.cover_art AS "coverArt",
      ARRAY_AGG(ar.id ORDER BY ar.name) AS "artistIds",
      STRING_AGG(ar.name, ' & ' ORDER BY ar.name) AS artist
    FROM albums a
    JOIN album_artists aa ON aa.album_id = a.id
    JOIN artists ar ON ar.id = aa.artist_id
    WHERE a.id = $1
    GROUP BY a.id`,
    [albumId]
  );
  const album = albumRes.rows[0];
  if (!album) return null;

  // keep backwards compat — single artistId for existing code
  album.artistId = album.artistIds[0];

  const genresRes = await pool.query(
    `SELECT g.id, g.name FROM genres g
     JOIN album_genres ag ON ag.genre_id = g.id
     WHERE ag.album_id = $1 ORDER BY g.name`,
    [albumId]
  );

  const albumScoreRes = await pool.query(
    `SELECT
     COUNT(*) AS "ratingCount",
     ROUND(AVG(score10)::numeric, 2) AS "avgScore"
    FROM album_ratings
    WHERE album_id = $1 AND score10 IS NOT NULL`,
    [albumId]
  );

  const tracksRes = await pool.query(
    `SELECT
      s.id, s.track_number AS num, s.title, s.featured,
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
    tracks,
    genres: genresRes.rows
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const artistNames = artistName.split(' & ').map(a => a.trim());
    const artistIds = [];

    for (const name of artistNames) {
      const artistRes = await client.query(
        `INSERT INTO artists (name) VALUES ($1)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id`,
        [name]
      );
      artistIds.push(artistRes.rows[0].id);
    }

    await client.query(`DELETE FROM album_artists WHERE album_id = $1`, [albumId]);

    for (const artistId of artistIds) {
      await client.query(
        `INSERT INTO album_artists (album_id, artist_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [albumId, artistId]
      );
    }

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
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
      (
        SELECT STRING_AGG(ar2.name, ' & ' ORDER BY ar2.name)
        FROM album_artists aa2
        JOIN artists ar2 ON ar2.id = aa2.artist_id
        WHERE aa2.album_id = a.id
      ) AS artist,
      (
        SELECT ARRAY_AGG(ar2.id ORDER BY ar2.name)
        FROM album_artists aa2
        JOIN artists ar2 ON ar2.id = aa2.artist_id
        WHERE aa2.album_id = a.id
      ) AS "artistIds",
      COUNT(sr.rating) AS "ratedSongs",
      COALESCE(SUM(sr.rating), 0) AS "totalRating",
      COUNT(sr.rating) FILTER (WHERE sr.rating > 0) AS "nonSkips"
    FROM albums a
    JOIN songs s ON s.album_id = a.id
    LEFT JOIN song_ratings sr ON sr.song_id = s.id AND sr.user_id = $1
    GROUP BY a.id
    HAVING COUNT(sr.rating) > 0
    ORDER BY "totalRating" DESC`,
    [userId]
  );

  const genresRes = await pool.query(`
  SELECT ag.album_id, ARRAY_AGG(g.name) AS genres
  FROM album_genres ag
  JOIN genres g ON g.id = ag.genre_id
  WHERE ag.album_id = ANY($1)
  GROUP BY ag.album_id
`, [res.rows.map(a => a.id)]);

  const genreMap = new Map(genresRes.rows.map(r => [r.album_id, r.genres]));

  return res.rows.map(a => {
    const ratedSongs = Number(a.ratedSongs);
    const totalRating = Number(a.totalRating);
    const nonSkips = Number(a.nonSkips);
    const rating = ratedSongs > 0 ? (totalRating * totalRating) / ratedSongs : 0;
    return { ...a, artistId: a.artistIds[0], rating, rate: `${nonSkips}/${ratedSongs}`, genres: genreMap.get(a.id) || [] };
  });
}

/**
 * Get album details for a specific user (private)
 */
export async function getAlbumDetailsPrivate(albumId, userId) {
  const albumRes = await pool.query(
    `SELECT
      a.id, 
      a.title, 
      a.release_date AS "releaseDate", 
      a.cover_art AS "coverArt",
      alr.untracked,
      ARRAY_AGG(ar.id ORDER BY ar.name) AS "artistIds",
      STRING_AGG(ar.name, ' & ' ORDER BY ar.name) AS artist,
      alr.id AS "ratingId",
      alr.rating AS "userRating", 
      alr.rated_songs,
      alr.review AS review
    FROM albums a
    JOIN album_artists aa ON aa.album_id = a.id
    JOIN artists ar ON ar.id = aa.artist_id
    LEFT JOIN album_ratings alr ON alr.album_id = a.id AND alr.user_id = $1
    WHERE a.id = $2
    GROUP BY a.id, alr.rating, alr.rated_songs, alr.review, alr.id`,
    [userId, albumId]
  );

  const album = albumRes.rows[0];
  if (!album) return null;

  album.artistId = album.artistIds[0];

  const tracksRes = await pool.query(
    `SELECT
      s.id, s.track_number AS num, s.title, s.featured,
      ROUND(AVG(sr.rating)::numeric,2) AS "avgScore",
      ur.rating AS rating,
      ur.comment AS comment
    FROM songs s
    LEFT JOIN song_ratings sr ON sr.song_id = s.id
    LEFT JOIN song_ratings ur ON ur.song_id = s.id AND ur.user_id = $1
    WHERE s.album_id = $2
    GROUP BY s.id, ur.rating, ur.comment
    ORDER BY s.track_number ASC`,
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
export async function getUserAlbumScores(userId, power = 0.5) {
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

  return albums.map((album) => {
    const below = albums.filter(a => a.rating < album.rating).length;
    const percentile = n === 1 ? 1 : below / (n - 1);
    const adjusted = Math.pow(percentile, power);
    const score10 = adjusted * 9 + 1;
    return { ...album, percentile, score10 };
  });
}

// Get a single album score dynamically
export async function getUserAlbumScoreSingle(userId, albumId, power = 0.5) {
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

    const res = await client.query(
      `SELECT 
        COUNT(*) AS rated_songs,
        SUM(CASE WHEN rating > 0 THEN 1 ELSE 0 END) AS non_skips,
        COALESCE(SUM(rating), 0) AS total_rating
      FROM song_ratings sr
      JOIN songs s ON s.id = sr.song_id
      WHERE sr.user_id = $1 AND s.album_id = $2`,
      [userId, albumId]
    );

    const stats = res.rows[0];
    const ratedSongs = Number(stats.rated_songs);
    const nonSkips = Number(stats.non_skips);
    const totalRating = Number(stats.total_rating) * Number(stats.total_rating) / ratedSongs;

    if (ratedSongs === 0) {
      await client.query(
        `DELETE FROM album_ratings WHERE user_id = $1 AND album_id = $2`,
        [userId, albumId]
      );
    } else {
      await client.query(
        `INSERT INTO album_ratings (user_id, album_id, rating, non_skips, rated_songs, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, album_id)
        DO UPDATE SET 
          rating = EXCLUDED.rating,
          non_skips = EXCLUDED.non_skips,
          rated_songs = EXCLUDED.rated_songs,
          updated_at = NOW()`,
        [userId, albumId, totalRating, nonSkips, ratedSongs]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updateAlbumRatingForUser error:", err);
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

export async function getAlbumGenres(albumId) {
  const res = await pool.query(
    `SELECT g.id, g.name FROM genres g
     JOIN album_genres ag ON ag.genre_id = g.id
     WHERE ag.album_id = $1
     ORDER BY g.name`,
    [albumId]
  );
  return res.rows;
}

export async function getAllGenres() {
  const res = await pool.query(`SELECT id, name FROM genres ORDER BY name`);
  return res.rows;
}

export async function addGenreToAlbum(albumId, genreName) {

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const normalized = genreName.trim().charAt(0).toUpperCase() + genreName.trim().slice(1);

    // Find or create genre
    const genreRes = await client.query(
      `INSERT INTO genres (name) VALUES ($1)
       ON CONFLICT (LOWER(name)) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [normalized]
    );
    const genreId = genreRes.rows[0].id;

    // Link to album
    await client.query(
      `INSERT INTO album_genres (album_id, genre_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [albumId, genreId]
    );

    await client.query("COMMIT");
    return genreId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function removeGenreFromAlbum(albumId, genreId) {
  await pool.query(
    `DELETE FROM album_genres WHERE album_id = $1 AND genre_id = $2`,
    [albumId, genreId]
  );
}

export async function getAlbumGenreRank(albumId, genre, userId) {
  const result = await pool.query(`
    WITH scores AS (
      SELECT
        a.id,
        POWER(SUM(sr.rating), 2.0) / NULLIF(COUNT(sr.song_id), 0) AS score
      FROM albums a
      JOIN album_genres ag ON ag.album_id = a.id
      JOIN genres g ON g.id = ag.genre_id
      JOIN songs s ON s.album_id = a.id
      JOIN song_ratings sr ON sr.song_id = s.id
      WHERE LOWER(g.name) = LOWER($1) AND sr.user_id = $3
      GROUP BY a.id
    ),
    ranked AS (
      SELECT id, RANK() OVER (ORDER BY score DESC NULLS LAST) AS rank, COUNT(*) OVER () AS total
      FROM scores
    )
    SELECT rank, total FROM ranked WHERE id = $2;
  `, [genre, albumId, userId]);

  return { rank: result.rows[0]?.rank ?? null, total: result.rows[0]?.total ?? null };
}

export async function getAlbumYearRank(albumId, userId) {
  const result = await pool.query(`
    WITH scores AS (
      SELECT
        a.id,
        EXTRACT(YEAR FROM a.release_date) AS year,
        POWER(SUM(sr.rating), 2.0) / NULLIF(COUNT(sr.song_id), 0) AS score
      FROM albums a
      JOIN songs s ON s.album_id = a.id
      JOIN song_ratings sr ON sr.song_id = s.id
      WHERE sr.user_id = $2
      GROUP BY a.id
    ),
    ranked AS (
      SELECT
        id,
        RANK() OVER (PARTITION BY year ORDER BY score DESC NULLS LAST) AS rank,
        COUNT(*) OVER (PARTITION BY year) AS total
      FROM scores
    )
    SELECT rank, total FROM ranked WHERE id = $1;
  `, [albumId, userId]);

  return { rank: result.rows[0]?.rank ?? null, total: result.rows[0]?.total ?? null };
}

export async function getAlbumDecadeRank(albumId, userId) {
  const result = await pool.query(`
    WITH scores AS (
      SELECT
        a.id,
        FLOOR(EXTRACT(YEAR FROM a.release_date) / 10) * 10 AS decade,
        POWER(SUM(sr.rating), 2.0) / NULLIF(COUNT(sr.song_id), 0) AS score
      FROM albums a
      JOIN songs s ON s.album_id = a.id
      JOIN song_ratings sr ON sr.song_id = s.id
      WHERE sr.user_id = $2
      GROUP BY a.id
    ),
    ranked AS (
      SELECT
        id,
        RANK() OVER (PARTITION BY decade ORDER BY score DESC NULLS LAST) AS rank,
        COUNT(*) OVER (PARTITION BY decade) AS total
      FROM scores
    )
    SELECT rank, total FROM ranked WHERE id = $1;
  `, [albumId, userId]);

  return { rank: result.rows[0]?.rank ?? null, total: result.rows[0]?.total ?? null };
}

export async function getAlbumArtistRank(albumId, userId) {
  const result = await pool.query(`
    WITH scores AS (
      SELECT
        a.id,
        aa.artist_id,
        POWER(SUM(sr.rating), 2.0) / NULLIF(COUNT(sr.song_id), 0) AS score
      FROM albums a
      JOIN album_artists aa ON aa.album_id = a.id
      JOIN songs s ON s.album_id = a.id
      JOIN song_ratings sr ON sr.song_id = s.id
      WHERE sr.user_id = $2
      GROUP BY a.id, aa.artist_id
    ),
    ranked AS (
      SELECT
        id,
        artist_id,
        RANK() OVER (PARTITION BY artist_id ORDER BY score DESC NULLS LAST) AS rank,
        COUNT(*) OVER (PARTITION BY artist_id) AS total
      FROM scores
    )
    SELECT ar.name, ranked.rank, ranked.total
    FROM ranked
    JOIN artists ar ON ar.id = ranked.artist_id
    WHERE ranked.id = $1;
  `, [albumId, userId]);

  return result.rows; // returns array e.g. [{name: 'Drake', rank: 1, total: 5}, {name: 'PARTYNEXTDOOR', rank: 2, total: 3}]
}

export async function getAlbumOverallRank(albumId, userId) {
  const result = await pool.query(`
    WITH scores AS (
      SELECT
        a.id,
        POWER(SUM(sr.rating), 2.0) / NULLIF(COUNT(sr.song_id), 0) AS score
      FROM albums a
      JOIN songs s ON s.album_id = a.id
      JOIN song_ratings sr ON sr.song_id = s.id
      WHERE sr.user_id = $2
      GROUP BY a.id
    ),
    ranked AS (
      SELECT id, RANK() OVER (ORDER BY score DESC NULLS LAST) AS rank, COUNT(*) OVER () AS total
      FROM scores
    )
    SELECT rank, total FROM ranked WHERE id = $1;
  `, [albumId, userId]);

  return { rank: result.rows[0]?.rank ?? null, total: result.rows[0]?.total ?? null };
}

export async function updateAlbumReview(userId, albumId, review) {
  if (review && review.length > 1000) throw new Error("Review exceeds 1000 character limit");
  const result = await pool.query(`
    INSERT INTO album_ratings (user_id, album_id, rating, non_skips, rated_songs, review, updated_at)
    VALUES ($1, $2, 0, 0, 0, $3, NOW())
    ON CONFLICT (user_id, album_id)
    DO UPDATE SET review = EXCLUDED.review, updated_at = NOW()
    RETURNING *
  `, [userId, albumId, review]);
  return result.rows[0];
}

/**
 * Sync score10s
 * @param {} userId 
 * @returns 
 */
export async function syncUserScore10s(userId) {
  const scores = await getUserAlbumScores(userId);
  if (!scores.length) return;

  const values = scores.map((_, i) =>
    `($${i * 3 + 1}::int, $${i * 3 + 2}::int, $${i * 3 + 3}::real)`
  ).join(", ");

  const params = scores.flatMap(s => [userId, s.albumId, s.score10]);

  await pool.query(
    `UPDATE album_ratings AS ar
     SET score10 = v.score10
     FROM (VALUES ${values}) AS v(user_id, album_id, score10)
     WHERE ar.user_id = v.user_id::int AND ar.album_id = v.album_id::int`,
    params
  );
}