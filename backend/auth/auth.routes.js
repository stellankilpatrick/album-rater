import express from "express";
import bcrypt from "bcrypt";
import { generateToken } from "./auth.utils.js";
import { requireAuth } from "./auth.middleware.js";
import pool from "../db/database.js";

const router = express.Router();

// ===============================
// REGISTER
// ===============================
// ===============================
// REGISTER
// ===============================
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    const username = req.body.username?.trim().toLowerCase();

    if (!username || !email || !password)
      return res.status(400).json({ error: "Missing fields" });

    // Check email
    const emailCheck = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    if (emailCheck.rows.length > 0) return res.status(409).json({ error: "Email already in use" });

    // Check username
    const usernameCheck = await pool.query(`SELECT 1 FROM users WHERE username = $1`, [username]);
    if (usernameCheck.rows.length > 0) return res.status(409).json({ error: "Username already in use" });

    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await pool.query(
      `INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email`,
      [username, email, passwordHash]
    );

    const user = result.rows[0];
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
    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];

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
router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;