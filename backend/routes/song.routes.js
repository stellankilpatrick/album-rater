import express from "express";
import pool from "../db/database.js";
import { requireAuth } from "../auth/auth.middleware.js";
import { getAlbumById, updateAlbumRatingForUser, syncUserScore10s } from "../models/album.models.js";
import { updateSongComment } from "../models/song.models.js";

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

// noti helper funct
async function createNotification(pool, { userId, type, fromUserId, albumId, message }) {
  if (userId === fromUserId) return; // never notify yourself
  await pool.query(
    `INSERT INTO notifications (user_id, type, from_user_id, album_id, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, fromUserId, albumId ?? null, message]
  );
}

// ---------------------
// CREATE SONG
// ---------------------
router.post("/:id", requireAuth, async (req, res) => {
  const { title, num } = req.body;
  const albumId = req.params.id;

  if (!title || !num) return res.status(400).json({ error: "Missing title or track number" });

  try {
    const { rows: albumRows } = await pool.query(
      `SELECT * FROM albums WHERE id = $1`,
      [albumId]
    );
    const album = albumRows[0];
    if (!album) return res.status(404).json({ error: "Album not found" });

    await pool.query(
      `INSERT INTO songs (album_id, title, track_number) VALUES ($1, $2, $3)`,
      [albumId, title, num]
    );

    const { rows: songs } = await pool.query(
      `SELECT id, title, track_number AS num FROM songs WHERE album_id = $1 ORDER BY track_number`,
      [albumId]
    );

    res.json(songs[songs.length - 1]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add song" });
  }
});

// ---------------------
// UPDATE SONG TITLE
// ---------------------
router.patch("/:id/title", requireAuth, async (req, res) => {
  const songId = req.params.id;
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Title cannot be empty" });

  try {
    const result = await pool.query(
      `UPDATE songs SET title = $1 WHERE id = $2 RETURNING id, title, track_number AS num`,
      [title, songId]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: "Song not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update song title" });
  }
});

// ---------------------
// RATE SONG
// ---------------------
router.patch("/:songId/rating", requireAuth, async (req, res) => {
  try {
    const songId = req.params.songId;
    let { rating } = req.body;

    if (rating !== null && ![0, 1, 2].includes(rating)) {
      return res.status(400).json({ error: "Rating must be 0, 1, 2, or null" });
    }

    if (rating === null) {
      await pool.query(
        `DELETE FROM song_ratings WHERE song_id = $1 AND user_id = $2`,
        [songId, req.user.id]
      );
    } else {
      await pool.query(
        `INSERT INTO song_ratings (song_id, user_id, rating)
         VALUES ($1, $2, $3)
         ON CONFLICT (song_id, user_id)
         DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()`,
        [songId, req.user.id, rating]
      );
    }

    const { rows: songRows } = await pool.query(
      `SELECT album_id FROM songs WHERE id = $1`,
      [songId]
    );
    if (!songRows[0]) return res.status(404).json({ error: "Song not found" });

    const albumId = songRows[0].album_id;

    // sync album_ratings
    await updateAlbumRatingForUser(req.user.id, songRows[0].album_id);

    await syncUserScore10s(req.user.id);

    // notify anyone who recommended this album to this user
    const { rows: recRows } = await pool.query(
      `SELECT r.from_user_id, a.title
   FROM recommendations r
   JOIN albums a ON a.id = r.album_id
   WHERE r.to_user_id = $1 AND r.album_id = $2`,
      [req.user.id, albumId] // use the correct albumId variable for each route
    );
    for (const rec of recRows) {
      await createNotification(pool, {
        userId: rec.from_user_id,
        type: "recommendation_rated",
        fromUserId: req.user.id,
        albumId,
        message: `${req.user.username} rated ${rec.title}, which you recommended to them`
      });
    }

    const album = await getAlbumById(songRows[0].album_id);
    res.json({ success: true, albumRating: album.rating });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to rate song" });
  }
});

// ---------------------
// UPDATE TRACK NUMBER
// ---------------------
router.patch("/:songId/num", requireAuth, async (req, res) => {
  try {
    const songId = req.params.songId;
    let { num } = req.body;

    if (num === undefined || num === null || isNaN(Number(num)) || Number(num) < 1) {
      return res.status(400).json({ error: "Track number must be a positive integer" });
    }
    num = Number(num);

    const result = await pool.query(
      `UPDATE songs SET track_number = $1 WHERE id = $2 RETURNING *`,
      [num, songId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Song not found" });

    res.json({ success: true, song: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update track number" });
  }
});

// ---------------------
// DELETE SONG
// ---------------------
router.delete("/:songId", requireAuth, async (req, res) => {
  const songId = req.params.songId;

  try {
    await pool.query(`DELETE FROM songs WHERE id = $1`, [songId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete song" });
  }
});

// update song comment
router.patch("/:songId/comment", requireAuth, async (req, res) => {
  try {
    const { comment } = req.body;
    const result = await updateSongComment(req.user.id, req.params.songId, comment);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update comment" });
  }
});

export default router;