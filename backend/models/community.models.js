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
    `
    SELECT
      a.id,
      a.title,
      a.release_date AS "releaseDate",
      a.cover_art AS "coverArt",
      ar.name AS artist,
      ar.id AS "artistId",
      alr.rating,
      alr.updated_at AS "lastRatedAt"
    FROM albums a
    JOIN artists ar ON ar.id = a.artist_id
    LEFT JOIN album_ratings alr
      ON alr.album_id = a.id
     AND alr.user_id = $1
    WHERE a.release_date IS NOT NULL
      AND EXTRACT(WEEK FROM a.release_date) = EXTRACT(WEEK FROM CURRENT_DATE)
    ORDER BY a.release_date ASC
  `,
    [userId]
  );

  return res.rows;
}