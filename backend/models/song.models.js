import db from "../db/database.js";

/**
 * Add songs to an album
 * @param {number} albumId
 * @param {Array} songs [{ title, num }]
 */
export function addSongsToAlbum(albumId, songs) {
  const albumExists = db.prepare("SELECT id FROM albums WHERE id = ?").get(albumId);

  if (!albumExists) throw new Error("Album not found");

  const insertSong = db.prepare(
    "INSERT INTO songs (album_id, title, track_number) VALUES (?, ?, ?)"
  );

  const insertMany = db.transaction((songs) => {
    for (const song of songs) {
      if (!song.num || song.num <= 0) {
        throw new Error("Invalid track number");
      }
      insertSong.run(albumId, song.title, song.num);
    }
  });

  try {
    insertMany(songs);
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new Error("Duplicate track number in album");
    }
    throw err;
  }

  // Return updated album
  const album = db.prepare("SELECT * FROM albums WHERE id = ?").get(albumId);

  album.songs = db
    .prepare(`
      SELECT id, title, track_number AS num 
      FROM songs 
      WHERE album_id = ? 
      ORDER BY track_number`)
    .all(albumId);

  return album;
}

/**
 * Rate (or re-rate) a song
 * @param {number} userId
 * @param {number} songId
 * @param {number} rating
 */
export function rateSong(userId, songId, rating) {
  if (![0, 1, 2].includes(rating)) {
    throw new Error("Invalid rating");
  }

  db.prepare(`
    INSERT INTO song_ratings (user_id, song_id, rating)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, song_id)
    DO UPDATE SET
      rating = excluded.rating,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, songId, rating);
}

/**
 * Update a song's info
 */
export function updateSong(songId, data) {
  const song = db.prepare("SELECT * FROM songs WHERE id = ?").get(songId);

  if (!song) return null;

  const fields = [];
  const values = [];

  if (data.title) {
    fields.push("title = ?");
    values.push(data.title);
  }

  if (data.num !== undefined) {
    fields.push("track_number = ?");
    values.push(data.num);
  }

  if (!fields.length) return song;

  try {
    db.prepare(`
    UPDATE songs 
    SET ${fields.join(", ")} 
    WHERE id = ?
    `).run(...values, songId);
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new Error("Track number already exists in album");
    }
    throw err;
  }

  return db.prepare(`
      SELECT id, title, track_number AS num
      FROM songs 
      WHERE id = ?
    `).get(songId);
}

/**
 * Delete a song
 */
export function deleteSong(songId) {
  db.prepare("DELETE FROM songs WHERE id = ?").run(songId);
}