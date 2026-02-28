import { requireAuth } from "../auth/auth.middleware.js";
import { Router } from "express";
import {
  getArtistAlbumsWithTotal, getAllRatedArtists, getUserArtistStats,
  getUserRatedAlbumsByArtist, attachUserAlbumStats
} from "../models/artist.models.js";
import pool from "../db/database.js";

const router = Router();

router.param("username", async (req, res, next, username) => {
  try {
    const userRes = await pool.query(
      `SELECT id, username FROM users WHERE username = $1`,
      [username]
    );

    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    req.profileUser = user;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load user" });
  }
});

//////////////////////////////////////////////////////////////////////
// PUBLIC ROUTES
//////////////////////////////////////////////////////////////////////

router.get("/", requireAuth, async (req, res) => {
  try {
    const artists = await getAllRatedArtists(); // should be async
    res.json(artists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  const artistId = req.params.id;
  if (!artistId || artistId === "undefined")
    return res.status(400).json({ error: "Invalid artist id" });

  try {
    const artistRes = await pool.query(
      `SELECT * FROM artists WHERE id = $1`,
      [artistId]
    );
    const artist = artistRes.rows[0];
    if (!artist) return res.status(404).json({ error: "Artist not found" });

    const { albums, totalRating } = await getArtistAlbumsWithTotal(artistId);
    res.json({ artist, albums, totalRating });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch artist" });
  }
});

router.patch("/:id/image", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { image } = req.body;

  if (!image || !image.trim())
    return res.status(400).json({ error: "Image URL is required" });

  try {
    const artistRes = await pool.query(
      `SELECT * FROM artists WHERE id = $1`,
      [id]
    );
    const artist = artistRes.rows[0];
    if (!artist) return res.status(404).json({ error: "Artist not found" });

    await pool.query(
      `UPDATE artists SET image = $1 WHERE id = $2`,
      [image.trim(), id]
    );

    const updatedRes = await pool.query(
      `SELECT * FROM artists WHERE id = $1`,
      [id]
    );

    res.json(updatedRes.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update artist image" });
  }
});

//////////////////////////////////////////////////////////////////////
// PRIVATE ROUTES
//////////////////////////////////////////////////////////////////////

router.get("/users/:username", requireAuth, async (req, res) => {
  try {
    const artists = await getUserArtistStats(req.profileUser.id);
    res.json(artists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});

router.get("/:artistId/users/:username", requireAuth, async (req, res) => {
  try {
    const { artistId } = req.params;
    const userId = req.profileUser.id;

    const baseAlbums = await getUserRatedAlbumsByArtist(userId, artistId);
    if (baseAlbums.length === 0) return res.json({ artist: null, albums: [] });

    const albums = await attachUserAlbumStats(baseAlbums, userId);

    res.json({
      artist: {
        id: baseAlbums[0].artistId,
        name: baseAlbums[0].artist,
        image: baseAlbums[0].artistImage,
      },
      albums,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load artist albums" });
  }
});

router.delete("/:artistId", async (req, res) => {
  try {
    const { artistId } = req.params;
    await pool.query("DELETE FROM artists WHERE id = $1", [artistId]);
    res.json({ message: "Artist deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete artist" });
  }
});

export default router;