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
    const rating = row.ratedSongs > 0 ? Math.pow(row.ratingSum, 2) / row.ratedSongs**1.1 : 0;
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
      (SUM(r.rating) * SUM(r.rating)) / POWER(COUNT(r.rating),1.1) AS "avgRating"
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

/**
 * Get song-level stats for a user: total rated songs, play/good ratio, special rate, top genres
 */
export async function getUserSongStats(userId) {
  // total rated songs and counts by rating
  const countsRes = await pool.query(`
    SELECT
      COUNT(r.rating) FILTER (WHERE r.rating IS NOT NULL) AS total_rated,
      COUNT(r.rating) FILTER (WHERE r.rating IN (1,2)) AS good_play_count,
      COUNT(r.rating) FILTER (WHERE r.rating = 2) AS special_count
    FROM song_ratings r
    WHERE r.user_id = $1
  `, [userId]);

  const { total_rated = 0, good_play_count = 0, special_count = 0 } = countsRes.rows[0] || {};

  // top genres for albums the user has rated (counting album occurrences)
  const genresRes = await pool.query(`
    SELECT g.name, COUNT(DISTINCT a.id) AS cnt
    FROM song_ratings sr
    JOIN songs s ON s.id = sr.song_id
    JOIN albums a ON a.id = s.album_id
    JOIN album_genres ag ON ag.album_id = a.id
    JOIN genres g ON g.id = ag.genre_id
    WHERE sr.user_id = $1
    GROUP BY g.name
    ORDER BY cnt DESC
    LIMIT 3
  `, [userId]);

  const topGenres = genresRes.rows.map(r => ({ name: r.name, count: Number(r.cnt) }));

  return {
    totalRatedSongs: Number(total_rated) || 0,
    goodPlayCount: Number(good_play_count) || 0,
    specialCount: Number(special_count) || 0,
    topGenres
  };
}


/**
 * Variation: include top years for albums the user rated
 */
export async function getUserSongStatsWithYears(userId) {
  const base = await getUserSongStats(userId);

  // compute top 3 decades by distinct albums the user has rated
  const decadesRes = await pool.query(`
    SELECT (FLOOR(EXTRACT(YEAR FROM a.release_date)/10)*10)::int AS decade, COUNT(DISTINCT a.id) AS cnt
    FROM song_ratings sr
    JOIN songs s ON s.id = sr.song_id
    JOIN albums a ON a.id = s.album_id
    WHERE sr.user_id = $1 AND a.release_date IS NOT NULL
    GROUP BY decade
    ORDER BY cnt DESC
    LIMIT 3
  `, [userId]);

  base.topYears = decadesRes.rows.map(r => ({ year: r.decade, count: Number(r.cnt) }));
  // album opinion counts (liked field: 1=good, 0=mid, -1=bad)
  const opinionRes = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE liked = 1) AS good_count,
      COUNT(*) FILTER (WHERE liked IS NOT NULL) AS opinion_total
    FROM album_ratings
    WHERE user_id = $1
  `, [userId]);

  const good = Number(opinionRes.rows[0]?.good_count || 0);
  const totalOpinions = Number(opinionRes.rows[0]?.opinion_total || 0);
  base.albumOpinionPct = totalOpinions > 0 ? good / totalOpinions : null;
  return base;
}