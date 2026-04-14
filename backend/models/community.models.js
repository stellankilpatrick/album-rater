import pool from "../db/database.js";

export async function getCommunityFeed(userId, limit = 18) {
  const res = await pool.query(
    `
    SELECT
      CONCAT(r.user_id, '-', al.id) AS activity_id,
      r.user_id,
      u.username,
      al.id AS album_id,
      al.title AS album_title,
      (
        SELECT STRING_AGG(ar.name, ' & ' ORDER BY ar.name)
        FROM album_artists aa
        JOIN artists ar ON ar.id = aa.artist_id
        WHERE aa.album_id = al.id
      ) AS artist_name,
      MAX(r.updated_at) AS updated_at
    FROM song_ratings r
    JOIN follows f ON f.following_id = r.user_id
    JOIN users u ON u.id = r.user_id
    JOIN songs s ON s.id = r.song_id
    JOIN albums al ON al.id = s.album_id
    WHERE f.follower_id = $1
    GROUP BY r.user_id, al.id, u.username, al.title
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
        (SUM(sr.rating) * SUM(sr.rating))::float
          / NULLIF(COUNT(sr.rating), 0) AS rating,
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
      STRING_AGG(ar.name, ' & ' ORDER BY ar.name) AS artist,
      ARRAY_AGG(ar.id ORDER BY ar.name) AS "artistIds",
      uas.rating,
      uas."lastRatedAt"
    FROM albums a
    JOIN album_artists aa ON aa.album_id = a.id
    JOIN artists ar ON ar.id = aa.artist_id
    JOIN user_album_scores uas ON uas.album_id = a.id
    WHERE a.release_date IS NOT NULL
      AND EXTRACT(WEEK FROM a.release_date::date)
          = EXTRACT(WEEK FROM CURRENT_DATE)
    GROUP BY a.id, uas.rating, uas."lastRatedAt"
    ORDER BY a.release_date ASC`,
    [userId]
  );

  return res.rows.map(a => ({ ...a, artistId: a.artistIds[0] }));
}