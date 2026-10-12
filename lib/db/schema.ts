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
  // staff work for a company; customers use its products and only see customer-facing tracks
  audience: text("audience", { enum: ["staff", "customer"] }).notNull().default("staff"),
  // bumped to invalidate every session this person has (sign out everywhere, offboarding)
  sessionVersion: integer("session_version").notNull().default(0),
  // the look this person picked for themselves and for their rival (see lib/avatars.ts); null = the default fighter / robot
  avatarMe: text("avatar_me"),
  avatarRival: text("avatar_rival"),
  createdAt: integer("created_at").notNull().default(now),
});

// A legal company. Owns brands. Learning scope: company -> brand -> project.
export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull().default(""),
});

export const brands = sqliteTable("brands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull().default(""),
  // null = not owned by one company (shared academy content, or a personal brand)
  companyId: integer("company_id"), // -> companies.id; no inline FK, see the note above `tracks.scope`
  // company: belongs to its company. shared: academy content (Tech Foundations, Titan Academy, Software Lifecycle) that applies
  // to every staff member. personal: one person's brand outside any company. (Not a boolean: drizzle-kit drops falsy defaults.)
  kind: text("kind", { enum: ["company", "shared", "personal"] }).notNull().default("company"),
});

// A website or product that belongs to a brand (or straight to a company). Some knowledge is specific to one project.
// No brand and no company = a shared product that serves every company and brand (GGSocial, GGMoney, GGLearn).
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["website", "product", "internal"] }).notNull().default("website"),
  url: text("url").notNull().default(""),
  description: text("description").notNull().default(""),
  brandId: integer("brand_id").references(() => brands.id),
  companyId: integer("company_id").references(() => companies.id),
});

// The capability map every company needs. Pillars group topics; tracks are tagged with the pillar they teach.
export const pillars = sqliteTable("pillars", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sort: integer("sort").notNull(),
  description: text("description").notNull().default(""),
});

export const topics = sqliteTable(
  "topics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pillarId: integer("pillar_id").notNull().references(() => pillars.id),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    sort: integer("sort").notNull(),
  },
  (t) => [index("topics_pillar").on(t.pillarId)],
);

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
  // who the knowledge applies to: everyone in the company, one brand's people, or one project's team
  scope: text("scope", { enum: ["company", "brand", "project"] }).notNull().default("brand"),
  // -> projects.id and pillars.id. Columns added to an existing SQLite table by drizzle-kit get no inline FK, and
  // declaring one here would make every later `drizzle-kit push` try to rebuild the whole table. Checked in code.
  projectId: integer("project_id"),
  pillarId: integer("pillar_id"),
  // mandatory: everyone in scope must pass. role: required for the matching job roles. growth: optional, feeds promotion.
  tier: text("tier", { enum: ["mandatory", "role", "growth"] }).notNull().default("growth"),
  // who may take it. Customers only ever see "customer" and "both"; the default keeps staff material internal.
  audience: text("audience", { enum: ["staff", "customer", "both"] }).notNull().default("staff"),
  // a required track counts as done once this level is passed; the deadline runs from the day it was assigned
  requiredLevel: integer("required_level").notNull().default(5),
  dueDays: integer("due_days").notNull().default(30),
  // "admin" once an admin edits the policy, so re-seeding never overwrites it
  policySource: text("policy_source", { enum: ["seed", "admin"] }).notNull().default("seed"),
});

// Where a person belongs: which companies, brands and projects they work on (staff) or bought (customers).
// A company implies its brands for staff. Projects are always explicit.
export const userScopes = sqliteTable(
  "user_scopes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    kind: text("kind", { enum: ["company", "brand", "project"] }).notNull(),
    refId: integer("ref_id").notNull(),
  },
  (t) => [uniqueIndex("user_scope_unique").on(t.userId, t.kind, t.refId)],
);

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
    source: text("source", { enum: ["legacy-trialtest", "authored", "ai", "questions-repo", "dynamic", "twist"] }).notNull().default("authored"),
    // "generated" = a one-off snapshot of a dynamic question (lib/dynamic); never part of the stored pools
    status: text("status", { enum: ["active", "review", "retired", "generated"] }).notNull().default("active"),
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
  audience: text("audience", { enum: ["staff", "customer"] }).notNull().default("staff"),
  scopes: text("scopes").notNull().default(""), // "company:1,brand:2,project:3"
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
  // "on": one randomly chosen racer per level may amend one question for the others (see lib/twists.ts). Text, not a boolean:
  // drizzle-kit drops falsy defaults, which breaks adding a NOT NULL column to a table that already has rows.
  twist: text("twist", { enum: ["off", "on"] }).notNull().default("off"),
  canceledAt: integer("canceled_at"),
  createdAt: integer("created_at").notNull().default(now),
});

// The Architect twist: for each level of a contest, one racer is drawn at random and may rewrite ONE question for everyone else.
// The twist is a separate question row (status "generated"), so the stored pool is never edited. Rows are created server-side only.
export const contestTwists = sqliteTable(
  "contest_twists",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    competitionId: integer("competition_id").notNull().references(() => competitions.id),
    level: integer("level").notNull(),
    architectId: integer("architect_id").notNull().references(() => users.id),
    // the pool question the Architect was shown and may rewrite; it is withheld from the Architect's own exam
    baseQuestionId: integer("base_question_id").notNull().references(() => questions.id),
    // offered: waiting for the Architect. pending: written, waiting for the organiser (AI check unavailable).
    // approved: live for racers who start the level from now on. declined: the Architect passed. rejected: failed the check.
    // vetoed: organiser pulled it. expired: someone started the level first, or the Architect left.
    status: text("status", { enum: ["offered", "pending", "approved", "declined", "rejected", "vetoed", "expired"] }).notNull().default("offered"),
    twistQuestionId: integer("twist_question_id").references(() => questions.id),
    attempts: integer("attempts").notNull().default(0),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at").notNull().default(now),
    decidedAt: integer("decided_at"),
  },
  (t) => [uniqueIndex("twist_level").on(t.competitionId, t.level), index("twist_architect").on(t.architectId)],
);

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

// A record attempt: after a contest ends, anyone who can see it may start their own clock on the same goal ("gain N levels")
// and try to beat the fastest finish. Progress is read from real exams; the result is written once, when the goal is reached.
export const contestAttempts = sqliteTable(
  "contest_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    competitionId: integer("competition_id").notNull().references(() => competitions.id),
    userId: integer("user_id").notNull().references(() => users.id),
    startedAt: integer("started_at").notNull().default(now),
    startLevel: integer("start_level").notNull(), // level held when the clock started; only levels passed after count
    target: integer("target").notNull(), // levels to gain (the contest goal, capped at Titan)
    // active: clock running. finished: goal reached, durationSec is final. abandoned: the person stopped. expired: ran out of time.
    status: text("status", { enum: ["active", "finished", "abandoned", "expired"] }).notNull().default("active"),
    finishedAt: integer("finished_at"),
    durationSec: integer("duration_sec"),
  },
  (t) => [
    index("ca_competition").on(t.competitionId),
    index("ca_user").on(t.userId, t.competitionId),
    uniqueIndex("ca_one_active").on(t.competitionId, t.userId).where(sql`status = 'active'`),
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

// A promotion ladder per job role. Level 1 is where people start; each higher level lists what must be passed to reach it.
export const careerLevels = sqliteTable(
  "career_levels",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobRole: text("job_role").notNull(), // matches users.job_role, lower case
    level: integer("level").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    // what this level looks like in the three measures of the career framework (content/careers/framework.json)
    knowledge: text("knowledge").notNull().default(""),
    delivery: text("delivery").notNull().default(""),
    leadership: text("leadership").notNull().default(""), // "Communication & leadership"
  },
  (t) => [uniqueIndex("career_level_unique").on(t.jobRole, t.level)],
);

// A way across from one role's ladder to another's ("a Lead Developer can step into Engineering Manager, cto level 1").
// It lets a person aim at a role outside their own ladder: the route is the rest of their ladder, the bridge, then the target ladder.
export const careerBridges = sqliteTable(
  "career_bridges",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fromRole: text("from_role").notNull(),
    fromLevel: integer("from_level").notNull(), // the level to have reached on the old ladder
    toRole: text("to_role").notNull(),
    toLevel: integer("to_level").notNull().default(1), // the level you arrive at on the new ladder
  },
  (t) => [uniqueIndex("career_bridge_unique").on(t.fromRole, t.toRole)],
);

// "I want to be a CTO by March 2028": one goal per person.
export const careerGoals = sqliteTable("career_goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique().references(() => users.id),
  targetRole: text("target_role").notNull(),
  targetLevel: integer("target_level").notNull(),
  targetDate: integer("target_date").notNull(), // unix seconds
  createdAt: integer("created_at").notNull().default(now),
});

export const careerRequirements = sqliteTable(
  "career_requirements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    careerLevelId: integer("career_level_id").notNull().references(() => careerLevels.id),
    trackId: integer("track_id").notNull().references(() => tracks.id),
    requiredLevel: integer("required_level").notNull(), // pass this level of the track
  },
  (t) => [uniqueIndex("career_req_unique").on(t.careerLevelId, t.trackId)],
);

// A manager's decision. A person's level in their role is the latest promotion for it (or 1 if none).
export const promotions = sqliteTable(
  "promotions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    jobRole: text("job_role").notNull(),
    level: integer("level").notNull(),
    decidedBy: integer("decided_by").notNull().references(() => users.id),
    note: text("note").notNull().default(""),
    overridden: integer("overridden").notNull().default(0), // 1 = promoted without meeting every requirement
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("promotions_user").on(t.userId)],
);

// A recorded change to a knowledge item (brand moto, tone, policy...). `material` changes ask enrolled learners to review
// them; the before/after text is kept so people see what changed, not just that something did.
export const knowledgeChanges = sqliteTable(
  "knowledge_changes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemId: integer("item_id").notNull().references(() => knowledgeItems.id),
    trackId: integer("track_id").notNull().references(() => tracks.id),
    version: integer("version").notNull(), // the item's version after this change
    title: text("title").notNull(),
    note: text("note").notNull().default(""), // plain-language "what changed and why"
    before: text("before").notNull().default(""),
    after: text("after").notNull(),
    material: integer("material").notNull().default(1), // 0 = typo or wording fix, nobody is asked to review it
    createdBy: integer("created_by").references(() => users.id), // null = imported from a file
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("kc_track").on(t.trackId)],
);

// A learner confirming they have read a change.
export const knowledgeAcks = sqliteTable(
  "knowledge_acks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    changeId: integer("change_id").notNull().references(() => knowledgeChanges.id),
    at: integer("at").notNull().default(now),
  },
  (t) => [uniqueIndex("ka_unique").on(t.userId, t.changeId)],
);

// "I searched for X and found nothing": what people wish the academy taught, so authoring follows demand.
export const topicRequests = sqliteTable(
  "topic_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    text: text("text").notNull(), // lower case, trimmed
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("tr_unique").on(t.userId, t.text)],
);

// A role check: one exam drawn across the tracks of a person's ladder in the proportions of the role's question mix
// (content/blueprints). Kept apart from `runs` so it can never count as passing a single track.
export const roleExams = sqliteTable(
  "role_exams",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    role: text("role").notNull(),
    rung: integer("rung").notNull(), // the career level the check is aimed at
    plan: text("plan").notNull().default("{}"), // JSON: domain -> number of questions drawn
    score: real("score"), // 0..1, null until finished
    passed: integer("passed", { mode: "boolean" }),
    startedAt: integer("started_at").notNull().default(now),
    finishedAt: integer("finished_at"),
  },
  (t) => [index("role_exams_user").on(t.userId)],
);

export const roleExamAnswers = sqliteTable(
  "role_exam_answers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    examId: integer("exam_id").notNull().references(() => roleExams.id),
    questionId: integer("question_id").notNull().references(() => questions.id),
    domain: text("domain").notNull(),
    response: text("response").notNull().default(""),
    score: real("score").notNull().default(0), // 0..1
    feedback: text("feedback"),
  },
  (t) => [index("role_exam_answers_exam").on(t.examId)],
);

// Badges a person has earned. The catalogue lives in code (lib/progression.ts); a row is written the first time the rule is met,
// so "earned on" and "just earned" survive later changes to the underlying data.
export const userBadges = sqliteTable(
  "user_badges",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    key: text("key").notNull(),
    earnedAt: integer("earned_at").notNull().default(now),
  },
  (t) => [uniqueIndex("user_badge_unique").on(t.userId, t.key)],
);
