import express from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { getTopAlbums, getTopArtists } from "../models/user.models.js";
import {
  followUser,
  unfollowUser,
  getFollowers, getFollowing, getFriends, isFollowing,
  getFollowCounts, getRatingCounts, getProfilePic
} from "../models/user.models.js";
import pool from "../db/database.js";

const router = express.Router();

router.param("username", async (req, res, next, username) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, username FROM users WHERE username = $1`,
      [username]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    req.profileUser = user;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------
// Top albums/artists
// ---------------------
router.get("/:username/top-albums", requireAuth, async (req, res) => {
  res.json(await getTopAlbums(req.profileUser.id));
});

router.get("/:username/top-artists", requireAuth, async (req, res) => {
  res.json(await getTopArtists(req.profileUser.id));
});

// ---------------------
// Follow/unfollow
// ---------------------
router.post("/:username/follow", requireAuth, async (req, res) => {
  const followerId = req.user.id;
  const followingId = req.profileUser.id;
  if (followerId === followingId) return res.status(400).json({ error: "Cannot follow yourself" });

  await followUser(followerId, followingId);
  res.json({ success: true });
});

router.delete("/:username/follow", requireAuth, async (req, res) => {
  await unfollowUser(req.user.id, req.profileUser.id);
  res.json({ success: true });
});

// ---------------------
// Profile picture
// ---------------------
router.get("/:username/pfp", async (req, res) => {
  try {
    const pfp = await getProfilePic(req.profileUser.username);
    res.json({ pfp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:username/pfp", requireAuth, async (req, res) => {
  const { username } = req.params;
  const { pfp } = req.body;
  if (req.user.username !== username) return res.status(403).json({ error: "Forbidden" });
  if (!pfp || typeof pfp !== "string") return res.status(400).json({ error: "Invalid pfp URL" });

  try {
    await pool.query(`UPDATE users SET pfp = $1 WHERE username = $2`, [pfp, username]);
    res.json({ success: true, pfp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile picture" });
  }
});

// ---------------------
// Followers / Following / Friends / Follow status
// ---------------------
router.get("/:username/followers", async (req, res) => {
  res.json(await getFollowers(req.profileUser.id));
});

router.get("/:username/following", async (req, res) => {
  res.json(await getFollowing(req.profileUser.id));
});

router.get("/:username/friends", async (req, res) => {
  res.json(await getFriends(req.profileUser.id));
});

router.get("/:username/is-following", requireAuth, async (req, res) => {
  const row = await isFollowing(req.user.id, req.profileUser.id);
  res.json({ isFollowing: !!row });
});

router.get("/:username/follow-counts", async (req, res) => {
  res.json(await getFollowCounts(req.profileUser.id));
});

router.get("/:username/rating-counts", async (req, res) => {
  res.json(await getRatingCounts(req.profileUser.id));
});

// ---------------------
// Listen list
// ---------------------
router.post("/:username/listen-list/:albumId", requireAuth, async (req, res) => {
  const userId = req.profileUser.id;
  const albumId = req.params.albumId;

  try {
    await pool.query(
      `INSERT INTO listen_list (user_id, album_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, albumId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add album to listen list" });
  }
});

router.delete("/:username/listen-list/:albumId", requireAuth, async (req, res) => {
  const userId = req.profileUser.id;
  const albumId = req.params.albumId;

  try {
    await pool.query(
      `DELETE FROM listen_list WHERE user_id = $1 AND album_id = $2`,
      [userId, albumId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove album from listen list" });
  }
});

router.get("/:username/listen-list", requireAuth, async (req, res) => {
  const userId = req.profileUser.id;

  try {
    const { rows: albums } = await pool.query(
      `SELECT a.id, a.title, a.cover_art,
        ARRAY_AGG(ar.id ORDER BY ar.name) AS "artistIds",
        STRING_AGG(ar.name, ', ' ORDER BY ar.name) AS artist
       FROM listen_list ll
       JOIN albums a ON a.id = ll.album_id
       JOIN album_artists aa ON aa.album_id = a.id
       JOIN artists ar ON ar.id = aa.artist_id
       WHERE ll.user_id = $1
       GROUP BY a.id
       ORDER BY ll.added_at DESC`,
      [userId]
    );
    res.json(albums.map(a => ({ ...a, artistId: a.artistIds[0] })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch listen list" });
  }
});

export default router;