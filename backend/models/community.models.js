import pool from "../db/database.js";

export async function getCommunityFeed(userId, limit = 18) {
  const res = await pool.query(
    `SELECT
      CONCAT(r.user_id, '-', al.id) AS activity_id,
      r.user_id,
      u.username,
      u.pfp,
      al.id AS album_id,
      al.title AS album_title,
      (
        SELECT STRING_AGG(ar.name, ' & ' ORDER BY ar.name)
        FROM album_artists aa
        JOIN artists ar ON ar.id = aa.artist_id
        WHERE aa.album_id = al.id
      ) AS artist_name,
      MAX(r.updated_at) AS updated_at,
      MIN(r.created_at) AS created_at
    FROM song_ratings r
    JOIN follows f ON f.following_id = r.user_id
    JOIN users u ON u.id = r.user_id
    JOIN songs s ON s.id = r.song_id
    JOIN albums al ON al.id = s.album_id
    WHERE f.follower_id = $1
    AND NOT EXISTS (
      SELECT 1 FROM album_ratings ar
      WHERE ar.user_id = r.user_id AND ar.album_id = al.id AND ar.untracked = true
    )
    GROUP BY r.user_id, al.id, u.username, u.pfp, al.title
    ORDER BY updated_at DESC
    LIMIT $2`,
    [userId, limit]
  );

  return res.rows;
}

export async function getAnniversaryAlbums(userId) {
  const res = await pool.query(
    `SELECT
      a.id,
      a.title,
      a.release_date AS "releaseDate",
      a.cover_art AS "coverArt",
      STRING_AGG(ar.name, ' & ' ORDER BY ar.name) AS artist,
      ARRAY_AGG(ar.id ORDER BY ar.name) AS "artistIds"
    FROM albums a
    JOIN album_artists aa ON aa.album_id = a.id
    JOIN artists ar ON ar.id = aa.artist_id
    JOIN album_ratings ar ON ar.album_id = a.id
    WHERE a.release_date IS NOT NULL
      AND EXTRACT(WEEK FROM a.release_date::date)
          = EXTRACT(WEEK FROM CURRENT_DATE)
      AND ar.user_id = $1
      AND ar.liked IS NOT 0
    GROUP BY a.id
    ORDER BY a.release_date ASC`,
    [userId]
  );

  return res.rows.map(a => ({ ...a, artistId: a.artistIds[0] }));
}