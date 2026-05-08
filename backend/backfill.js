import "dotenv/config";
import pool from "./db/database.js";
import { syncUserScore10s } from "./models/album.models.js";

async function backfill() {
  const { rows } = await pool.query(`SELECT DISTINCT user_id FROM album_ratings`);
  console.log(`Backfilling ${rows.length} users...`);
  for (const { user_id } of rows) {
    console.log(`Syncing user ${user_id}...`);
    await syncUserScore10s(user_id);
  }
  console.log("Done!");
  process.exit(0);
}

backfill().catch(err => { console.error(err); process.exit(1); });