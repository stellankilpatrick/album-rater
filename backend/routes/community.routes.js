import express from "express";
import { getAnniversaryAlbums, getCommunityFeed } from "../models/community.models.js";
import { requireAuth } from "../auth/auth.middleware.js";
import pool from "../db/database.js";

const router = express.Router();

// noti helper function
async function createNotification(pool, { userId, type, fromUserId, albumId, message }) {
  if (userId === fromUserId) return; // never notify yourself
  await pool.query(
    `INSERT INTO notifications (user_id, type, from_user_id, album_id, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, fromUserId, albumId ?? null, message]
  );
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const feed = await getCommunityFeed(req.user.id);
    res.json(feed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

router.get("/albums", requireAuth, async (req, res) => {
  try {
    const albums = await getAnniversaryAlbums(req.user.id);

    res.json(albums);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch anniversary albums" });
  }
});

// GET /recommendations/received — grouped by sender
router.get("/recommendations/received", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.from_user_id, u.username AS from_username,
              r.album_id, a.title AS album_title, a.cover_art
       FROM recommendations r
       JOIN users u ON u.id = r.from_user_id
       JOIN albums a ON a.id = r.album_id
       WHERE r.to_user_id = $1
       ORDER BY u.username, r.created_at DESC`,
      [req.user.id]
    );

    // group by sender
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.from_user_id]) {
        grouped[row.from_user_id] = { username: row.from_username, albums: [] };
      }
      grouped[row.from_user_id].albums.push({
        recId: row.id,
        albumId: row.album_id,
        title: row.album_title,
        coverArt: row.cover_art,
      });
    }

    res.json(Object.values(grouped));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get recommendations" });
  }
});

// GET recommendations sent
router.get("/recommendations/sent", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.to_user_id, u.username AS to_username,
              r.album_id, a.title AS album_title, a.cover_art
       FROM recommendations r
       JOIN users u ON u.id = r.to_user_id
       JOIN albums a ON a.id = r.album_id
       WHERE r.from_user_id = $1
       ORDER BY u.username, r.created_at DESC`,
      [req.user.id]
    );

    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.to_user_id]) {
        grouped[row.to_user_id] = { username: row.to_username, albums: [] };
      }
      grouped[row.to_user_id].albums.push({
        recId: row.id,
        albumId: row.album_id,
        title: row.album_title,
        coverArt: row.cover_art,
      });
    }

    res.json(Object.values(grouped));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get sent recommendations" });
  }
});

// POST /recommendations — send a recommendation
router.post("/recommendations", requireAuth, async (req, res) => {
  const { toUsername, albumId } = req.body;
  try {

    // look up the user first
    const { rows: userRows } = await pool.query(
      `SELECT id FROM users WHERE username = $1`, [toUsername]
    );
    if (!userRows[0]) return res.status(404).json({ error: "User not found" });
    const toUserId = userRows[0].id;

    // check mutual follow
    const { rows: mutual } = await pool.query(
      `SELECT 1 FROM follows f1
       JOIN follows f2 ON f2.follower_id = $2 AND f2.following_id = $1
       WHERE f1.follower_id = $1 AND f1.following_id = $2`,
      [req.user.id, toUserId]
    );
    if (!mutual.length) return res.status(403).json({ error: "You must be mutual followers" });

    await pool.query(
      `INSERT INTO recommendations (from_user_id, to_user_id, album_id)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [req.user.id, toUserId, albumId]
    );

    // after inserting the recommendation
    const { rows: albumRows } = await pool.query(`SELECT title FROM albums WHERE id = $1`, [albumId]);
    await createNotification(pool, {
      userId: toUserId,
      type: "recommendation",
      fromUserId: req.user.id,
      albumId: Number(albumId),
      message: `${req.user.username} recommended ${albumRows[0].title} to you`
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send recommendation" });
  }
});

// DELETE /recommendations/:id — dismiss
router.delete("/recommendations/:id", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM recommendations WHERE id = $1 AND (to_user_id = $2 OR from_user_id = $2)`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete recommendation" });
  }
});

export default router;