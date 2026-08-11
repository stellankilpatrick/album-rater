import pool from "../db/database.js";

// Get all artists with their albums and stats
export async function getArtistRankings() {
  const artists = await pool.query("SELECT * FROM artists");

  const result = [];
  for (const artist of artists.rows) {
    const albumsRes = await pool.query(
      `SELECT a.* FROM albums a
       JOIN album_artists aa ON aa.album_id = a.id
       WHERE aa.artist_id = $1`,
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

// Get all rated artists (avg album score10)
export async function getAllRatedArtists() {
  const res = await pool.query(`
    SELECT
      ar.id,
      ar.name,
      ar.image,
      ROUND(AVG(alr.score10)::numeric, 2)::float AS "avgRating",
      COUNT(alr.user_id) AS "ratingCount",
      COUNT(DISTINCT a.id) AS "albumCount"
    FROM artists ar
    JOIN album_artists aa ON aa.artist_id = ar.id
    JOIN albums a ON a.id = aa.album_id
    LEFT JOIN album_ratings alr ON alr.album_id = a.id AND alr.score10 IS NOT NULL
    GROUP BY ar.id, ar.name, ar.image
    ORDER BY "avgRating" DESC
  `);

  return res.rows;
}

// Get albums for a specific artist
export async function getArtistAlbums(artistId) {
  const albumsRes = await pool.query(
    `SELECT a.* FROM albums a
     JOIN album_artists aa ON aa.album_id = a.id
     WHERE aa.artist_id = $1`,
    [artistId]
  );
  return attachAlbumStats(albumsRes.rows);
}

export async function getArtistAlbumsWithTotal(artistId) {
  const albumsRes = await pool.query(
    `
    SELECT
      a.id,
      a.title,
      a.release_date AS "releaseDate",
      a.cover_art AS "albumCoverArt",
      (
        SELECT STRING_AGG(ar2.name, ' & ' ORDER BY ar2.name)
        FROM album_artists aa2
        JOIN artists ar2 ON ar2.id = aa2.artist_id
        WHERE aa2.album_id = a.id
      ) AS artist,
      ROUND(COALESCE(AVG(alr.score10)::numeric, 0), 2) AS "avgScore",
      COUNT(alr.user_id) AS "ratingCount"
    FROM albums a
    LEFT JOIN album_ratings alr ON alr.album_id = a.id AND alr.score10 IS NOT NULL
    WHERE EXISTS (
      SELECT 1 FROM album_artists aa WHERE aa.album_id = a.id AND aa.artist_id = $1
    )
    GROUP BY a.id
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
    (sum, a) => sum + a.avgScore * a.ratingCount, 0
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
      (
        SELECT STRING_AGG(ar2.name, ' & ' ORDER BY ar2.name)
        FROM album_artists aa2
        JOIN artists ar2 ON ar2.id = aa2.artist_id
        WHERE aa2.album_id = a.id
      ) AS artist,
      COUNT(s.id) AS "numSongs",
      COUNT(sr.rating) AS "ratedSongs",
      COALESCE(SUM(sr.rating), 0) AS "totalValue"
    FROM albums a
    JOIN songs s ON s.album_id = a.id
    LEFT JOIN song_ratings sr ON sr.song_id = s.id AND sr.user_id = $1
    WHERE EXISTS (
      SELECT 1 FROM album_artists aa WHERE aa.album_id = a.id AND aa.artist_id = $2
    )
    GROUP BY a.id
    HAVING COUNT(sr.rating) > 0    
    ORDER BY (COALESCE(SUM(sr.rating), 0) * COALESCE(SUM(sr.rating), 0)) / NULLIF(COUNT(sr.rating), 0) DESC`,
    [userId, artistId]
  );

  return res.rows.map(a => ({
    ...a,
    rating: a.ratedSongs > 0 ? Math.pow(a.totalValue, 2) / a.ratedSongs : 0,
    rate: `${a.ratedSongs}/${a.numSongs}`,
  }));
}

function getOptimalPower(likePercentage) {
  if (likePercentage <= 0 || likePercentage >= 1) return 1;
  return Math.log(0.5) / Math.log(1 - likePercentage);
}

// helper model to find correct power
export async function getUserPower(userId) {
  const { rows } = await pool.query(
    `SELECT
      COUNT(*) FILTER (WHERE liked = 1) AS likes,
      COUNT(*) FILTER (WHERE liked IS NOT NULL) AS total
     FROM album_ratings
     WHERE user_id = $1`,
    [userId]
  );

  const likes = Number(rows[0].likes);
  const total = Number(rows[0].total);

  if (total < 30) return 0.5;

  const likePercentage = likes / total;

  return getOptimalPower(likePercentage);
}

export async function attachUserAlbumStats(albums, userId) {
    const power = await getUserPower(userId);
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
    return { id: a.id, rating: rated > 0 ? (total * total) / rated**1.1 : 0 };
  });

  const sorted = allRatings.slice().sort((a, b) => a.rating - b.rating);
  const n = sorted.length;

  const scoreMap = new Map(
    sorted.map((a) => {
      const below = sorted.filter(x => x.rating < a.rating).length;
      const percentile = n === 1 ? 1 : below / (n - 1);
      const score10 = Math.pow(percentile, power) * 10;
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
      rating: ratedSongs > 0 ? Math.pow(totalRating, 2) / ratedSongs**1.1 : 0,
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
    JOIN album_artists aa ON aa.artist_id = ar.id
    JOIN albums a ON a.id = aa.album_id
    JOIN songs s ON s.album_id = a.id
    LEFT JOIN song_ratings sr ON sr.song_id = s.id AND sr.user_id = $1
    GROUP BY ar.id, a.id
    HAVING COUNT(sr.rating) > 0`,
    [userId]
  );

  // fetch score10s for this user
  const score10Res = await pool.query(
    `SELECT album_id, score10 FROM album_ratings WHERE user_id = $1 AND score10 IS NOT NULL`,
    [userId]
  );
  const score10Map = new Map(score10Res.rows.map(r => [r.album_id, r.score10]));

  const artistMap = new Map();
  for (const row of res.rows) {
    if (!artistMap.has(row.id)) {
      artistMap.set(row.id, { id: row.id, name: row.name, image: row.image, albums: [], score10s: [] });
    }
    const rating = row.ratedSongs > 0 ? Math.pow(row.ratingSum, 2) / Math.pow(row.ratedSongs,1.1) : 0;
    artistMap.get(row.id).albums.push(rating);
    const s10 = score10Map.get(row.album_id);
    if (s10 != null) artistMap.get(row.id).score10s.push(s10);
  }

  return Array.from(artistMap.values()).map(artist => {
    const sorted = artist.albums.slice().sort((a, b) => b - a);
    const totalScore = sorted.reduce((sum, rating, i) => sum + rating * Math.pow(0.85, i), 0);
    const avgScore10 = artist.score10s.length > 0
      ? artist.score10s.reduce((a, b) => a + b, 0) / artist.score10s.length
      : null;
    return {
      id: artist.id,
      name: artist.name,
      image: artist.image,
      albumCount: artist.albums.length,
      totalScore,
      avgScore10
    };
  }).sort((a, b) => b.totalScore - a.totalScore);
}

export async function updateArtistName(artistId, name) {
  const res = await pool.query(
    `UPDATE artists SET name = $1 WHERE id = $2 RETURNING *`,
    [name.trim(), artistId]
  );
  return res.rows[0];
}

// Get artist-specific stats for a user (projects/albums and songs rated/liked)
export async function getArtistUserStats(userId, artistId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(DISTINCT a.id) FILTER (WHERE ar.score10 IS NOT NULL OR ar.liked IS NOT NULL) AS projects_rated,
       COUNT(sr.rating) FILTER (WHERE sr.rating IS NOT NULL) AS songs_rated,
       COUNT(sr.rating) FILTER (WHERE sr.rating >= 4) AS songs_liked_count,
       COUNT(sr.rating) FILTER (WHERE sr.rating = 5) AS songs_special_count,
       COUNT(DISTINCT a.id) FILTER (WHERE ar.liked = 1) AS projects_liked_count,
       COUNT(DISTINCT a.id) FILTER (WHERE ar.liked IS NOT NULL) AS projects_opinion_total
     FROM albums a
     JOIN album_artists aa ON aa.album_id = a.id
     LEFT JOIN songs s ON s.album_id = a.id
     LEFT JOIN song_ratings sr ON sr.song_id = s.id AND sr.user_id = $1
     LEFT JOIN album_ratings ar ON ar.album_id = a.id AND ar.user_id = $1
     WHERE aa.artist_id = $2`,
    [userId, artistId]
  );

  const r = rows[0] || {};
  const projectsRated = Number(r.projects_rated || 0);
  const songsRated = Number(r.songs_rated || 0);
  const songsLikedCount = Number(r.songs_liked_count || 0);
  const songsSpecialCount = Number(r.songs_special_count || 0);
  const projectsLikedCount = Number(r.projects_liked_count || 0);
  const projectsOpinionTotal = Number(r.projects_opinion_total || 0);

  const songsLikedPct = songsRated > 0 ? (songsLikedCount / songsRated) * 100 : null;
  const songsSpecialPct = songsRated > 0 ? (songsSpecialCount / songsRated) * 100 : null;
  const projectsLikedPct = projectsOpinionTotal > 0 ? (projectsLikedCount / projectsOpinionTotal) * 100 : null;

  return {
    projectsRated,
    songsRated,
    songsLikedPct: songsLikedPct == null ? null : Number(songsLikedPct.toFixed(1)),
    songsSpecialPct: songsSpecialPct == null ? null : Number(songsSpecialPct.toFixed(1)),
    projectsLikedPct: projectsLikedPct == null ? null : Number(projectsLikedPct.toFixed(1)),
  };
}