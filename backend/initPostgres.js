import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for Render
});

async function init() {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        pfp TEXT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Artists table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS artists (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        image TEXT
      );
    `);

    // Albums table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS albums (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        release_date DATE,
        cover_art TEXT,
        UNIQUE(user_id, artist_id, title)
      );
    `);

    // Songs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id SERIAL PRIMARY KEY,
        album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
        track_number INTEGER NOT NULL CHECK (track_number > 0),
        title TEXT NOT NULL
      );
    `);

    // Song Ratings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS song_ratings (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating BETWEEN 0 AND 2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        PRIMARY KEY (user_id, song_id)
      );
    `);

    // Album Ratings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS album_ratings (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
        rating REAL,
        non_skips INTEGER NOT NULL,
        rated_songs INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        PRIMARY KEY (user_id, album_id)
      );
    `);

    // Follows table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS follows (
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        CHECK (follower_id != following_id),
        PRIMARY KEY (follower_id, following_id)
      );
    `);

    // Listen list table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS listen_list (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, album_id)
      );
    `);

    // Indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_song_ratings_song ON song_ratings(song_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_album_ratings_album ON album_ratings(album_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_song_ratings_user_updated ON song_ratings(user_id, updated_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);`);

    console.log("Postgres database initialized successfully!");
    process.exit();
  } catch (err) {
    console.error("Error initializing database:", err);
    process.exit(1);
  }
}

init();