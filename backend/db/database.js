import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve("db", "database.sqlite"); // this is where the SQLite file will live
const db = new Database(dbPath); // will create database.sqlite if it doesn't exist

export default db;