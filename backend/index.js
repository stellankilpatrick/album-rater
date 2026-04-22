import "dotenv/config";
import express from "express";
import authRoutes from "./auth/auth.routes.js";
import albumRoutes from "./routes/album.routes.js";
import artistRoutes from "./routes/artist.routes.js";
import songRoutes from "./routes/song.routes.js";
import userRoutes from "./routes/user.routes.js";
import searchRoutes from "./routes/search.routes.js";
import communityRoutes from "./routes/community.routes.js";
import likeRoutes from "./routes/like.routes.js";
import cors from "cors";
import notificationRoutes from "./routes/notification.routes.js";
//import router from "./router.js"

const app = express();

app.use(express.json());
app.use(cors());

// Mount auth routes
app.use("/auth", authRoutes);
app.use("/albums", albumRoutes);
app.use("/artists", artistRoutes);
app.use("/songs", songRoutes);
app.use("/users", userRoutes);
app.use("/community", communityRoutes);
app.use("/likes", likeRoutes);
app.use("/notifications", notificationRoutes)

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// search bar
app.use("/search", searchRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));