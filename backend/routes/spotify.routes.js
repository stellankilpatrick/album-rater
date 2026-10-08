import express from "express";
import pool from "../db/database.js";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  searchAlbums,
  SEARCH_PAGE_SIZE,
  getAlbumWithTracks,
  SpotifyNotConfiguredError,
  SpotifyApiError,
} from "../spotify/spotify.client.js";
import { findExistingAlbumId, importSpotifyAlbum, loadArtistIndex, toAlbumData } from "../models/spotify.models.js";

const router = express.Router();

function handleSpotifyError(err, res, fallbackMessage) {
  if (err instanceof SpotifyNotConfiguredError) {
    return res.status(503).json({ error: "Spotify import is not available" });
  }
  if (err instanceof SpotifyApiError) {
    if (err.status === 404 || err.status === 400) return res.status(404).json({ error: "Album not found on Spotify" });
    if (err.status === 429) return res.status(503).json({ error: "Spotify is busy, try again in a minute" });
    console.error(err);
    return res.status(502).json({ error: "Spotify request failed" });
  }
  console.error(err);
  return res.status(500).json({ error: fallbackMessage });
}

// ---------------------
// SEARCH SPOTIFY ALBUMS
// Each result says whether it's already on the site (existingAlbumId)
// ---------------------
router.get("/search", requireAuth, async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.json({ albums: [], hasMore: false });
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  try {
    const items = await searchAlbums(q, offset);
    const artistIndex = await loadArtistIndex(pool);

    const albums = await Promise.all(items.map(async (item) => {
      const data = toAlbumData(item);
      return {
        spotifyId: data.spotifyId,
        title: data.title,
        artist: data.artistNames.join(" & "),
        releaseDate: data.releaseDate,
        coverArt: data.coverArt,
        type: data.type,
        totalTracks: item.total_tracks,
        spotifyUrl: item.external_urls?.spotify ?? null,
        existingAlbumId: await findExistingAlbumId(pool, data, artistIndex),
      };
    }));

    // Spotify's reported total is unreliable, so offer more whenever a full page came back
    res.json({ albums, hasMore: items.length === SEARCH_PAGE_SIZE });
  } catch (err) {
    handleSpotifyError(err, res, "Spotify search failed");
  }
});

// ---------------------
// IMPORT A SPOTIFY ALBUM
// Creates the album with its tracklist, or returns the existing one untouched
// ---------------------
router.post("/import/:spotifyId", requireAuth, async (req, res) => {
  const { spotifyId } = req.params;
  if (!/^[A-Za-z0-9]{22}$/.test(spotifyId)) return res.status(400).json({ error: "Invalid Spotify album id" });

  try {
    const spotifyAlbum = await getAlbumWithTracks(spotifyId);
    const { albumId, created } = await importSpotifyAlbum(spotifyAlbum);
    res.status(created ? 201 : 200).json({ albumId, created });
  } catch (err) {
    handleSpotifyError(err, res, "Failed to import album");
  }
});

export default router;
