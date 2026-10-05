import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "./schema";

const file = process.env.DATABASE_FILE ?? path.join(process.cwd(), "data", "gglearn.db");
const sqlite = new Database(file);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export * from "./schema";
