import express from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { Router } from "express";
import {
  getArtistAlbumsWithTotal, getAllRatedArtists, getUserArtistStats,
  getUserRatedAlbumsByArtist, attachUserAlbumStats
} from "../models/artist.models.js";
import db from "../db/database.js";

const router = Router();

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

//////////////////////////////////////////////////////////////////////
/////
///// PUBLIC ROUTES
/////
//////////////////////////////////////////////////////////////////////

/**
 * get all artists public view
 */
router.get("/", requireAuth, (req, res) => {
  const artists = getAllRatedArtists();
  res.json(artists);
});

/**
 * get public view of all artist albums
 */
router.get("/:id", requireAuth, async (req, res) => {
  const artistId = req.params.id;

  if (!artistId || artistId === "undefined") return res.status(400).json({ error: "invalid artist id" });

  const artist = db
    .prepare("SELECT * FROM artists WHERE id = ?")
    .get(artistId);

  if (!artist) return res.status(404).json({ error: "Artist not found" });

  const { albums, totalRating } = getArtistAlbumsWithTotal(artistId);

  res.json({ artist, albums, totalRating });
});

router.patch("/:id/image", requireAuth, (req, res) => {
  const { id } = req.params;
  const { image } = req.body;

  if (!image || !image.trim()) {
    return res.status(400).json({ error: "Image URL is required" });
  }

  // Make sure the artist exists
  const artist = db.prepare("SELECT * FROM artists WHERE id = ?").get(id);
  if (!artist) {
    return res.status(404).json({ error: "Artist not found" });
  }

  // Update the image
  db.prepare("UPDATE artists SET image = ? WHERE id = ?").run(image.trim(), id);

  // Return the updated artist
  const updatedArtist = db.prepare("SELECT * FROM artists WHERE id = ?").get(id);
  res.json(updatedArtist);
});

//////////////////////////////////////////////////////////////////////
/////
///// PRIVATE ROUTES
/////
//////////////////////////////////////////////////////////////////////

// get list of user's artists
router.get("/users/:username", requireAuth, async (req, res) => {
  try {
    const artists = getUserArtistStats(req.profileUser.id);
    res.json(artists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});

// ===============================
// GET ALBUMS BY ARTIST RATED BY USER
// ===============================
router.get("/:artistId/users/:username", requireAuth, async (req, res) => {
  try {
    const { artistId } = req.params;
    const userId = req.profileUser.id;

    const baseAlbums = getUserRatedAlbumsByArtist(userId, artistId);

    if (baseAlbums.length === 0) {
      return res.json({ artist: null, albums: [] });
    }

    const albums = attachUserAlbumStats(baseAlbums, userId);

    res.json({
      artist: {
        id: baseAlbums[0].artistId,
        name: baseAlbums[0].artist,
        image: baseAlbums[0].artistImage
      },
      albums
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load artist albums" });
  }
});

export default router;