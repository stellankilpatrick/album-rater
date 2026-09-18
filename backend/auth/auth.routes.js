import express from "express";
import bcrypt from "bcrypt";
import { generateToken } from "./auth.utils.js";
import { requireAuth } from "./auth.middleware.js";
import pool from "../db/database.js";
import crypto from "crypto";
import nodemailer from "nodemailer";

const router = express.Router();

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
// PASSWORD RESET: request token
// ===============================
router.post("/request-password-reset", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Missing email" });

    const result = await pool.query(`SELECT id, username, email FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];
    if (!user) {
      // Don't reveal whether email exists
      return res.json({ ok: true });
    }

    // generate token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await pool.query(
      `INSERT INTO password_reset_tokens(token, user_id, expires_at) VALUES ($1, $2, $3)`,
      [token, user.id, expiresAt]
    );

    // send email with token
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const resetUrl = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${encodeURIComponent(token)}`;
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'no-reply@localhost',
        to: user.email,
        subject: "Aarva — Password reset",
        text: `You requested a password reset. Visit the link to set a new password:\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
        html: `<p>You requested a password reset. Click below to set a new password.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you didn't request this, ignore this email.</p>`
      };

      await transporter.sendMail(mailOptions);
    } catch (mailErr) {
      console.error('Failed to send reset email:', mailErr);
      // don't reveal email send errors to client
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to request password reset" });
  }
});

// ===============================
// PASSWORD RESET: perform reset
// ===============================
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "Missing token or newPassword" });

    const tRes = await pool.query(
      `SELECT token, user_id, expires_at, used FROM password_reset_tokens WHERE token = $1`,
      [token]
    );
    const row = tRes.rows[0];
    if (!row) return res.status(400).json({ error: "Invalid token" });
    if (row.used) return res.status(400).json({ error: "Token already used" });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: "Token expired" });

    // hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // update user password and mark token used in a transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE users SET password = $1 WHERE id = $2`, [passwordHash, row.user_id]);
      await client.query(`UPDATE password_reset_tokens SET used = TRUE WHERE token = $1`, [token]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to reset password" });
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