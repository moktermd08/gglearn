import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch())`;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull().default(""),
  name: text("name").notNull(),
  // access level inside the academy
  role: text("role", { enum: ["admin", "manager", "learner"] }).notNull().default("learner"),
  // what the person does at the company (drives their recommended path)
  jobRole: text("job_role").notNull().default("general"),
  status: text("status", { enum: ["active", "offboarded"] }).notNull().default("active"),
  createdAt: integer("created_at").notNull().default(now),
});

export const brands = sqliteTable("brands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull().default(""),
});

// A track is one question-bank domain: subject, product, service, tool, technology or process.
export const tracks = sqliteTable("tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  brandId: integer("brand_id").notNull().references(() => brands.id),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind", {
    enum: ["subject", "product", "service", "tool", "technology", "process"],
  }).notNull(),
  description: text("description").notNull().default(""),
  // which job roles this track is recommended for, comma separated; "" = everyone
  roles: text("roles").notNull().default(""),
});

// Source of truth. Authored questions point back to one of these.
export const knowledgeItems = sqliteTable("knowledge_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackId: integer("track_id").notNull().references(() => tracks.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: integer("updated_at").notNull().default(now),
});

export const questions = sqliteTable(
  "questions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trackId: integer("track_id").notNull().references(() => tracks.id),
    level: integer("level").notNull(), // 1..20
    type: text("type", { enum: ["mcq", "open", "scenario"] }).notNull().default("mcq"),
    prompt: text("prompt").notNull(),
    code: text("code"),
    options: text("options", { mode: "json" }).$type<{ key: string; text: string }[]>(),
    answer: text("answer"), // mcq: option key. open/scenario: model answer
    rubric: text("rubric"), // what a good open answer must cover
    hint: text("hint"),
    topic: text("topic").notNull().default(""),
    weight: integer("weight").notNull().default(10),
    timeSec: integer("time_sec").notNull().default(60),
    knowledgeItemId: integer("knowledge_item_id").references(() => knowledgeItems.id),
    source: text("source", { enum: ["legacy-trialtest", "authored", "ai", "questions-repo"] }).notNull().default("authored"),
    status: text("status", { enum: ["active", "review", "retired"] }).notNull().default("active"),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("questions_dedupe").on(t.trackId, t.level, t.prompt)],
);

export const enrollments = sqliteTable(
  "enrollments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    trackId: integer("track_id").notNull().references(() => tracks.id),
    goal: text("goal").notNull().default(""),
    startedAt: integer("started_at").notNull().default(now),
  },
  (t) => [uniqueIndex("enroll_unique").on(t.userId, t.trackId)],
);

// One attempt at one level.
export const runs = sqliteTable("runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  trackId: integer("track_id").notNull().references(() => tracks.id),
  level: integer("level").notNull(),
  score: real("score"), // 0..1, null until finished
  passed: integer("passed", { mode: "boolean" }),
  startedAt: integer("started_at").notNull().default(now),
  finishedAt: integer("finished_at"),
});

export const answers = sqliteTable("answers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").notNull().references(() => runs.id),
  questionId: integer("question_id").notNull().references(() => questions.id),
  response: text("response").notNull().default(""),
  score: real("score").notNull().default(0), // 0..1
  feedback: text("feedback"),
});

// Onboarding / offboarding checklists and knowledge handover.
export const checklistItems = sqliteTable("checklist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  kind: text("kind", { enum: ["onboarding", "offboarding"] }).notNull(),
  label: text("label").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
});

export const handovers = sqliteTable("handovers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  trackId: integer("track_id").references(() => tracks.id),
  notes: text("notes").notNull(),
  createdAt: integer("created_at").notNull().default(now),
});

// Study guide for one level of a track: the syllabus bullets shown before the exam.
export const lessons = sqliteTable(
  "lessons",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trackId: integer("track_id").notNull().references(() => tracks.id),
    level: integer("level").notNull(),
    title: text("title").notNull(),
    syllabus: text("syllabus", { mode: "json" }).$type<string[]>().notNull(),
  },
  (t) => [uniqueIndex("lessons_unique").on(t.trackId, t.level)],
);

// Daily quest completions (study / drill / exam). One row per kind per day.
export const dailyQuests = sqliteTable(
  "daily_quests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    trackId: integer("track_id").notNull().references(() => tracks.id),
    day: text("day").notNull(), // YYYY-MM-DD (UTC)
    kind: text("kind", { enum: ["study", "drill", "exam"] }).notNull(),
    xp: integer("xp").notNull().default(0),
  },
  (t) => [uniqueIndex("quest_unique").on(t.userId, t.trackId, t.day, t.kind)],
);

// Issued when a milestone level (5, 10, 15, 20) is passed. `code` is the public verification id.
export const certificates = sqliteTable(
  "certificates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    trackId: integer("track_id").notNull().references(() => tracks.id),
    level: integer("level").notNull(),
    code: text("code").notNull().unique(),
    score: real("score").notNull(),
    issuedAt: integer("issued_at").notNull().default(now),
  },
  (t) => [uniqueIndex("cert_unique").on(t.userId, t.trackId, t.level)],
);

// Signup is invite-only. A manager issues one; the token itself is shown once and only its hash is stored.
export const invites = sqliteTable("invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email").notNull(), // the invite only works for this address
  jobRole: text("job_role").notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull().default(now),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
});
