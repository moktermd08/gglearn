import { sql } from "drizzle-orm";
import { blob, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  // bumped to invalidate every session this person has (sign out everywhere, offboarding)
  sessionVersion: integer("session_version").notNull().default(0),
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
    // starting point found by the placement check: levels treated as already mastered. Only ever raised.
    placedLevel: integer("placed_level").notNull().default(0),
    placedAt: integer("placed_at"),
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

// A profile photo is optional and opt-in; people without one get a generated face. Kept out of `users` so
// ordinary user queries never load image bytes.
export const userAvatars = sqliteTable("user_avatars", {
  userId: integer("user_id").primaryKey().references(() => users.id),
  mime: text("mime").notNull(),
  data: blob("data", { mode: "buffer" }).notNull(),
  updatedAt: integer("updated_at").notNull().default(now),
});

// A time-boxed contest on one track: "gain `goalLevels` levels before `endsAt`". Humans and simulated bots compete side by side.
export const competitions = sqliteTable("competitions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(), // unguessable id used in URLs
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  trackId: integer("track_id").notNull().references(() => tracks.id),
  createdBy: integer("created_by").notNull().references(() => users.id),
  // public: anyone can watch. private: only people who were invited or joined.
  visibility: text("visibility", { enum: ["public", "private"] }).notNull().default("private"),
  // open: any signed-in person may join a public contest. invite: only people the creator invited.
  joinPolicy: text("join_policy", { enum: ["open", "invite"] }).notNull().default("invite"),
  goalLevels: integer("goal_levels").notNull(),
  startsAt: integer("starts_at").notNull(),
  endsAt: integer("ends_at").notNull(),
  maxHumans: integer("max_humans").notNull().default(20),
  // Optional cash incentive. gglearn never holds or moves money: the organiser pays winners and records it here.
  prizeAmount: integer("prize_amount").notNull().default(0), // minor units (cents)
  prizeCurrency: text("prize_currency").notNull().default("USD"),
  prizeSplit: text("prize_split", { enum: ["winner", "top3"] }).notNull().default("winner"),
  prizeNote: text("prize_note").notNull().default(""),
  prizePaidAt: integer("prize_paid_at"),
  canceledAt: integer("canceled_at"),
  createdAt: integer("created_at").notNull().default(now),
});

export const competitionMembers = sqliteTable(
  "competition_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    competitionId: integer("competition_id").notNull().references(() => competitions.id),
    kind: text("kind", { enum: ["human", "bot"] }).notNull(),
    userId: integer("user_id").references(() => users.id), // humans only
    status: text("status", { enum: ["invited", "joined", "declined", "left"] }).notNull().default("joined"),
    joinedAt: integer("joined_at"),
    invitedBy: integer("invited_by").references(() => users.id),
    // bots only. Stored, not derived, so a finished contest never changes if the persona code does.
    botName: text("bot_name"),
    botTagline: text("bot_tagline"),
    botStyle: text("bot_style"),
    botPace: integer("bot_pace"), // XP per day
    botSeed: text("bot_seed"),
  },
  (t) => [
    uniqueIndex("cm_user").on(t.competitionId, t.userId),
    index("cm_competition").on(t.competitionId),
    index("cm_user_lookup").on(t.userId),
  ],
);

// Emails invited to a contest before they have an account. Turned into real invitations when the account is created.
export const competitionEmailInvites = sqliteTable(
  "competition_email_invites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    competitionId: integer("competition_id").notNull().references(() => competitions.id),
    email: text("email").notNull(),
    invitedBy: integer("invited_by").notNull().references(() => users.id),
  },
  (t) => [uniqueIndex("cei_unique").on(t.competitionId, t.email), index("cei_email").on(t.email)],
);

// The guided start: topic -> solo or group -> placement check -> finish line -> contest. One row per attempt.
export const journeys = sqliteTable("journeys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id),
  trackId: integer("track_id").notNull().references(() => tracks.id),
  mode: text("mode", { enum: ["solo", "group"] }).notNull(),
  emails: text("emails").notNull().default(""), // kept here, never in a URL
  step: text("step", { enum: ["level", "setup", "launched"] }).notNull().default("level"),
  // placement search: `lo` = highest level believed mastered, `hi` = highest level it could still be
  lo: integer("lo").notNull().default(0),
  hi: integer("hi").notNull().default(15),
  round: integer("round").notNull().default(0),
  pending: text("pending", { mode: "json" }).$type<number[]>(), // question ids of the batch being answered
  placed: integer("placed"), // final starting level once the check (or skip) is done
  competitionSlug: text("competition_slug"),
  createdAt: integer("created_at").notNull().default(now),
});

// Issued on request to a person who finished a contest: "champion" (best human to reach the goal) or "finisher" (reached it).
export const competitionCerts = sqliteTable(
  "competition_certs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    competitionId: integer("competition_id").notNull().references(() => competitions.id),
    userId: integer("user_id").notNull().references(() => users.id),
    kind: text("kind", { enum: ["champion", "finisher"] }).notNull(),
    place: integer("place").notNull(),
    code: text("code").notNull().unique(),
    issuedAt: integer("issued_at").notNull().default(now),
  },
  (t) => [uniqueIndex("ccert_unique").on(t.competitionId, t.userId)],
);
