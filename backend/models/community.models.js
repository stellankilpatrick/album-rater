import pool from "../db/database.js";

// The user's album rating behind each feed entry ($1 is the viewer's id):
// its id (likes target it as "album_review"), score, written review, like
// count, whether the viewer liked it, and each artist with their id
const REVIEW_COLUMNS = `
      alr.id AS rating_id,
      COALESCE(alr.adjusted_rating, alr.score10) AS score,
      alr.review,
      (SELECT COUNT(*)::int FROM likes l WHERE l.target_type = 'album_review' AND l.target_id = alr.id) AS like_count,
      EXISTS (SELECT 1 FROM likes l WHERE l.target_type = 'album_review' AND l.target_id = alr.id AND l.user_id = $1) AS liked_by_me,
      (
        SELECT JSON_AGG(JSON_BUILD_OBJECT('id', ar.id, 'name', ar.name) ORDER BY ar.name)
        FROM album_artists aa
        JOIN artists ar ON ar.id = aa.artist_id
        WHERE aa.album_id = al.id
      ) AS artists`;

// Feeds are paged newest first. Each entry's `cursor` marks its place; passing it
// back as `before` returns the entries after it. Time is kept as text so its
// microseconds survive the round trip (a JS Date would cut them to milliseconds).
function parseCursor(before) {
  if (!before) return [null, null, null];
  const [time, userId, albumId] = before.split("|");
  if (!time || !Number.isInteger(Number(userId)) || !Number.isInteger(Number(albumId))) {
    throw new Error("Invalid cursor");
  }
  return [time, Number(userId), Number(albumId)];
}

export async function getCommunityFeed(userId, { limit = 500, before = null } = {}) {
  const res = await pool.query(
    `SELECT
      CONCAT(r.user_id, '-', al.id) AS activity_id,
      r.user_id,
      u.username,
      u.pfp,
      al.id AS album_id,
      al.title AS album_title,
      MAX(al.cover_art) AS "coverArt",
      (
        SELECT STRING_AGG(ar.name, ' & ' ORDER BY ar.name)
        FROM album_artists aa
        JOIN artists ar ON ar.id = aa.artist_id
        WHERE aa.album_id = al.id
      ) AS artist_name,
      MAX(r.updated_at) AS updated_at,
      MIN(r.created_at) AS created_at,
      CONCAT(MAX(r.updated_at)::text, '|', r.user_id, '|', al.id) AS cursor,
      ${REVIEW_COLUMNS}
    FROM song_ratings r
    JOIN follows f ON f.following_id = r.user_id
    JOIN users u ON u.id = r.user_id
    JOIN songs s ON s.id = r.song_id
    JOIN albums al ON al.id = s.album_id
    LEFT JOIN album_ratings alr ON alr.user_id = r.user_id AND alr.album_id = al.id
    WHERE f.follower_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM album_ratings ar
        WHERE ar.user_id = r.user_id AND ar.album_id = al.id AND (ar.untracked = true OR ar.is_draft = true)
      )
    GROUP BY r.user_id, al.id, u.username, u.pfp, al.title, alr.user_id, alr.album_id
    HAVING $3::timestamptz IS NULL
      OR (MAX(r.updated_at), r.user_id, al.id) < ($3::timestamptz, $4::int, $5::int)
    ORDER BY updated_at DESC, r.user_id DESC, al.id DESC
    LIMIT $2`,
    [userId, limit, ...parseCursor(before)]
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
    STRING_AGG(artist.name, ' & ' ORDER BY artist.name) AS artist,
    ARRAY_AGG(artist.id ORDER BY artist.name) AS "artistIds"
  FROM albums a
  JOIN album_artists aa ON aa.album_id = a.id
  JOIN artists artist ON artist.id = aa.artist_id
  JOIN album_ratings ar ON ar.album_id = a.id AND ar.is_draft = FALSE
  WHERE a.release_date IS NOT NULL
    AND EXTRACT(WEEK FROM a.release_date::date)
        = EXTRACT(WEEK FROM CURRENT_DATE)
    AND ar.user_id = $1
    AND ar.liked IS DISTINCT FROM -1
  GROUP BY a.id
  ORDER BY a.release_date ASC`,
    [userId]
  );

  return res.rows.map(a => ({ ...a, artistId: a.artistIds[0] }));
}

export async function getMyActivityFeed(userId, { limit = 500, before = null } = {}) {
  const res = await pool.query(
    `SELECT
      CONCAT(r.user_id, '-', al.id) AS activity_id,
      r.user_id,
      u.username,
      u.pfp,
      al.id AS album_id,
      al.title AS album_title,
      MAX(al.cover_art) AS "coverArt",
      (
        SELECT STRING_AGG(ar.name, ' & ' ORDER BY ar.name)
        FROM album_artists aa
        JOIN artists ar ON ar.id = aa.artist_id
        WHERE aa.album_id = al.id
      ) AS artist_name,
      MAX(r.updated_at) AS updated_at,
      MIN(r.created_at) AS created_at,
      CONCAT(MAX(r.updated_at)::text, '|', r.user_id, '|', al.id) AS cursor,
      ${REVIEW_COLUMNS}
    FROM song_ratings r
    JOIN users u ON u.id = r.user_id
    JOIN songs s ON s.id = r.song_id
    JOIN albums al ON al.id = s.album_id
    LEFT JOIN album_ratings alr ON alr.user_id = r.user_id AND alr.album_id = al.id
    WHERE r.user_id = $1
      AND NOT EXISTS (
          SELECT 1 FROM album_ratings ar
          WHERE ar.user_id = r.user_id AND ar.album_id = al.id AND (ar.untracked = true OR ar.is_draft = true)
      )
    GROUP BY r.user_id, al.id, u.username, u.pfp, al.title, alr.user_id, alr.album_id
    HAVING $3::timestamptz IS NULL
      OR (MAX(r.updated_at), r.user_id, al.id) < ($3::timestamptz, $4::int, $5::int)
    ORDER BY updated_at DESC, r.user_id DESC, al.id DESC
    LIMIT $2`,
    [userId, limit, ...parseCursor(before)]
  );

  return res.rows;
}