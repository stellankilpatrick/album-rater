import pool from "../db/database.js";

/**
 * Add songs to an album
 * @param {number} albumId
 * @param {Array} songs [{ title, num }]
 */
export async function addSongsToAlbum(albumId, songs) {
  const { rows: albumRows } = await pool.query(
    "SELECT id FROM albums WHERE id = $1",
    [albumId]
  );
  if (albumRows.length === 0) throw new Error("Album not found");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const song of songs) {
      if (!song.num || song.num <= 0) throw new Error("Invalid track number");

      await client.query(
        `INSERT INTO songs (album_id, title, track_number)
         VALUES ($1, $2, $3)`,
        [albumId, song.title, song.num]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") throw new Error("Duplicate track number in album"); // unique violation
    throw err;
  } finally {
    client.release();
  }

  // Return updated album with songs
  const { rows: albumResult } = await pool.query(
    "SELECT * FROM albums WHERE id = $1",
    [albumId]
  );
  const album = albumResult[0];

  const { rows: songsRows } = await pool.query(
    `SELECT id, title, track_number AS num 
     FROM songs 
     WHERE album_id = $1 
     ORDER BY track_number`,
    [albumId]
  );
  album.songs = songsRows;
  return album;
}

/**
 * Rate (or re-rate) a song
 */
export async function rateSong(userId, songId, rating) {
  if (![0, 1, 2].includes(rating)) throw new Error("Invalid rating");

  await pool.query(
    `
    INSERT INTO song_ratings (user_id, song_id, rating, updated_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, song_id)
    DO UPDATE SET rating = EXCLUDED.rating, updated_at = CURRENT_TIMESTAMP
  `,
    [userId, songId, rating]
  );
}

/**
 * Update a song's info
 */
export async function updateSong(songId, data) {
  const { rows: songRows } = await pool.query(
    "SELECT * FROM songs WHERE id = $1",
    [songId]
  );
  const song = songRows[0];
  if (!song) return null;

  const fields = [];
  const values = [];
  let idx = 1;

  if (data.title) {
    fields.push(`title = $${idx++}`);
    values.push(data.title);
  }
  if (data.num !== undefined) {
    fields.push(`track_number = $${idx++}`);
    values.push(data.num);
  }
  if (!fields.length) return song;

  values.push(songId);

  try {
    await pool.query(
      `UPDATE songs SET ${fields.join(", ")} WHERE id = $${idx}`,
      values
    );
  } catch (err) {
    if (err.code === "23505") throw new Error("Track number already exists in album"); // unique violation
    throw err;
  }

  const { rows: updatedRows } = await pool.query(
    `SELECT id, title, track_number AS num FROM songs WHERE id = $1`,
    [songId]
  );
  return updatedRows[0];
}

/**
 * Delete a song
 */
export async function deleteSong(songId) {
  await pool.query("DELETE FROM songs WHERE id = $1", [songId]);
}