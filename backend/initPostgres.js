import pool from "./db/database.js";

// Creates the full schema on an empty database. Every statement is IF NOT EXISTS,
// so running it again is harmless. Refuses non-local databases unless
// ALLOW_REMOTE_INITDB=1, so it can't be pointed at production by accident.
function isLocalDb() {
  try {
    return ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname);
  } catch {
    return false;
  }
}

async function init() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Create backend/.env.local (see backend/.env.example).");
    process.exit(1);
  }
  if (!isLocalDb() && process.env.ALLOW_REMOTE_INITDB !== "1") {
    console.error("Refusing to run initdb against a non-local database. Set ALLOW_REMOTE_INITDB=1 to override.");
    process.exit(1);
  }

  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        pfp TEXT,
        banner TEXT,
        bio TEXT,
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

    // Albums table (artists are linked through album_artists)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS albums (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        release_date DATE,
        cover_art TEXT,
        type TEXT DEFAULT 'album',
        official BOOLEAN DEFAULT FALSE
      );
    `);

    // Album <-> artist links (albums can have multiple artists)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS album_artists (
        album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
        artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
        PRIMARY KEY (album_id, artist_id)
      );
    `);

    // Songs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id SERIAL PRIMARY KEY,
        album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
        track_number INTEGER NOT NULL CHECK (track_number > 0),
        title TEXT NOT NULL,
        featured TEXT
      );
    `);

    // Song Ratings table (rating is null when only a comment exists)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS song_ratings (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating BETWEEN 0 AND 2),
        comment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        PRIMARY KEY (user_id, song_id)
      );
    `);

    // Album Ratings table (liked: 1 good, 0 mid, -1 bad)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS album_ratings (
        id SERIAL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
        rating REAL,
        score10 REAL,
        adjustor REAL,
        adjusted_rating REAL,
        review TEXT,
        liked INTEGER CHECK (liked IN (-1, 0, 1)),
        untracked BOOLEAN DEFAULT FALSE,
        is_draft BOOLEAN NOT NULL DEFAULT FALSE,
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS genres (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);
    // addGenreToAlbum relies on ON CONFLICT (LOWER(name))
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS genres_name_lower_key ON genres (LOWER(name));`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS album_genres (
        album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE,
        genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
        PRIMARY KEY (album_id, genre_id)
      );
    `);

    // Recommendations between mutual followers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recommendations (
        id SERIAL PRIMARY KEY,
        from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        UNIQUE (from_user_id, to_user_id, album_id)
      );
    `);

    // Comments on a user's album review (parent_id for replies)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS album_review_comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
        reviewed_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        parent_id INTEGER REFERENCES album_review_comments(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // Likes on reviews/comments (target_type: album_review, review_comment, song_comment)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_type TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        UNIQUE (user_id, target_type, target_id)
      );
    `);

    // In-app notifications
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE,
        target_username TEXT,
        message TEXT,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // Password reset tokens
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // Indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_song_ratings_song ON song_ratings(song_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_album_ratings_album ON album_ratings(album_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_song_ratings_user_updated ON song_ratings(user_id, updated_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_album_genres_album ON album_genres(album_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_album_genres_genre ON album_genres(genre_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_album_artists_artist ON album_artists(artist_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_type, target_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_review_comments_album_user ON album_review_comments(album_id, reviewed_user_id);`);

    console.log("Postgres database initialized successfully!");
    process.exit();
  } catch (err) {
    console.error("Error initializing database:", err);
    process.exit(1);
  }
}

init();
