import dotenv from "dotenv";
dotenv.config({ path: process.env.NODE_ENV === "production" ? ".env" : ".env.local" });
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

// Configure CORS: if FRONTEND_URLS or FRONTEND_URL is set, treat it as a whitelist (comma-separated).
// If neither env is set, allow all origins (dev-friendly). Example:
// FRONTEND_URLS=https://album-rater-rho.vercel.app,http://localhost:3001
const rawFrontend = process.env.FRONTEND_URLS || process.env.FRONTEND_URL;
if (rawFrontend) {
	const whitelist = rawFrontend.split(',').map(s => s.trim()).filter(Boolean);
	const corsOptions = {
		origin: (origin, callback) => {
			// allow requests with no origin (curl, server-to-server, same-origin)
			if (!origin) return callback(null, true);
			if (whitelist.includes(origin)) return callback(null, true);
			return callback(new Error('CORS_NOT_ALLOWED'));
		},
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	};
	app.use(cors(corsOptions));
} else {
	// no frontend env configured — allow all origins (like previous default)
	app.use(cors({ origin: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"], credentials: true }));
}

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