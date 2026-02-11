import express from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { getTopAlbums, getTopArtists } from "../models/user.models.js";
import {
  followUser,
  unfollowUser,
  getFollowers, getFollowing, getFriends, isFollowing,
  getFollowCounts, getRatingCounts, getProfilePic
} from "../models/user.models.js";
import db from "../db/database.js";

const router = express.Router();

router.param("username", (req, res, next, username) => {
  const user = db
    .prepare(`SELECT id, username FROM users WHERE username = ?`)
    .get(username);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  req.profileUser = user; // attach once
  next();
});

router.get("/:username/top-albums", requireAuth, async (req, res) => {
  res.json(getTopAlbums(req.profileUser.id));
});

router.get("/:username/top-artists", requireAuth, (req, res) => {
  res.json(getTopArtists(req.profileUser.id));
});

// follow
router.post("/:username/follow", requireAuth, (req, res) => {
  const followerId = req.user.id;
  const followingId = req.profileUser.id;

  if (followerId === followingId) {
    return res.status(400).json({ error: "Cannot follow yourself" });
  }

  followUser(followerId, followingId);
  res.json({ success: true });
});

/* Unfollow */
router.delete("/:username/follow", requireAuth, (req, res) => {
  unfollowUser(req.user.id, req.profileUser.id);
  res.json({ success: true });
});

/* profile picture */
router.get("/:username/pfp", requireAuth, (req, res) => {
  const { username } = req.params;

  try {
    res.json({ pfp: getProfilePic(username) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:username/pfp", requireAuth, (req, res) => {
  const { username } = req.params;
  const { pfp } = req.body;

  // only allow editing your own pfp
  if (req.user.username !== username) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!pfp || typeof pfp !== "string") {
    return res.status(400).json({ error: "Invalid pfp URL" });
  }

  db.prepare(`
    UPDATE users SET pfp = ? WHERE username = ?
  `).run(pfp, username);

  res.json({ success: true, pfp });
});

/* Followers */
router.get("/:username/followers", (req, res) => {
  res.json(getFollowers(req.profileUser.id));
});

/* Following */
router.get("/:username/following", (req, res) => {
  res.json(getFollowing(req.profileUser.id));
});

/* Friends */
router.get("/:username/friends", (req, res) => {
  res.json(getFriends(req.profileUser.id));
});

/* Follow status */
router.get("/:username/is-following", requireAuth, (req, res) => {
  const row = isFollowing(req.user.id, req.profileUser.id);
  res.json({ isFollowing: !!row });
});

/**Follow counts */
router.get("/:username/follow-counts", (req, res) => {
  res.json(getFollowCounts(req.profileUser.id));
});

/**Albums and artists rated count */
router.get("/:username/rating-counts", (req, res) => {
  res.json(getRatingCounts(req.profileUser.id));
});

// add album to listen list
router.post("/:username/listen-list/:albumId", requireAuth, (req, res) => {
  const userId = req.profileUser.id;
  const { albumId } = req.params;

  try {
    db.prepare(`
      INSERT OR IGNORE INTO listen_list (user_id, album_id)
      VALUES (?, ?)
    `).run(userId, albumId);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add album to listen list" });
  }
});

// remove album from listen list
router.delete("/:username/listen-list/:albumId", requireAuth, (req, res) => {
  const userId = req.profileUser.id;
  const { albumId } = req.params;

  try {
    db.prepare(`
      DELETE FROM listen_list
      WHERE user_id = ? AND album_id = ?
    `).run(userId, albumId);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove album from listen list" });
  }
});

// get listen list
router.get("/:username/listen-list", requireAuth, (req, res) => {
  const userId = req.profileUser.id;

  try {
    const albums = db.prepare(`
      SELECT a.id, a.title, a.cover_art, ar.id AS artistId, ar.name AS artist
      FROM listen_list ll
      JOIN albums a ON a.id = ll.album_id
      JOIN artists ar ON ar.id = a.artist_id
      WHERE ll.user_id = ?
      ORDER BY ll.added_at DESC
    `).all(userId);

    res.json(albums);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch listen list" });
  }
});

export default router;