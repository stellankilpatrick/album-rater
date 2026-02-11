import express from "express";
import db from "../db/database.js";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getAlbumDetailsPublic, createAlbum,
  getAllAlbumsPublic, updateAlbumTitle, updateAlbumArtist, updateAlbumCover,
  getUserRatedAlbums, getUserAlbumScoreSingle, getAlbumDetailsPrivate, getUserAlbumScores
} from "../models/album.models.js";
import { addSongsToAlbum } from "../models/song.models.js";

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

//////////////////////////////////////////////////////////////////////
/////
///// PUBLIC ROUTES
/////
//////////////////////////////////////////////////////////////////////

///// /albums

// ---------------------
// GET ALL ALBUMS
// ---------------------
router.get("/", async (req, res) => {
  try {
    const albums = getAllAlbumsPublic();
    res.json(albums);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch albums" });
  }
});

// ---------------------
// GET ALBUM BY ID
// Show logged-in user's rating if available
// ---------------------
router.get("/:id", async (req, res) => {
  try {
    const album = await getAlbumDetailsPublic(req.params.id);
    if (!album) return res.status(404).json({ error: "Album not found" });

    res.json(album);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch album" });
  }
});

// ---------------------
// RATE ALBUM SONGS
// ---------------------
router.post("/:id/rate", requireAuth, async (req, res) => {
  try {
    const { ratings } = req.body; // [{ songId, rating }]
    if (!Array.isArray(ratings)) return res.status(400).json({ error: "Invalid ratings" });

    const insert = db.prepare(`
      INSERT OR REPLACE INTO song_ratings (user_id, song_id, rating)
      VALUES (?, ?, ?)
    `);

    const transaction = db.transaction((ratingsArr) => {
      for (const r of ratingsArr) {
        insert.run(req.user.id, r.songId, r.rating);
      }
    });

    transaction(ratings);

    const album = await getAlbumDetailsPublic(req.params.id);
    res.json(album);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to rate album" });
  }
});

// ---------------------
// ADD SONG TO ALBUM
// ---------------------
router.post("/:id/songs", requireAuth, async (req, res) => {
  const { title, num } = req.body;
  const id = req.params.id;

  if (!title || !num) return res.status(400).json({ error: "Missing title or track number" });

  const album = addSongsToAlbum(id, [{ title, num }]);
  res.json(album.songs[album.songs.length - 1]);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // count ratings for this album
    const row = db.prepare(`
      SELECT COUNT(sr.song_id) AS ratingCount
      FROM songs s
      LEFT JOIN song_ratings sr ON sr.song_id = s.id
      WHERE s.album_id = ?
    `).get(id);

    if (row.ratingCount > 0) {
      return res.status(400).json({
        error: "Album cannot be deleted once it has ratings"
      });
    }

    // delete album (songs will cascade)
    db.prepare(`DELETE FROM albums WHERE id = ?`).run(id);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete album" });
  }
});

router.patch("/:id/title", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Title cannot be empty" });
  }

  try {
    const success = updateAlbumTitle(id, title.trim());
    if (!success) return res.status(404).json({ error: "Album not found" });

    const album = await getAlbumDetailsPublic(id);
    res.json(album);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update album title" });
  }
});

router.patch("/:id/artist", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { artist } = req.body;

  if (!artist || !artist.trim()) {
    return res.status(400).json({ error: "Artist name cannot be empty" });
  }

  try {
    const success = updateAlbumArtist(id, artist.trim());
    if (!success) return res.status(404).json({ error: "Album not found" });

    const album = await getAlbumDetailsPublic(id);
    res.json(album);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update album artist" });
  }
});

router.patch("/:id/cover", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { cover } = req.body;

  if (!cover) return res.status(400).json({ error: "Cover image URL required" });

  try {
    const success = updateAlbumCover(id, cover.trim());
    if (!success) return res.status(404).json({ error: "Album not found" });

    const album = await getAlbumDetailsPublic(id);
    res.json(album);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update album cover" });
  }
});

// ---------------------
// CREATE OR FIND ALBUM
// Any user can create a rating version of an existing album
// ---------------------
router.post("/new", requireAuth, (req, res) => {
  try {
    const { title, artist, releaseDate, songs = [], cover_art: coverArt, rating } = req.body;
    if (!title || !artist) return res.status(400).json({ error: "Title and artist required" });

    const album = createAlbum({ title, artist, releaseDate, songs, coverArt, userId: req.user.id });

    // Insert rating if provided
    if (rating !== undefined && album.songs.length > 0) {
      db.prepare(`
        INSERT OR REPLACE INTO song_ratings (user_id, song_id, rating)
        SELECT ?, id, ?
        FROM songs
        WHERE album_id = ?
      `).run(req.user.id, rating, album.id);
    }

    res.status(201).json(album); // always a fully valid album object
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create album" });
  }
});

//////////////////////////////////////////////////////////////////////
/////
///// PRIVATE ROUTES
/////
//////////////////////////////////////////////////////////////////////

// ===============================
// GET ALL ALBUMS USER HAS RATED
// ===============================
router.get("/users/:username", requireAuth, (req, res) => {
  try {
    const power = req.query.power ? Number(req.query.power) : 0.6;
    const userId = req.profileUser.id;

    const albums = getUserRatedAlbums(userId);
    const scores = getUserAlbumScores(userId, power);

    // Build a fast lookup table
    const scoreMap = new Map(
      scores.map(s => [s.albumId, s.score10])
    );

    // Attach score to each album
    const enrichedAlbums = albums.map(album => ({
      ...album,
      score10: Math.min(10, Math.max(1, scoreMap.get(album.id) ?? 1))
    }));

    res.json(enrichedAlbums);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch albums" });
  }
});

// ===============================
// GET ALBUM BY ID OF USER
// ===============================
router.get("/:id/users/:username", requireAuth, async (req, res) => {
  try {
    const albumId = Number(req.params.id);
    const userId = req.profileUser.id;

    const album = getAlbumDetailsPrivate(albumId, userId);
    if (!album) return res.status(404).json({ error: "Album not found" });

    const score = getUserAlbumScoreSingle(userId, albumId);

    album.songs = album.tracks.map(t => ({
      id: t.id,
      num: t.num,
      title: t.title,
      localRating: t.rating
    }));

    delete album.tracks;

    res.json({
      ...album,
      score10: score?.score10 ?? null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch album" });
  }
});


// ---------------------
// RATE ALBUM SONGS
// ---------------------
router.post("/:id/rate/users/:username", requireAuth, async (req, res) => {
  try {
    if (req.user.username !== req.params.username) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { ratings } = req.body; // [{ songId, rating }]
    if (!Array.isArray(ratings)) return res.status(400).json({ error: "Invalid ratings" });

    const insert = db.prepare(`
      INSERT OR REPLACE INTO song_ratings (user_id, song_id, rating)
      VALUES (?, ?, ?)
    `);

    const transaction = db.transaction((ratingsArr) => {
      for (const r of ratingsArr) {
        insert.run(req.user.id, r.songId, r.rating);
      }
    });

    transaction(ratings);

    const album = await getAlbumDetailsPublic(req.params.id);
    res.json(album);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to rate album" });
  }
});

// ---------------------
// GET ALBUM READY TO RATE
// ---------------------
router.post("/:id/users/:username", requireAuth, async (req, res) => {
  try {
    const { username, id } = req.params;

    // Make sure the user exists (req.profileUser is set by router.param)
    if (!req.profileUser) return res.status(404).json({ error: "User not found" });

    // Fetch album details
    const album = await getAlbumDetailsPublic(id);
    if (!album) return res.status(404).json({ error: "Album not found" });

    // Optional: include whether this user has rated any songs
    const userRatings = db.prepare(`
      SELECT song_id, rating
      FROM song_ratings
      WHERE user_id = ? AND song_id IN (SELECT id FROM songs WHERE album_id = ?)
    `).all(req.user.id, album.id);

    res.json({
      ...album,
      userRatings
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch album for rating" });
  }
});

router.delete("/:id/users/:username", requireAuth, async (req, res) => {
  try {
    if (req.user.username !== req.params.username) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const userId = req.user.id;
    const { id } = req.params;

    deleteUserAlbumRating(userId, id);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete album ratings " });
  }
})

router.get("/:albumId/following-reviews", requireAuth, async (req, res) => {
  try {
    const followingReviews = db.prepare(`
      SELECT u.id, u.username, ar.rating
      FROM follows f
      JOIN album_ratings ar ON ar.user_id = f.following_id
      JOIN users u ON u.id = ar.user_id
      WHERE f.follower_id = ?
      AND ar.album_id = ?
  `).all(req.user.id, req.params.albumId);

    res.json(followingReviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get following reviews" });
  }
})

export default router;