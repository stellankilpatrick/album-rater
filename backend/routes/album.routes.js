import express from "express";
import pool from "../db/database.js";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getAlbumDetailsPublic, createAlbum,
  getAllAlbumsPublic, updateAlbumTitle, updateAlbumArtist, updateAlbumCover,
  getUserRatedAlbums, updateAlbumRatingForUser, getUserAlbumScoreSingle, getAlbumDetailsPrivate,
  getUserAlbumScores, updateAlbumReleaseDate, deleteUserAlbumRating,
  getAlbumGenres, getAllGenres, addGenreToAlbum, removeGenreFromAlbum,
  getAlbumGenreRank, getAlbumYearRank, getAlbumDecadeRank, getAlbumArtistRank
} from "../models/album.models.js";
import { addSongsToAlbum } from "../models/song.models.js";

const router = express.Router();

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
    res.status(500).json({ error: "Failed to fetch user" });
  }
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
    const albums = await getAllAlbumsPublic();
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
    const { ratings } = req.body;
    if (!Array.isArray(ratings)) return res.status(400).json({ error: "Invalid ratings" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const r of ratings) {
        await client.query(
          `
          INSERT INTO song_ratings (user_id, song_id, rating, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (user_id, song_id)
          DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()
          `,
          [req.user.id, r.songId, r.rating]
        );
      }

      // Keep album_ratings in sync
      await updateAlbumRatingForUser(req.user.id, req.params.id);

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

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

  const album = await addSongsToAlbum(id, [{ title, num }]);
  res.json(album.songs[album.songs.length - 1]);
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const albumId = req.params.id;

    // Count ratings for the album
    const ratingRes = await pool.query(
      `
      SELECT COUNT(sr.song_id) AS "ratingCount"
      FROM songs s
      LEFT JOIN song_ratings sr ON sr.song_id = s.id
      WHERE s.album_id = $1
      `,
      [albumId]
    );

    if (parseInt(ratingRes.rows[0].ratingCount) > 0) {
      return res.status(400).json({
        error: "Album cannot be deleted once it has ratings"
      });
    }

    // Delete album (songs cascade)
    await pool.query(`DELETE FROM albums WHERE id = $1`, [albumId]);

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

router.patch("/:id/release-date", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { releaseDate } = req.body;

  if (!releaseDate) return res.status(400).json({ error: "Release date cannot be empty" });

  try {
    const success = await updateAlbumReleaseDate(id, releaseDate.trim());

    if (!success) {
      return res.status(404).json({ error: "Album not found" });
    }

    const album = await getAlbumDetailsPublic(id);
    res.json(album);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update album release date" });
  }
});


// ---------------------
// CREATE OR FIND ALBUM
// Any user can create a rating version of an existing album
// ---------------------
router.post("/new", requireAuth, async (req, res) => {
  try {
    const { title, artist, releaseDate, songs = [], cover_art: coverArt, rating } = req.body;
    if (!title || !artist) return res.status(400).json({ error: "Title and artist required" });

    // Create album (make sure createAlbum is async and uses Postgres)
    const album = await createAlbum({ title, artist, releaseDate, songs, coverArt });

    // Insert initial ratings if provided
    if (rating !== undefined && album.songs.length > 0) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const song of album.songs) {
          await client.query(
            `INSERT INTO song_ratings (user_id, song_id, rating, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (user_id, song_id)
            DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()`,
            [req.user.id, song.id, rating]
          );
        }

        // Keep album_ratings in sync
        await updateAlbumRatingForUser(req.user.id, album.id);

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    res.status(201).json(album); // return full album object
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create album" });
  }
});

// Get all available genres
router.get("/genres/all", async (req, res) => {
  try {
    const genres = await getAllGenres();
    res.json(genres);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch genres" });
  }
});

router.get("/:id/genres", requireAuth, async (req, res) => {
  try {
    const genres = await getAlbumGenres(req.params.id);
    res.json(genres);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch genres" });
  }
});

// Add genre to album
router.post("/:id/genres", requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Genre name required" });

  try {
    await addGenreToAlbum(req.params.id, name);
    const genres = await getAlbumGenres(req.params.id);
    res.json(genres);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add genre" });
  }
});

// Remove genre from album
router.delete("/:id/genres/:genreId", requireAuth, async (req, res) => {
  try {
    await removeGenreFromAlbum(req.params.id, req.params.genreId);
    const genres = await getAlbumGenres(req.params.id);
    res.json(genres);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove genre" });
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
router.get("/users/:username", requireAuth, async (req, res) => {
  try {
    const power = req.query.power ? Number(req.query.power) : 0.5;
    const userId = req.profileUser.id;

    const albums = await getUserRatedAlbums(userId);

    const scores = await getUserAlbumScores(userId, power);

    const scoreMap = new Map(scores.map(s => [s.albumId, s.score10]));

    const enrichedAlbums = albums.map(album => ({
      ...album,
      score10: Math.min(10, Math.max(1, scoreMap.get(album.id) ?? 1))
    }));

    res.json(enrichedAlbums);
  } catch (err) {
    console.error("Route error:", err);
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

    const album = await getAlbumDetailsPrivate(albumId, userId);
    if (!album) return res.status(404).json({ error: "Album not found" });

    const score = await getUserAlbumScoreSingle(userId, albumId);

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

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // insert/update song ratings
      for (const r of ratings) {
        await client.query(
          `INSERT INTO song_ratings (user_id, song_id, rating, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (user_id, song_id)
          DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()`,
          [req.user.id, r.songId, r.rating]
        );
      }

      // update album_ratings table
      await updateAlbumRatingForUser(req.user.id, req.params.id);

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

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
    const { id } = req.params;

    const album = await getAlbumDetailsPublic(id);
    if (!album) return res.status(404).json({ error: "Album not found" });

    const userRatingsRes = await pool.query(
      `SELECT sr.song_id, sr.rating
      FROM song_ratings sr
      JOIN songs s ON s.id = sr.song_id
      WHERE sr.user_id = $1 AND s.album_id = $2`,
      [req.user.id, album.id]
    );

    res.json({
      ...album,
      userRatings: userRatingsRes.rows
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
    const reviewsRes = await pool.query(
      `
      SELECT u.id, u.username, ar.rating
      FROM follows f
      JOIN album_ratings ar ON ar.user_id = f.following_id
      JOIN users u ON u.id = ar.user_id
      WHERE f.follower_id = $1 AND ar.album_id = $2
      `,
      [req.user.id, req.params.albumId]
    );

    res.json(reviewsRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get following reviews" });
  }
});

router.get("/:id/rank/genre/:genre", requireAuth, async (req, res) => {
  try {
    const result = await getAlbumGenreRank(req.params.id, req.params.genre);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch genre rank" });
  }
});

router.get("/:id/rank/year", requireAuth, async (req, res) => {
  try {
    const result = await getAlbumYearRank(req.params.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch year rank" });
  }
});

router.get("/:id/rank/decade", requireAuth, async (req, res) => {
  try {
    const result = await getAlbumDecadeRank(req.params.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch decade rank" });
  }
});

router.get("/:id/rank/artist", requireAuth, async (req, res) => {
  try {
    const result = await getAlbumArtistRank(req.params.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch artist rank" });
  }
});

export default router;