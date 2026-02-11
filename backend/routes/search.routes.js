import express from "express";
import db from "../db/database.js";

const router = express.Router();

router.get("/", (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.json({ albums: [], artists: [], users: [] });

  const like = `%${q}%`;

  const albums = db.prepare(`
    SELECT albums.id, albums.title, artists.name AS artist
    FROM albums
    JOIN artists ON albums.artist_id = artists.id
    WHERE albums.title LIKE ?
    LIMIT 10
  `).all(like);

  const artists = db.prepare(`
    SELECT id, name
    FROM artists
    WHERE name LIKE ?
    LIMIT 10
  `).all(like);

  const users = db.prepare(`
    SELECT id, username
    FROM users
    WHERE username LIKE ?
    LIMIT 10
  `).all(like);

  res.json({ albums, artists, users });
});

export default router;