import db from "../db/database.js";
import express from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { addSongsToAlbum, rateSong, updateSong, deleteSong } from "../models/song.models.js";
import { getAlbumById } from "../models/album.models.js";

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

// ===============================
// CREATE SONG IN ALBUM (linked to user)
// ===============================
router.post("/:id", requireAuth, async (req, res) => {
    const { title, num } = req.body;
    const albumId = req.params.id;

    if (!title || !num) {
        return res.status(400).json({ error: "Missing title or track number" });
    }

    const album = await addSongsToAlbum(albumId, [{ title, num }]);
    res.json(album.songs[album.songs.length - 1]);
});

// ---------------------
// Rating routes
// ---------------------

// Patch a song title
router.patch("/:id/title", requireAuth, async (req, res) => {
    const songId = req.params.id;
    const { title } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({ error: "Title cannot be empty" });
    }

    try {
        // update song in database
        const result = db.prepare("UPDATE songs SET title = ? WHERE id = ?").run(title, songId);

        if (result.changes === 0) return res.status(404).json({ error: "Song not found" });

        // Assuming you have updateSongTitleFunction
        const updatedSong = updateSong(songId, { title });
        res.json(updatedSong)
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update song title" });
    }
});

// Patch a song rating
router.patch("/:songId/rating", requireAuth, async (req, res) => {
    try {
        let { rating } = req.body;
        const songId = req.params.songId;

        // allow null, 0, 1, or 2
        if (rating !== null && ![0, 1, 2].includes(rating)) {
            return res.status(400).json({ error: "Rating must be 0, 1, 2, or null" });
        }

        // updateSong / delete if null
        if (rating === null) {
            db.prepare(
                `DELETE FROM song_ratings WHERE song_id = ? AND user_id = ?`
            ).run(songId, req.user.id);
        } else {
            // upsert rating
            db.prepare(
                `INSERT INTO song_ratings (song_id, user_id, rating)
                 VALUES (?, ?, ?)
                 ON CONFLICT(song_id, user_id) DO UPDATE SET rating=excluded.rating`
            ).run(songId, req.user.id, rating);
        }

        // find album id for song
        const song = db.prepare("SELECT album_id FROM songs WHERE id = ?").get(songId);
        if (!song) return res.status(404).json({ error: "Song not found" });

        const album = getAlbumById(song.album_id);
        res.json({ success: true, albumRating: album.rating });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to rate song" });
    }
});

// Patch a song track number
router.patch("/:songId/num", requireAuth, async (req, res) => {
    try {
        const songId = req.params.songId;
        let { num } = req.body;

        // Validate num
        if (num === undefined || num === null || isNaN(Number(num)) || Number(num) < 1) {
            return res.status(400).json({ error: "Track number must be a positive integer" });
        }
        num = Number(num);

        // Update the song in the database
        const result = db.prepare("UPDATE songs SET track_number = ? WHERE id = ?").run(num, songId);
        if (result.changes === 0) return res.status(404).json({ error: "Song not found" });

        // Return updated song object
        const updatedSong = db.prepare("SELECT * FROM songs WHERE id = ?").get(songId);
        res.json({ success: true, song: updatedSong });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update track number" });
    }
});

router.delete("/:songId", requireAuth, async (req, res) => {
    const { songId } = req.params;

    try {
        deleteSong(songId);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete song"});
    }
})

export default router;