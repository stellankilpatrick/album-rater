import pool from "../db/database.js";

const DEFAULT_PFP = "https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg";

/**
 * For user profile page - top 5 artists by total album score
 */
export async function getTopArtists(userId) {
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

  const artistMap = new Map();
  for (const row of res.rows) {
    if (!artistMap.has(row.id)) {
      artistMap.set(row.id, { id: row.id, name: row.name, image: row.image, albums: [] });
    }
    const rating = row.ratedSongs > 0 ? Math.pow(row.ratingSum, 2) / row.ratedSongs : 0;
    artistMap.get(row.id).albums.push(rating);
  }

  return Array.from(artistMap.values()).map(artist => {
    const sorted = artist.albums.slice().sort((a, b) => b - a);
    const totalScore = sorted.reduce((sum, rating, i) => sum + rating * Math.pow(0.85, i), 0);
    return {
      id: artist.id,
      name: artist.name,
      image: artist.image,
      ratingCount: artist.albums.length,
      totalRating: totalScore
    };
  })
  .sort((a, b) => b.totalRating - a.totalRating)
  .slice(0, 5);
}

/**
 * Top 5 albums by score
 */
export async function getTopAlbums(userId) {
  const { rows } = await pool.query(`
    SELECT
      a.id,
      a.title,
      a.cover_art AS "coverArt",
      (SUM(r.rating) * SUM(r.rating)) / COUNT(r.rating) AS "avgRating"
    FROM song_ratings r
    JOIN songs s ON s.id = r.song_id
    JOIN albums a ON a.id = s.album_id
    WHERE r.user_id = $1
    GROUP BY a.id
    ORDER BY "avgRating" DESC
    LIMIT 5
  `, [userId]);
  return rows;
}

/**
 * Get all artists a user has rated
 */
export async function getUserRatedArtists(userId) {
  const { rows } = await pool.query(`
    SELECT DISTINCT
      ar.id,
      ar.name
    FROM song_ratings sr
    JOIN songs s ON s.id = sr.song_id
    JOIN albums a ON a.id = s.album_id
    JOIN album_artists aa ON aa.album_id = a.id
    JOIN artists ar ON ar.id = aa.artist_id
    WHERE sr.user_id = $1
    ORDER BY ar.name
  `, [userId]);
  return rows;
}

/**
 * Delete all song ratings for a user's album
 */
export async function deleteUserAlbumRating(userId, albumId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      DELETE FROM song_ratings
      WHERE user_id = $1
        AND song_id IN (
          SELECT id FROM songs WHERE album_id = $2
        )
    `, [userId, albumId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Follow/unfollow users
 */
export async function followUser(followerId, followingId) {
  if (followerId === followingId) return;
  await pool.query(`
    INSERT INTO follows (follower_id, following_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
  `, [followerId, followingId]);
}

export async function unfollowUser(followerId, followingId) {
  await pool.query(`
    DELETE FROM follows
    WHERE follower_id = $1 AND following_id = $2
  `, [followerId, followingId]);
}

/**
 * Who a user is following
 */
export async function getFollowing(userId) {
  const { rows } = await pool.query(`
    SELECT u.id, u.username
    FROM follows f
    JOIN users u ON u.id = f.following_id
    WHERE f.follower_id = $1
    ORDER BY u.username
  `, [userId]);
  return rows;
}

export async function getFollowers(userId) {
  const { rows } = await pool.query(`
    SELECT u.id, u.username
    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.following_id = $1
    ORDER BY u.username
  `, [userId]);
  return rows;
}

/* Mutuals/friends */
export async function getFriends(userId) {
  const { rows } = await pool.query(`
    SELECT u.id, u.username
    FROM follows f1
    JOIN follows f2
      ON f1.following_id = f2.follower_id
     AND f1.follower_id = f2.following_id
    JOIN users u ON u.id = f1.following_id
    WHERE f1.follower_id = $1
    ORDER BY u.username
  `, [userId]);
  return rows;
}

/* Is following? */
export async function isFollowing(followerId, followingId) {
  const { rows } = await pool.query(`
    SELECT 1 FROM follows
    WHERE follower_id = $1 AND following_id = $2
  `, [followerId, followingId]);
  return rows.length > 0;
}

export async function getFollowCounts(userId) {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM follows WHERE following_id = $1) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = $1) AS following
  `, [userId]);
  return rows[0];
}

export async function getRatingCounts(userId) {
  const { rows } = await pool.query(`
    SELECT
      COUNT(DISTINCT a.id) AS albums,
      COUNT(DISTINCT ar.id) AS artists
    FROM song_ratings r
    JOIN songs s ON s.id = r.song_id
    JOIN albums a ON a.id = s.album_id
    JOIN album_artists aa ON aa.album_id = a.id
    JOIN artists ar ON ar.id = aa.artist_id
    WHERE r.user_id = $1
  `, [userId]);
  return rows[0];
}

/* Profile picture */
export async function getProfilePic(username) {
  const { rows } = await pool.query(`
    SELECT pfp FROM users WHERE username = $1
  `, [username]);
  return rows[0]?.pfp || DEFAULT_PFP;
}