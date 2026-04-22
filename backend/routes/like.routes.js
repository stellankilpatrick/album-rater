import express from "express";
import pool from "../db/database.js";
import { requireAuth } from "../auth/auth.middleware.js";

const router = express.Router();

// noti helper funct
async function createNotification(pool, { userId, type, fromUserId, albumId, message }) {
  if (userId === fromUserId) return; // never notify yourself
  await pool.query(
    `INSERT INTO notifications (user_id, type, from_user_id, album_id, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, fromUserId, albumId ?? null, message]
  );
}

async function getLikeCount(targetType, targetId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS count FROM likes WHERE target_type = $1 AND target_id = $2`,
    [targetType, targetId]
  );
  return Number(rows[0].count);
}

async function getOwner(targetType, targetId) {
  if (targetType === "album_review") {
    const { rows } = await pool.query(
      `SELECT ar.user_id, ar.album_id AS "albumId", a.title FROM album_ratings ar
     JOIN albums a ON a.id = ar.album_id
     WHERE ar.id = $1`,
      [targetId]
    );
    return rows[0] ?? null;
  } else if (targetType === "review_comment") {
    const { rows } = await pool.query(
      `SELECT c.user_id, a.title FROM album_review_comments c
       JOIN albums a ON a.id = c.album_id
       WHERE c.id = $1`,
      [targetId]
    );
    return rows[0] ?? null;
  } else if (targetType === "song_comment") {
    const { rows } = await pool.query(
      `SELECT sr.user_id, s.title FROM song_ratings sr
       JOIN songs s ON s.id = sr.song_id
       WHERE sr.song_id = $1`,
      [targetId]
    );
    return rows[0] ?? null;
  }
  return null;
}

router.post("/", requireAuth, async (req, res) => {
  const { targetType, targetId } = req.body;
  if (!["album_review", "review_comment", "song_comment"].includes(targetType)) {
    return res.status(400).json({ error: "Invalid target type" });
  }

  try {
    const owner = await getOwner(targetType, targetId);

    // prevent liking your own stuff
    if (owner?.user_id === req.user.id) {
      return res.status(403).json({ error: "Cannot like your own content" });
    }

    await pool.query(
      `INSERT INTO likes (user_id, target_type, target_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [req.user.id, targetType, targetId]
    );

    if (owner && owner.user_id !== req.user.id) {
      const message = targetType === "album_review"
        ? `${req.user.username} liked your review of ${owner.title}`
        : `${req.user.username} liked your comment`;

      await createNotification(pool, {
        userId: owner.user_id,
        type: "like",
        fromUserId: req.user.id,
        albumId: targetType === "album_review" ? owner.albumId : null,
        message
      });
    }

    res.json({ count: await getLikeCount(targetType, targetId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to like" });
  }
});

router.delete("/", requireAuth, async (req, res) => {
  const { targetType, targetId } = req.body;
  try {
    await pool.query(
      `DELETE FROM likes WHERE user_id = $1 AND target_type = $2 AND target_id = $3`,
      [req.user.id, targetType, targetId]
    );
    res.json({ count: await getLikeCount(targetType, targetId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unlike" });
  }
});

router.get("/status", requireAuth, async (req, res) => {
  const { targetType, targetId } = req.query;
  try {
    const count = await getLikeCount(targetType, targetId);
    const { rows } = await pool.query(
      `SELECT 1 FROM likes WHERE user_id = $1 AND target_type = $2 AND target_id = $3`,
      [req.user.id, targetType, targetId]
    );
    res.json({ count, likedByMe: rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: "Failed to get like status" });
  }
});

export default router;