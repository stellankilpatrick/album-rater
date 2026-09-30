import "../env.js";
import pkg from "pg";
const { Pool } = pkg;

// Hosted Postgres (Render) requires SSL; a local Postgres usually doesn't support it
const isLocalDb = (() => {
    try {
        return ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname);
    } catch {
        return false;
    }
})();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocalDb ? false : { rejectUnauthorized: false }
});

export default pool;
