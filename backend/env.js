import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Must be the first import of any entrypoint: ES module imports run before the
// importing file's body, so env vars have to be loaded from here, not index.js.
const file = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
dotenv.config({ path: fileURLToPath(new URL(file, import.meta.url)) });
