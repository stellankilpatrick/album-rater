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

function activityFeedQuery(mine, profileActivity) {
  const joins = mine || profileActivity
    ? `JOIN users u ON u.id = r.user_id`
    : `JOIN follows f ON f.following_id = r.user_id
       JOIN users u ON u.id = r.user_id`;
  const viewerFilter = mine
    ? "r.user_id = $1"
    : profileActivity
      ? "r.user_id = $2"
      : "f.follower_id = $1";

  return `SELECT
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
    ${joins}
    JOIN songs s ON s.id = r.song_id
    JOIN albums al ON al.id = s.album_id
    LEFT JOIN album_ratings alr ON alr.user_id = r.user_id AND alr.album_id = al.id
    WHERE ${viewerFilter}
      AND (r.rating IS NOT NULL OR r.comment IS NOT NULL)
      AND r.activity_visible = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM album_ratings ar
        WHERE ar.user_id = r.user_id AND ar.album_id = al.id AND (ar.untracked = true OR ar.is_draft = true)
      )
    GROUP BY r.user_id, al.id, u.username, u.pfp, al.title, alr.user_id, alr.album_id`;
}

async function getActivityFeedPage(userId, { limit = 500, before = null, includeRecent = false } = {}, mine, profileUserId = null) {
  const profileActivity = profileUserId !== null;
  const query = activityFeedQuery(mine, profileActivity);
  const filterParams = profileActivity ? [userId, profileUserId] : [userId];
  const cursorParam = profileActivity ? 3 : 2;
  const recentInterval = profileActivity ? "30 days" : "7 days";
  let pageSize = limit;

  if (includeRecent && !before) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM (${query}) AS activities
       WHERE updated_at >= NOW() - INTERVAL '${recentInterval}'`,
      filterParams
    );
    pageSize = Math.max(pageSize, rows[0].count);
  }

  const profileWindowFilter = profileActivity
    ? "updated_at >= NOW() - INTERVAL '30 days' AND "
    : "";
  const res = await pool.query(
    `SELECT * FROM (${query}) AS activities
     WHERE ${profileWindowFilter}(
       $${cursorParam}::timestamptz IS NULL
       OR (updated_at, user_id, album_id) < ($${cursorParam}::timestamptz, $${cursorParam + 1}::int, $${cursorParam + 2}::int)
     )
     ORDER BY updated_at DESC, user_id DESC, album_id DESC
     LIMIT $${cursorParam + 3}`,
    [...filterParams, ...parseCursor(before), pageSize + 1]
  );

  return {
    items: res.rows.slice(0, pageSize),
    hasMore: res.rows.length > pageSize,
  };
}

export async function getCommunityFeed(userId, options) {
  return getActivityFeedPage(userId, options, false);
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

export async function getMyActivityFeed(userId, options) {
  return getActivityFeedPage(userId, options, true);
}

export async function getProfileActivityFeed(viewerId, profileUserId, options) {
  return getActivityFeedPage(viewerId, options, false, profileUserId);
}