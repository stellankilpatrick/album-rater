import pool from "../db/database.js";

// Get all artists with their albums and stats
export async function getArtistRankings() {
  const artists = await pool.query("SELECT * FROM artists");

  const result = [];
  for (const artist of artists.rows) {
    const albumsRes = await pool.query(
      "SELECT * FROM albums WHERE artist_id = $1",
      [artist.id]
    );

    const albumsWithRating = await attachAlbumStats(albumsRes.rows);
    if (albumsWithRating.length > 0) {
      result.push({ ...artist, albums: albumsWithRating });
    }
  }

  return result;
}

// Attach stats to albums (optionally per user)
export async function attachAlbumStats(albums, userId = null) {
  const result = [];
  for (const album of albums) {
    const statsRes = await pool.query(
      `SELECT
        COUNT(s.id) AS "totalSongs",
        COUNT(sr.rating) FILTER (WHERE sr.rating > 0) AS "ratedSongs",
        COALESCE(SUM(sr.rating), 0) AS "sumRatings"
      FROM songs s
      LEFT JOIN song_ratings sr
        ON sr.song_id = s.id
       ${userId ? "AND sr.user_id = $1" : ""}
      WHERE s.album_id = $2`,
      userId ? [userId, album.id] : [album.id]
    );

    const stats = statsRes.rows[0];
    const totalSongs = Number(stats.totalSongs);
    const ratedSongs = Number(stats.ratedSongs);
    const sumRatings = Number(stats.sumRatings);

    result.push({
      ...album,
      rating: totalSongs > 0 ? Math.pow(sumRatings, 2) / totalSongs : 0,
      rate: `${ratedSongs}/${totalSongs}`,
    });
  }

  return result;
}

// Get all rated artists (avg album score)
export async function getAllRatedArtists() {
  const res = await pool.query(`
    WITH user_album_scores AS (
      SELECT
        a.id AS album_id,
        a.artist_id,
        sr.user_id,
        (SUM(sr.rating) * SUM(sr.rating))::float / COUNT(sr.rating) AS userScore
      FROM albums a
      JOIN songs s ON s.album_id = a.id
      JOIN song_ratings sr ON sr.song_id = s.id
      GROUP BY a.id, a.artist_id, sr.user_id
    ),
    album_scores AS (
      SELECT
        album_id,
        artist_id,
        AVG(userScore) AS albumScore,
        COUNT(user_id) AS ratingCount
      FROM user_album_scores
      GROUP BY album_id, artist_id
    )
    SELECT
      ar.id,
      ar.name,
      ar.image,
      ROUND(AVG(album_scores.albumScore)::numeric, 2)::float AS "avgRating",
      SUM(album_scores.ratingCount) AS "ratingCount",
      COUNT(album_scores.album_id) AS "albumCount"
    FROM artists ar
    JOIN album_scores ON album_scores.artist_id = ar.id
    GROUP BY ar.id, ar.name, ar.image
    ORDER BY "avgRating" DESC
  `);

  return res.rows;
}

// Get albums for a specific artist
export async function getArtistAlbums(artistId) {
  const albumsRes = await pool.query(
    "SELECT * FROM albums WHERE artist_id = $1",
    [artistId]
  );
  return attachAlbumStats(albumsRes.rows);
}

export async function getArtistAlbumsWithTotal(artistId) {
  const albumsRes = await pool.query(
    `
    WITH user_album_scores AS (
      SELECT
        a.id AS "albumId",
        a.cover_art AS "albumCoverArt",
        sr.user_id,
        (SUM(sr.rating) * SUM(sr.rating))::float / COUNT(sr.rating) AS "userScore"
      FROM albums a
      JOIN songs s ON s.album_id = a.id
      JOIN song_ratings sr ON sr.song_id = s.id
      WHERE a.artist_id = $1
      GROUP BY a.id, sr.user_id
    )
    SELECT
      a.id,
      a.title,
      a.release_date AS "releaseDate",
      a.cover_art AS "albumCoverArt",
      ar.name AS artist,
      ar.image AS "artistImage",
      ROUND(COALESCE(AVG(uas."userScore")::numeric, 0), 2) AS "avgScore",
      COUNT(uas.user_id) AS "ratingCount"
    FROM albums a
    JOIN artists ar ON ar.id = a.artist_id
    LEFT JOIN user_album_scores uas ON uas."albumId" = a.id
    WHERE a.artist_id = $1
    GROUP BY a.id, ar.name, ar.image
    ORDER BY "avgScore" DESC
    `,
    [artistId]
  );

  const albums = albumsRes.rows.map(a => ({
    ...a,
    avgScore: Number(a.avgScore) || 0,
    ratingCount: Number(a.ratingCount) || 0
  }));

  const totalRating = albums.reduce(
    (sum, a) => sum + a.avgScore * a.ratingCount,
    0
  );

  return { albums, totalRating };
}

export async function getUserRatedAlbumsByArtist(userId, artistId) {
  const res = await pool.query(
    `SELECT
      a.id,
      a.title,
      a.release_date AS "releaseDate",
      a.cover_art AS "coverArt",
      ar.id AS "artistId",
      ar.name AS artist,
      ar.image AS "artistImage",
      COUNT(s.id) AS "numSongs",
      COUNT(sr.rating) AS "ratedSongs",
      COALESCE(SUM(sr.rating), 0) AS "totalValue"
    FROM albums a
    JOIN artists ar ON ar.id = a.artist_id
    JOIN songs s ON s.album_id = a.id
    LEFT JOIN song_ratings sr
      ON sr.song_id = s.id AND sr.user_id = $1
    WHERE ar.id = $2
    GROUP BY a.id, ar.id
    HAVING COUNT(sr.rating) FILTER (WHERE sr.rating > 0) > 0
    ORDER BY (COALESCE(SUM(sr.rating), 0) * COALESCE(SUM(sr.rating), 0)) / COUNT(sr.rating) DESC`,
    [userId, artistId]
  );

  return res.rows.map(a => ({
    ...a,
    rating: a.ratedSongs > 0 ? Math.pow(a.totalValue, 2) / a.ratedSongs : 0,
    rate: `${a.ratedSongs}/${a.numSongs}`,
  }));
}

export async function attachUserAlbumStats(albums, userId, power=0.6) {
  // Step 1: get ALL rated albums for this user to compute global percentiles
  const allRes = await pool.query(
    `SELECT
      a.id,
      COALESCE(SUM(sr.rating), 0) AS "totalRating",
      COUNT(sr.rating) FILTER (WHERE sr.rating IS NOT NULL) AS "ratedSongs"
    FROM albums a
    JOIN songs s ON s.album_id = a.id
    LEFT JOIN song_ratings sr ON sr.song_id = s.id AND sr.user_id = $1
    GROUP BY a.id
    HAVING COUNT(sr.rating) FILTER (WHERE sr.rating IS NOT NULL) > 0`,
    [userId]
  );

  const allRatings = allRes.rows.map(a => {
    const total = Number(a.totalRating);
    const rated = Number(a.ratedSongs);
    return { id: a.id, rating: rated > 0 ? (total * total) / rated : 0 };
  });

  const sorted = allRatings.slice().sort((a, b) => a.rating - b.rating);
  const n = sorted.length;

  const scoreMap = new Map(
    sorted.map((a, index) => {
      const percentile = n === 1 ? 1 : index / (n - 1);
      const score10 = Math.round(Math.pow(percentile, power) * 9 + 1);
      return [a.id, score10];
    })
  );

  // Step 2: attach stats + score10 to the provided albums
  const result = [];
  for (const a of albums) {
    const statsRes = await pool.query(
      `SELECT
        COUNT(s.id) AS "numSongs",
        COUNT(*) FILTER (WHERE sr.rating IS NOT NULL) AS "ratedSongs",
        COALESCE(SUM(CASE WHEN sr.rating > 0 THEN 1 ELSE 0 END), 0) AS "nonSkips",
        COALESCE(SUM(sr.rating), 0) AS "totalRating"
      FROM songs s
      LEFT JOIN song_ratings sr ON sr.song_id = s.id AND sr.user_id = $1
      WHERE s.album_id = $2`,
      [userId, a.id]
    );

    const stats = statsRes.rows[0];
    const ratedSongs = Number(stats.ratedSongs);
    const totalRating = Number(stats.totalRating);
    const nonSkips = Number(stats.nonSkips);

    result.push({
      ...a,
      rating: ratedSongs > 0 ? Math.pow(totalRating, 2) / ratedSongs : 0,
      rate: `${nonSkips}/${ratedSongs}`,
      score10: scoreMap.get(a.id) ?? null,
    });
  }

  return result;
}

export async function getUserArtistStats(userId) {
  const res = await pool.query(
    `SELECT
      ar.id,
      ar.name,
      ar.image,
      a.id AS album_id,
      COALESCE(SUM(sr.rating), 0) AS "ratingSum",
      COUNT(sr.rating) AS "ratedSongs"
    FROM artists ar
    JOIN albums a ON a.artist_id = ar.id
    JOIN songs s ON s.album_id = a.id
    LEFT JOIN song_ratings sr ON sr.song_id = s.id AND sr.user_id = $1
    GROUP BY ar.id, a.id
    HAVING COUNT(sr.rating) > 0`,
    [userId]
  );

  // Group by artist
  const artistMap = new Map();
  for (const row of res.rows) {
    if (!artistMap.has(row.id)) {
      artistMap.set(row.id, { id: row.id, name: row.name, image: row.image, albums: [] });
    }
    const rating = row.ratedSongs > 0 ? Math.pow(row.ratingSum, 2) / row.ratedSongs : 0;
    artistMap.get(row.id).albums.push(rating);
  }

  // Apply decay per artist
  return Array.from(artistMap.values()).map(artist => {
    const sorted = artist.albums.slice().sort((a, b) => b - a);
    const totalScore = sorted.reduce((sum, rating, i) => sum + rating * Math.pow(0.9, i), 0);
    return {
      id: artist.id,
      name: artist.name,
      image: artist.image,
      albumCount: artist.albums.length,
      totalScore
    };
  }).sort((a, b) => b.totalScore - a.totalScore);
}