import pkg from "pg";
const { Pool } = pkg;

// Adds albums.spotify_id for the Spotify import. Purely additive: existing
// albums get NULL and nothing else in the table changes. Safe to run twice.
// Postgres unique indexes allow any number of NULLs, so hand-added albums never conflict.
//
// Pass the database explicitly (no .env file is read):
// Local:      DATABASE_URL=postgres://localhost:5432/album_rater_dev npm run migrate:spotify
// Production: DATABASE_URL='<Neon URL>' npm run migrate:spotify -- --yes

function isLocalDb() {
  try {
    return ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname);
  } catch {
    return false;
  }
}

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  if (!isLocalDb() && !process.argv.includes("--yes")) {
    console.error("Non-local database. Re-run with -- --yes to confirm.");
    process.exit(1);
  }

  // Hosted Postgres requires SSL; a local Postgres usually doesn't support it
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocalDb() ? false : { rejectUnauthorized: false },
  });

  try {
    await pool.query(`ALTER TABLE albums ADD COLUMN IF NOT EXISTS spotify_id TEXT;`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS albums_spotify_id_key ON albums (spotify_id);`);
    console.log("albums.spotify_id is ready.");
    process.exit();
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
