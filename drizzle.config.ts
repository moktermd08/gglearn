import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  // DATABASE_FILE points the push at a scratch copy (the app reads the same variable), so a schema change can be tried without touching the real database
  dbCredentials: { url: process.env.DATABASE_FILE ?? "./data/gglearn.db" },
});
