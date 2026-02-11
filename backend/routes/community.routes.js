import express from "express";
import { getAnniversaryAlbums, getCommunityFeed } from "../models/community.models.js";
import { requireAuth } from "../auth/auth.middleware.js";

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  const feed = getCommunityFeed(req.user.id);
  res.json(feed);
});

router.get("/albums", requireAuth, (req, res) => {
  res.json(getAnniversaryAlbums(req.user.id));
});

export default router;