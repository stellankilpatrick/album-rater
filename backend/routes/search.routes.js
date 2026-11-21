import express from "express";
import pool from "../db/database.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json({ albums: [], artists: [], users: [] });

    const terms = q.split(/\s+/).map(term => `%${term}%`);
    const like = `%${q}%`;

    const albumsPromise = pool.query(`
      SELECT a.id, a.title, STRING_AGG(ar.name, ' & ' ORDER BY ar.name) AS artist
      FROM albums a
      JOIN album_artists aa ON aa.album_id = a.id
      JOIN artists ar ON ar.id = aa.artist_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM unnest($1::text[]) AS search_term(pattern)
        WHERE a.title NOT ILIKE search_term.pattern
          AND NOT EXISTS (
            SELECT 1
            FROM album_artists term_aa
            JOIN artists term_ar ON term_ar.id = term_aa.artist_id
            WHERE term_aa.album_id = a.id
              AND term_ar.name ILIKE search_term.pattern
          )
      )
      GROUP BY a.id
      LIMIT 10
    `, [terms]);

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