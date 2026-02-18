import express from "express";
import { getAnniversaryAlbums, getCommunityFeed } from "../models/community.models.js";
import { requireAuth } from "../auth/auth.middleware.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const feed = await getCommunityFeed(req.user.id);
    res.json(feed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

router.get("/albums", requireAuth, async (req, res) => {
  try {
    const albums = await getAnniversaryAlbums(req.user.id);

    res.json(albums);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch anniversary albums" });
  }
});

export default router;