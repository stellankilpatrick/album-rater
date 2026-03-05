import express from "express";
import pool from "../db/database.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json({ albums: [], artists: [], users: [] });

    const like = `%${q}%`;

    const albumsPromise = pool.query(`
      SELECT a.id, a.title, STRING_AGG(ar.name, ' & ' ORDER BY ar.name) AS artist
      FROM albums a
      JOIN album_artists aa ON aa.album_id = a.id
      JOIN artists ar ON ar.id = aa.artist_id
      WHERE a.title ILIKE $1
      GROUP BY a.id
      LIMIT 10
    `, [like]);

    const artistsPromise = pool.query(`
      SELECT id, name
      FROM artists
      WHERE name ILIKE $1
      LIMIT 10
    `, [like]);

    const usersPromise = pool.query(`
      SELECT id, username
      FROM users
      WHERE username ILIKE $1
      LIMIT 10
    `, [like]);

    const [albumsRes, artistsRes, usersRes] = await Promise.all([
      albumsPromise,
      artistsPromise,
      usersPromise
    ]);

    res.json({
      albums: albumsRes.rows,
      artists: artistsRes.rows,
      users: usersRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;