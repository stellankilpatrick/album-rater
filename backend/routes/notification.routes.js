import express from "express";
import pool from "../db/database.js";
import { requireAuth } from "../auth/auth.middleware.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.*, u.username AS from_username, u.pfp AS from_pfp
       FROM notifications n
       LEFT JOIN users u ON u.id = n.from_user_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

router.patch("/read-all", requireAuth, async (req, res) => {
  try {
    await pool.query(`UPDATE notifications SET read = TRUE WHERE user_id = $1`, [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM notifications WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

export default router;