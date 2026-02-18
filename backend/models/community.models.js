import pool from "../db/database.js";

export async function getCommunityFeed(userId, limit = 40) {
  const res = await pool.query(
    `
    SELECT
      CONCAT(r.user_id, '-', al.id) AS activity_id,
      r.user_id,
      u.username,
      al.id AS album_id,
      al.title AS album_title,
      ar.name AS artist_name,
      MAX(r.updated_at) AS updated_at
    FROM song_ratings r
    JOIN follows f ON f.following_id = r.user_id
    JOIN users u ON u.id = r.user_id
    JOIN songs s ON s.id = r.song_id
    JOIN albums al ON al.id = s.album_id
    JOIN artists ar ON ar.id = al.artist_id
    WHERE f.follower_id = $1
    GROUP BY r.user_id, al.id, u.username, al.title, ar.name
    ORDER BY updated_at DESC
    LIMIT $2
  `,
    [userId, limit]
  );

  return res.rows;
}

export async function getAnniversaryAlbums(userId) {
  const res = await pool.query(
    `WITH user_album_scores AS (
      SELECT
        s.album_id,
        sr.user_id,
        (SUM(sr.rating) * SUM(sr.rating))::float / NULLIF(COUNT(sr.rating), 0) AS rating,
        MAX(sr.updated_at) AS "lastRatedAt"
      FROM songs s
      JOIN song_ratings sr ON sr.song_id = s.id
      WHERE sr.user_id = $1
      GROUP BY s.album_id, sr.user_id
    )
    SELECT
      a.id,
      a.title,
      a.release_date AS "releaseDate",
      a.cover_art AS "coverArt",
      ar.name AS artist,
      ar.id AS "artistId",
      COALESCE(uas.rating, 0) AS rating,
      uas."lastRatedAt"
    FROM albums a
    JOIN artists ar ON ar.id = a.artist_id
    LEFT JOIN user_album_scores uas
      ON uas.album_id = a.id
    WHERE a.release_date IS NOT NULL
      AND TO_CHAR(a.release_date::date, 'IW') = TO_CHAR(CURRENT_DATE, 'IW')
    ORDER BY a.release_date ASC`,
    [userId]
  );

  return res.rows;
}