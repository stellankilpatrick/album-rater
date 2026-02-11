import express from "express";
import bcrypt from "bcrypt";
import { generateToken } from "./auth.utils.js";
import { requireAuth } from "./auth.middleware.js";
import db from "../db/database.js";

const router = express.Router();

// ===============================
// REGISTER
// ===============================
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: "Missing fields" });

    const exists = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (exists) return res.status(409).json({ error: "Email already in use" });

    const usernameExists = db
      .prepare("SELECT 1 FROM users WHERE username = ?")
      .get(username);

    if (usernameExists) return res.status(409).json({ error: "Username already in use" })
    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)"
    ).run(username, email, passwordHash);

    const user = { id: result.lastInsertRowid, username, email };
    const token = generateToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ===============================
// LOGIN
// ===============================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user) return res.status(401).json({ error: "Invalid email" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    const token = generateToken({ id: user.id, username: user.username, email: user.email });

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ===============================
// LOGGED-IN USER
// ===============================
router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT id, username, email, created_at FROM users WHERE id = ?")
    .get(req.user.id);

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.created_at
  });
});

export default router;