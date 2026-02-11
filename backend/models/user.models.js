import db from "../db/database.js";

/**
 * For user profile page
 * @param {*} userId 
 * @returns top 5 artists ranked by total album score
 */
export function getTopArtists(userId) {
  return db.prepare(`
    SELECT
      ar.id,
      ar.name,
      ar.image,
      SUM(albumScores.albumScore) AS totalRating,
      COUNT(albumScores.albumId) AS ratingCount
    FROM (
      SELECT
        a.id AS albumId,
        a.artist_id,
        a.cover_art AS coverArt,
        (SUM(r.rating) * SUM(r.rating)) / COUNT(r.rating) AS albumScore
      FROM song_ratings r
      JOIN songs s ON s.id = r.song_id
      JOIN albums a ON a.id = s.album_id
      WHERE r.user_id = ?
      GROUP BY a.id
    ) albumScores
    JOIN artists ar ON ar.id = albumScores.artist_id
    GROUP BY ar.id
    ORDER BY totalRating DESC
    LIMIT 5
  `).all(userId);
}

/**
 * For the user profile page
 * @param {*} userId 
 * @returns top 5 albums ranked by score
 */
export function getTopAlbums(userId) {
  return db.prepare(`
    SELECT
      a.id,
      a.title,
      a.cover_art AS coverArt,
      (SUM(r.rating) * SUM(r.rating)) / COUNT(r.rating) AS avgRating
    FROM song_ratings r
    JOIN songs s ON s.id = r.song_id
    JOIN albums a ON a.id = s.album_id
    WHERE r.user_id = ?
    GROUP BY a.id
    ORDER BY avgRating DESC
    LIMIT 5
  `).all(userId);
}

export function getUserRatedArtists(userId) {
  return db.prepare(`
    SELECT DISTINCT
      ar.id,
      ar.name
    FROM song_ratings sr
    JOIN songs s ON s.id = sr.song_id
    JOIN albums a ON a.id = s.album_id
    JOIN artists ar ON ar.id = a.artist_id
    WHERE sr.user_id = ?
    ORDER BY ar.name
  `).all(userId);
}

export function deleteUserAlbumRating(userId, albumId) {
  const tx = db.transaction(() => {
    // delete song ratings for songs in this album
    db.prepare(`
      DELETE FROM song_ratings
      WHERE user_id = ?
        AND song_id IN (
          SELECT id FROM songs WHERE album_id = ?
        )
    `).run(userId, albumId);
  });

  tx();
}

/**
 * Follow user
 * @param {*} followerId userId of current user
 * @param {*} followingId userId of user you are gonna follow
 * @returns 
 */
export function followUser(followerId, followingId) {
  if (followerId == followingId) return;

  return db.prepare(`
    INSERT OR IGNORE INTO follows (follower_id, following_id)
    VALUES (?, ?)
    `).run(followerId, followingId);
}

export function unfollowUser(followerId, followingId) {
  return db.prepare(`
    DELETE FROM follows
    WHERE follower_id = ? AND following_id = ?
    `).run(followerId, followingId);
}

/**
 * Who I follow
 * @param {*} userId 
 * @returns 
 */
export function getFollowing(userId) {
  return db.prepare(`
    SELECT u.id, u.username
    FROM follows f
    JOIN users u ON u.id = f.following_id
    WHERE f.follower_id = ?
    ORDER BY u.username
    `).all(userId);
}

export function getFollowers(userId) {
  return db.prepare(`
    SELECT u.id, u.username
    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.following_id = ?
    ORDER BY u.username
    `).all(userId);
}

/* Mutuals (friends) */
export function getFriends(userId) {
  return db.prepare(`
    SELECT u.id, u.username
    FROM follows f1
    JOIN follows f2
      ON f1.following_id = f2.follower_id
     AND f1.follower_id = f2.following_id
    JOIN users u ON u.id = f1.following_id
    WHERE f1.follower_id = ?
    ORDER BY u.username
  `).all(userId);
}

/* Is following? (for button state) */
export function isFollowing(followerId, followingId) {
  return db.prepare(`
    SELECT 1
    FROM follows
    WHERE follower_id = ? AND following_id = ?
  `).get(followerId, followingId);
}

export function getFollowCounts(userId) {
  const row = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers,
        (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following
    `).get(userId, userId);

  return row;
}

export function getRatingCounts(userId) {
  return db.prepare(`
    SELECT
      COUNT(DISTINCT a.id) AS albums,
      COUNT(DISTINCT ar.id) AS artists
    FROM song_ratings r
    JOIN songs s ON s.id = r.song_id
    JOIN albums a ON a.id = s.album_id
    JOIN artists ar ON ar.id = a.artist_id
    WHERE r.user_id = ?
  `).get(userId);
}

const DEFAULT_PFP = "https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg"

export function getProfilePic(username) {
  const user = db.prepare(`
    SELECT pfp FROM users WHERE username = ?
  `).get(username);
  
  return user?.pfp || DEFAULT_PFP;
  }