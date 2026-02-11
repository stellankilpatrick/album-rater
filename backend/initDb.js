import db from "./db/database.js";

db.prepare('PRAGMA foreign_keys = ON').run();

// Users table
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    pfp TEXT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Artists table
db.prepare(`
  CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    image TEXT
  )
`).run();

// Albums table
db.prepare(`
  CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    artist_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    release_date TEXT,
    cover_art TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    UNIQUE (user_id, artist_id, title)
  )
`).run();

// Songs table
db.prepare(`
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER NOT NULL,
    track_number INTEGER NOT NULL CHECK (track_number > 0),
    title TEXT NOT NULL,
    FOREIGN KEY(album_id) REFERENCES albums(id) ON DELETE CASCADE
  )
`).run();

// song Ratings table
db.prepare(`
  CREATE TABLE IF NOT EXISTS song_ratings (
    user_id INTEGER NOT NULL,
    song_id INTEGER NOT NULL,
    rating INTEGER CHECK (rating BETWEEN 0 AND 2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, song_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
  )
`).run();

// album ratings table
db.prepare(`
  CREATE TABLE IF NOT EXISTS album_ratings (
    user_id INTEGER NOT NULL,
    album_id INTEGER NOT NULL,
    rating REAL,
    non_skips INTEGER NOT NULL,
    rated_songs INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, album_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
  )
`).run();

db.prepare(`
  CREATE TRIGGER IF NOT EXISTS trg_song_ratings_updated_at
  AFTER UPDATE ON song_ratings
  FOR EACH ROW
  BEGIN
    UPDATE song_ratings
    SET updated_at = CURRENT_TIMESTAMP
    WHERE user_id = OLD.user_id
      AND song_id = OLD.song_id;
  END;
`).run();

// insert trigger
db.prepare(`
  CREATE TRIGGER IF NOT EXISTS trg_recalc_album_rating_insert
  AFTER INSERT ON song_ratings
  FOR EACH ROW
  BEGIN
    INSERT INTO album_ratings (user_id, album_id, rating, non_skips, rated_songs, updated_at)
    SELECT
      NEW.user_id,
      s.album_id,
      (SUM(sr.rating) * SUM(sr.rating)) * 1.0 / COUNT(*),
      SUM(CASE WHEN sr.rating > 0 THEN 1 ELSE 0 END),
      COUNT(*),
      CURRENT_TIMESTAMP
    FROM song_ratings sr
    JOIN songs s ON s.id = sr.song_id
    WHERE sr.user_id = NEW.user_id
      AND s.album_id = (SELECT album_id FROM songs WHERE id = NEW.song_id)
    GROUP BY s.album_id
    ON CONFLICT(user_id, album_id)
    DO UPDATE SET
      rating = excluded.rating,
      non_skips = excluded.non_skips,
      rated_songs = excluded.rated_songs,
      updated_at = CURRENT_TIMESTAMP;
  END;
`).run();

// update trigger
db.prepare(`
  CREATE TRIGGER IF NOT EXISTS trg_recalc_album_rating_update
  AFTER UPDATE ON song_ratings
  FOR EACH ROW
  BEGIN
    INSERT INTO album_ratings (user_id, album_id, rating, non_skips, rated_songs, updated_at)
    SELECT
      NEW.user_id,
      s.album_id,
      (SUM(sr.rating) * SUM(sr.rating)) * 1.0 / COUNT(*),
      SUM(CASE WHEN sr.rating > 0 THEN 1 ELSE 0 END),
      COUNT(*),
      CURRENT_TIMESTAMP
    FROM song_ratings sr
    JOIN songs s ON s.id = sr.song_id
    WHERE sr.user_id = NEW.user_id
      AND s.album_id = (
        SELECT album_id FROM songs WHERE id = NEW.song_id
      )
    GROUP BY s.album_id
    ON CONFLICT(user_id, album_id)
    DO UPDATE SET
      rating = excluded.rating,
      non_skips = excluded.non_skips,
      rated_songs = excluded.rated_songs,
      updated_at = CURRENT_TIMESTAMP;
  END;
`).run();

// delete trigger
db.prepare(`
  CREATE TRIGGER IF NOT EXISTS trg_recalc_album_rating_delete
  AFTER DELETE ON song_ratings
  FOR EACH ROW
  BEGIN
    DELETE FROM album_ratings
    WHERE user_id = OLD.user_id
      AND album_id = (
        SELECT album_id FROM songs WHERE id = OLD.song_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM song_ratings sr
        JOIN songs s ON s.id = sr.song_id
        WHERE sr.user_id = OLD.user_id
          AND s.album_id = (
            SELECT album_id FROM songs WHERE id = OLD.song_id
          )
      );

    INSERT INTO album_ratings (user_id, album_id, rating, non_skips, rated_songs, updated_at)
    SELECT
      OLD.user_id,
      s.album_id,
      (SUM(sr.rating) * SUM(sr.rating)) * 1.0 / COUNT(*),
      SUM(CASE WHEN sr.rating > 0 THEN 1 ELSE 0 END),
      COUNT(*),
      CURRENT_TIMESTAMP
    FROM song_ratings sr
    JOIN songs s ON s.id = sr.song_id
    WHERE sr.user_id = OLD.user_id
      AND s.album_id = (
        SELECT album_id FROM songs WHERE id = OLD.song_id
      )
    GROUP BY s.album_id
    ON CONFLICT(user_id, album_id)
    DO UPDATE SET
      rating = excluded.rating,
      non_skips = excluded.non_skips,
      rated_songs = excluded.rated_songs,
      updated_at = CURRENT_TIMESTAMP;
  END;
`).run();

// Song rating index
db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_song_ratings_song
  ON song_ratings(song_id)
`).run();

// album rating index
db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_album_ratings_album
  ON album_ratings(album_id)
`).run();

// Album index
db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_songs_album
  ON songs(album_id)
`).run();

// updated ratings index
db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_song_ratings_user_updated
    ON song_ratings(user_id, updated_at DESC);
  `).run();

// Follows table
db.prepare(`
  CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (follower_id != following_id),
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
  )
`).run();

// Follows indexes
db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_follows_follower
  ON follows(follower_id)
`).run();

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_follows_following
  ON follows(following_id)
`).run();

// listen list table
db.prepare(`
  CREATE TABLE IF NOT EXISTS listen_list (
    user_id INTEGER NOT NULL,
    album_id INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, album_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(album_id) REFERENCES albums(id) ON DELETE CASCADE
  )
`).run();

console.log("Database initialized!");