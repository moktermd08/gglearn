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
  // "hide": left out of the weekly and monthly season boards (see lib/seasons.ts). Text, not a boolean, so it can be added to a table with rows.
  seasonBoard: text("season_board", { enum: ["show", "hide"] }).notNull().default("show"),
  // "soft": this person chose to take their learning journey in any order (see lib/journeyLock.ts). Only counts when their company allows the choice.
  // Text, not a boolean, so it can be added to a table with rows.
  journeyMode: text("journey_mode", { enum: ["inherit", "soft"] }).notNull().default("inherit"),
  // "yes": a friend who joined a contest from its invite link (lib/guestLink.ts). Not part of any company: nothing is required of them and no manager is
  // expected to set them up. Text, not a boolean, for the same reason as seasonBoard.
  guest: text("guest", { enum: ["no", "yes"] }).notNull().default("no"),
  // who brought this person in: the owner of the referral link, share card or race link they came through (lib/referrals.ts). Null for everyone else.
  referredBy: integer("referred_by"),
  // Email reminders and the weekly recap (lib/nudges.ts). Opt-in: "off" until the person says yes at sign-up, on their profile or on the dashboard;
  // "declined" once they have said no to the dashboard question, so it is not asked again. Every email carries a one-click unsubscribe.
  // Whether this person chose to play the weekly league in the cross-company arena. Only counts while their company allows it.
  openLeague: text("open_league", { enum: ["no", "yes"] }).notNull().default("no"),
  emailNudges: text("email_nudges", { enum: ["off", "on", "declined"] }).notNull().default("off"),
  createdAt: integer("created_at").notNull().default(now),
});

// A legal company. Owns brands. Learning scope: company -> brand -> project.
export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull().default(""),
  // How the academy looks for this company's people (see lib/brand.ts). Empty = the gglearn default.
  academyName: text("academy_name").notNull().default(""),
  accent: text("accent").notNull().default(""), // #rrggbb, dark enough for white text
  logo: text("logo").notNull().default(""), // a data: URL (png, jpeg or webp, 150 KB at most)
  certIssuer: text("cert_issuer").notNull().default(""), // printed under "Issued by" on certificates
  // Certificate policy (see lib/certs.ts): how long a new certificate stays valid, and who signs it. 0 months = never expires.
  // null (or 0) = never expires. Nullable on purpose: drizzle-kit cannot round-trip a NOT NULL integer DEFAULT 0 added to an existing table. As NOT NULL
  // DEFAULT 0 it tries to empty `companies` on the first push ("delete from companies"); as a SQL default it rebuilds `companies` on every later push.
  certValidMonths: integer("cert_valid_months"),
  certSigner: text("cert_signer").notNull().default(""),
  // How strictly a role's learning journey is ordered for this company's people (lib/journeyLock.ts): "hard" locks later stages until earlier ones are passed and
  // people cannot change it; "choice" (the default) is hard unless a person switches themselves to soft; "soft" never locks, it only recommends an order.
  journeyLock: text("journey_lock", { enum: ["choice", "hard", "soft"] }).notNull().default("choice"),
  certSignerTitle: text("cert_signer_title").notNull().default(""),
  // A public page at /c/<slug> in this company's own look (lib/entry.ts). "off" (the default) means there is no page; "customers" lets anyone
  // create a customer account here and take the company's customer-facing topics. `entryText` is the welcome line shown on it.
  entryMode: text("entry_mode", { enum: ["off", "customers"] }).notNull().default("off"),
  entryText: text("entry_text").notNull().default(""),
  // Whether this company's people may choose to play the weekly league against people from other companies (lib/openLeague.ts). "no" by default.
  leagueOpen: text("league_open", { enum: ["no", "yes"] }).notNull().default("no"),
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
  (t) => [uniqueIndex("questions_dedupe").on(t.trackId, t.level, t.prompt), index("q_status_track_level").on(t.status, t.trackId, t.level)],
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
}, (t) => [
  // progress, requirements, seasons and the dashboard all ask "this person's passes in this subject" or "runs finished in this window"; neither had an index
  index("runs_user_track").on(t.userId, t.trackId),
  index("runs_finished").on(t.finishedAt),
]);

export const answers = sqliteTable("answers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").notNull().references(() => runs.id),
  questionId: integer("question_id").notNull().references(() => questions.id),
  response: text("response").notNull().default(""),
  score: real("score").notNull().default(0), // 0..1
  feedback: text("feedback"),
}, (t) => [index("answers_run").on(t.runId)]);

// Onboarding / offboarding checklists and knowledge handover.
export const checklistItems = sqliteTable("checklist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  kind: text("kind", { enum: ["onboarding", "offboarding"] }).notNull(),
  label: text("label").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
}, (t) => [index("checklist_user").on(t.userId)]);

export const handovers = sqliteTable("handovers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  trackId: integer("track_id").references(() => tracks.id),
  notes: text("notes").notNull(),
  createdAt: integer("created_at").notNull().default(now),
});

// A manager confirming that someone has finished an onboarding phase (see lib/onboarding.ts). The gate: required learning
// in a later phase stays locked until every earlier phase that has any is signed. Kept as a record of who signed and when;
// undoing one marks it revoked instead of deleting it, so the history stays.
export const phaseSignoffs = sqliteTable(
  "phase_signoffs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    phase: text("phase").notNull(), // a key from PHASES in lib/onboarding.ts
    signedBy: integer("signed_by").notNull().references(() => users.id),
    note: text("note").notNull().default(""),
    signedAt: integer("signed_at").notNull().default(now),
    revokedBy: integer("revoked_by").references(() => users.id),
    revokedAt: integer("revoked_at"),
  },
  (t) => [index("ps_user").on(t.userId)],
);

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
    // null = never expires (every certificate issued before expiry existed, and any company with no validity set)
    expiresAt: integer("expires_at"),
    renewedAt: integer("renewed_at"), // set when a pass near or after expiry extended it
    // who signed it, copied from the company at issue so a later change never rewrites an old certificate
    signer: text("signer").notNull().default(""),
    signerTitle: text("signer_title").notNull().default(""),
    // keyed fingerprint of the fields above (lib/certs.ts): a record edited in the database no longer matches it. "" = issued before signatures.
    signature: text("signature").notNull().default(""),
    // Revoked by an admin (see lib/certsAdmin.ts). Still shown at /cert/<code>, marked revoked; never renewed. The reason is for admins only.
    revokedAt: integer("revoked_at"),
    revokedBy: integer("revoked_by"), // -> users.id; no inline FK, see the note above `tracks.scope`
    revokedReason: text("revoked_reason").notNull().default(""),
  },
  (t) => [uniqueIndex("cert_unique").on(t.userId, t.trackId, t.level), index("cert_expires").on(t.expiresAt)],
);

// Every revocation and reinstatement of a certificate, kept even after the certificate is reinstated.
export const certificateEvents = sqliteTable(
  "certificate_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    certificateId: integer("certificate_id").notNull().references(() => certificates.id),
    kind: text("kind", { enum: ["revoked", "reinstated"] }).notNull(),
    byUser: integer("by_user").notNull().references(() => users.id),
    reason: text("reason").notNull().default(""),
    at: integer("at").notNull().default(now),
  },
  (t) => [index("cert_event_cert").on(t.certificateId)],
);

// Signup is invite-only. A manager issues one; the token itself is shown once and only its hash is stored.
export const invites = sqliteTable("invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email").notNull(), // the invite only works for this address
  jobRole: text("job_role").notNull(),
  audience: text("audience", { enum: ["staff", "customer"] }).notNull().default("staff"),
  scopes: text("scopes").notNull().default(""), // "company:1,brand:2,project:3"
  // the access level the person gets on joining (see lib/accessLevel.ts); checked again when the invite is used, since the inviter may have changed
  role: text("role", { enum: ["admin", "manager", "learner"] }).notNull().default("learner"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull().default(now),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
});

// A team anyone can start: friends, a class, a study group, a community. Its members see each other's names, levels and weekly XP, and the owner can
// start a race for all of them. Not tied to a company; a person can be in a team and in a company at once. The join link is the row id plus a
// signature (lib/teams.ts); `joinOpen` switches it on and off, and `archivedAt` closes the team.
export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  joinOpen: integer("join_open", { mode: "boolean" }).notNull().default(true),
  // "class": the owner is a teacher who sees every student's progress and sets assignments; students see only their own (lib/classes.ts). "team": everyone sees the weekly board.
  kind: text("kind", { enum: ["team", "class"] }).notNull().default("team"),
  createdAt: integer("created_at").notNull().default(now),
  archivedAt: integer("archived_at"),
});
export const teamMembers = sqliteTable("team_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teams.id),
  userId: integer("user_id").notNull().references(() => users.id),
  joinedAt: integer("joined_at").notNull().default(now),
}, (t) => [uniqueIndex("team_members_unique").on(t.teamId, t.userId), index("team_members_user").on(t.userId)]);

// Streak freezes (lib/freezes.ts): a ledger of freezes a person was given ("grant") and spent ("used", with the missed day it covered). What they hold is
// grants minus used. The unique key stops the same milestone being paid twice and the same day being covered twice.
export const streakFreezes = sqliteTable("streak_freezes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  kind: text("kind", { enum: ["grant", "used"] }).notNull(),
  key: text("key").notNull(), // "welcome", "s7:<first day of the streak>:<7|14|...>" or "used:<day>"
  day: text("day"), // for "used": the missed day it covered (YYYY-MM-DD, UTC)
  createdAt: integer("created_at").notNull().default(now),
}, (t) => [uniqueIndex("streak_freezes_unique").on(t.userId, t.key)]);

// An emailed sign-in link (lib/loginLink.ts): sign in without a password. Only the token's hash is kept, it works once, and it lasts 15 minutes.
export const loginLinks = sqliteTable("login_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at").notNull().default(now),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
}, (t) => [index("login_link_user").on(t.userId)]);

// A password-reset link (lib/passwordReset.ts). Only the hash of the token is kept, it works once, and it expires an hour after it is asked for.
export const passwordResets = sqliteTable("password_resets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at").notNull().default(now),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
}, (t) => [index("password_reset_user").on(t.userId)]);

// One row per reminder or recap sent to a person: the unique key is what stops the same email going twice, even if two runs overlap.
export const emailLog = sqliteTable("email_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  kind: text("kind").notNull(), // "recap" | "streak"
  key: text("key").notNull(), // the week (recap) or the day (streak) it was for
  sentAt: integer("sent_at").notNull().default(now),
}, (t) => [uniqueIndex("email_log_unique").on(t.userId, t.kind, t.key)]);

// Friends (lib/friends.ts). A friendship is mutual and agreed: a request the other person accepts, or a friend link both people used. `requesterId` asked,
// `addresseeId` was asked (for a link, the person who shared it asked and the person who opened it agreed). Friends see each other's week and real achievements.
export const friendships = sqliteTable("friendships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requesterId: integer("requester_id").notNull().references(() => users.id),
  addresseeId: integer("addressee_id").notNull().references(() => users.id),
  status: text("status", { enum: ["pending", "accepted"] }).notNull().default("pending"),
  createdAt: integer("created_at").notNull().default(now),
  respondedAt: integer("responded_at"),
}, (t) => [uniqueIndex("friendship_pair").on(t.requesterId, t.addresseeId), index("friendship_addressee").on(t.addresseeId, t.status)]);

// A cheer: one friend's thumbs-up on one thing another friend did. One per person per event. `eventKey` names the event in the feed (lib/friends.ts).
export const cheers = sqliteTable("cheers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromId: integer("from_id").notNull().references(() => users.id),
  toId: integer("to_id").notNull().references(() => users.id),
  eventKey: text("event_key").notNull(),
  createdAt: integer("created_at").notNull().default(now),
}, (t) => [uniqueIndex("cheer_unique").on(t.fromId, t.eventKey), index("cheer_to").on(t.toId)]);

// A teacher's assignment for a class: reach this level in this topic by this date. Whether a student has done it is worked out from their real exams, never stored.
export const classAssignments = sqliteTable("class_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teams.id),
  trackId: integer("track_id").notNull().references(() => tracks.id),
  level: integer("level").notNull(), // the level to have passed
  dueAt: integer("due_at").notNull(),
  createdAt: integer("created_at").notNull().default(now),
  removedAt: integer("removed_at"),
}, (t) => [index("class_assignment_team").on(t.teamId)]);

// A mentor: someone a learner chose to share their progress and goals with (lib/mentoring.ts). The learner (mentee) invites; the mentor accepts; either can end it.
export const mentorships = sqliteTable("mentorships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mentorId: integer("mentor_id").notNull().references(() => users.id),
  menteeId: integer("mentee_id").notNull().references(() => users.id),
  // mentor: chosen by the learner to coach them. parent: a parent or guardian following a child's progress (lib/mentoring.ts). Same consent, different words and caps.
  kind: text("kind", { enum: ["mentor", "parent"] }).notNull().default("mentor"),
  createdAt: integer("created_at").notNull().default(now),
}, (t) => [uniqueIndex("mentorship_pair").on(t.mentorId, t.menteeId), index("mentorship_mentee").on(t.menteeId)]);

// Someone who backs a learner to reach a level in one topic (lib/sponsors.ts). The learner asks (a signed link naming the topic and level); the sponsor presses a button.
// The sponsor sees progress on that one goal and nothing else, and is told when it is reached.
export const sponsorships = sqliteTable("sponsorships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sponsorId: integer("sponsor_id").notNull().references(() => users.id),
  learnerId: integer("learner_id").notNull().references(() => users.id),
  trackId: integer("track_id").notNull().references(() => tracks.id),
  level: integer("level").notNull(),
  createdAt: integer("created_at").notNull().default(now),
  reachedAt: integer("reached_at"),
  endedAt: integer("ended_at"),
}, (t) => [uniqueIndex("sponsorship_goal").on(t.sponsorId, t.learnerId, t.trackId, t.level), index("sponsorship_learner").on(t.learnerId)]);

// One link for a whole team: anyone who opens it can create their own account in the company, brand or project it names, until it is full,
// expires or is switched off. Learner access only, whoever made it. The link itself is not stored: it is the row id plus a signature
// (lib/joinLinks.ts), so a manager can copy it again later and a revoked row stops it at once.
export const joinLinks = sqliteTable("join_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull().default(""),
  jobRole: text("job_role").notNull(),
  audience: text("audience", { enum: ["staff", "customer"] }).notNull().default("staff"),
  scopes: text("scopes").notNull().default(""), // "company:1,brand:2,project:3"
  createdBy: integer("created_by").notNull().references(() => users.id),
  maxUses: integer("max_uses").notNull(),
  uses: integer("uses").notNull().default(0),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
  createdAt: integer("created_at").notNull().default(now),
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
  // "company:1" or "brand:2": only people in that company or brand can be invited or join. Null = anyone the other settings allow.
  // Nullable on purpose, like canceledAt: adding a NOT NULL column to a table with rows is what drizzle-kit trips on.
  scope: text("scope"),
  // The invite link (lib/guestLink.ts): null = off, otherwise the version the link's signed key is made from. A new link is a new version,
  // so the old one stops working. Nullable on purpose, like canceledAt: adding a NOT NULL column to a table with rows is what drizzle-kit trips on.
  guestLinkVersion: integer("guest_link_version"),
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

// Weekly and monthly seasons. Standings are computed from exams and quests on read; once a season has ended its final standings
// are written here once (season_closed marks it settled), so a finished season never changes. Ranks are within the person's audience.
export const seasonClosed = sqliteTable(
  "season_closed",
  {
    kind: text("kind", { enum: ["week", "month"] }).notNull(),
    key: text("key").notNull(), // 2026-W41 or 2026-10
    settledAt: integer("settled_at").notNull().default(now),
  },
  (t) => [uniqueIndex("season_closed_pk").on(t.kind, t.key)],
);

// Live duels (lib/duel.ts, lib/duelRules.ts): a short head-to-head quiz two people play at the same moment, or one person plays against a simulated rival.
// The schedule is never stored: it is worked out from `startedAt` (server milliseconds) and the answers' own times.
export const duels = sqliteTable("duels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(), // unguessable: it is the link
  trackId: integer("track_id").notNull().references(() => tracks.id),
  hostId: integer("host_id").notNull().references(() => users.id),
  guestId: integer("guest_id").references(() => users.id), // null while waiting, and when the opponent is a simulated rival
  botSeed: text("bot_seed"), // set when the opponent is a simulated rival; it decides its whole match
  status: text("status", { enum: ["waiting", "live", "done", "canceled"] }).notNull().default("waiting"),
  questionIds: text("question_ids", { mode: "json" }).$type<number[]>(),
  startedAt: integer("started_at"), // server ms: the countdown begins here
  createdAt: integer("created_at").notNull().default(now),
  finishedAt: integer("finished_at"),
  hostPoints: integer("host_points"),
  guestPoints: integer("guest_points"), // the simulated rival's too, when there is one
});
export const duelAnswers = sqliteTable("duel_answers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  duelId: integer("duel_id").notNull().references(() => duels.id),
  userId: integer("user_id").notNull().references(() => users.id),
  qIndex: integer("q_index").notNull(),
  choice: text("choice").notNull(),
  correct: integer("correct", { mode: "boolean" }).notNull(),
  afterMs: integer("after_ms").notNull(), // how long after the question opened
  points: integer("points").notNull(),
  answeredAt: integer("answered_at").notNull(), // server ms
}, (t) => [uniqueIndex("duel_answer_unique").on(t.duelId, t.userId, t.qIndex)]);

// The weekly league (lib/league.ts). One row per person per week they took part: the tier they played in, their cohort of up to 30, and, once the week is
// settled, their points, rank and what happened (moved up, down or stayed). Next week's tier is worked out from the last settled row, so nothing drifts.
export const leagueEntries = sqliteTable(
  "league_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(), // the week, like 2026-W41
    audience: text("audience", { enum: ["staff", "customer"] }).notNull(),
    arena: text("arena").notNull(), // who competes with whom (lib/arena.ts)
    userId: integer("user_id").notNull().references(() => users.id),
    tier: integer("tier").notNull(), // 0 = Bronze ... 7 = Diamond
    cohort: integer("cohort").notNull(), // 1, 2, 3... within the same week, audience, arena and tier
    points: integer("points"),
    rank: integer("rank"),
    outcome: text("outcome", { enum: ["up", "down", "stay"] }),
  },
  (t) => [uniqueIndex("league_entry_unique").on(t.key, t.userId), index("league_entry_group").on(t.key, t.audience, t.arena, t.tier, t.cohort), index("league_entry_user").on(t.userId)],
);
export const leagueClosed = sqliteTable("league_closed", { key: text("key").primaryKey(), settledAt: integer("settled_at").notNull().default(now) });

export const seasonResults = sqliteTable(
  "season_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: ["week", "month"] }).notNull(),
    key: text("key").notNull(),
    userId: integer("user_id").notNull().references(() => users.id),
    rank: integer("rank").notNull(),
    points: integer("points").notNull(),
    levels: integer("levels").notNull(),
    days: integer("days").notNull(),
    players: integer("players").notNull(), // how many people were ranked in that audience
  },
  (t) => [uniqueIndex("season_result_unique").on(t.kind, t.key, t.userId), index("season_result_user").on(t.userId)],
);

// In-app notifications. `key` makes each event idempotent per person (one badge, one season result, one level), so the code that
// notices an event may run any number of times. Rows created when someone first opens a feature are born read (no backfill spam).
export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    key: text("key").notNull(),
    kind: text("kind", { enum: ["badge", "level", "season", "contest", "system"] }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href").notNull().default(""),
    createdAt: integer("created_at").notNull().default(now),
    readAt: integer("read_at"),
  },
  (t) => [uniqueIndex("notification_unique").on(t.userId, t.key), index("notification_user").on(t.userId, t.readAt)],
);

// A public, opt-in share card. It is a frozen snapshot made server-side from real data when the person presses Share, shows only
// a first name and initial, and can be revoked. Anyone with the code can see it; nothing else about the person is exposed.
export const shareCards = sqliteTable(
  "share_cards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    userId: integer("user_id").notNull().references(() => users.id),
    kind: text("kind", { enum: ["badge", "season", "level", "streak", "pass", "cert", "race", "league", "duel"] }).notNull(),
    ref: text("ref").notNull(), // what it is about: a badge key, "week:2026-W41", "level", "streak"
    headline: text("headline").notNull(), // the big text on the card: "#2", "Level 12", "30 days"
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    tone: text("tone").notNull().default("indigo"), // bronze | silver | gold | legend | indigo | orange
    name: text("name").notNull(), // first name and initial, as shown on boards
    createdAt: integer("created_at").notNull().default(now),
    revokedAt: integer("revoked_at"),
  },
  (t) => [index("share_user").on(t.userId), uniqueIndex("share_active").on(t.userId, t.kind, t.ref).where(sql`revoked_at is null`)],
);

// What passing a level earns, set by whoever owns the content. One rule per (scope, level, kind); the most specific wins
// (track, then brand, then company). An "off" rule switches that reward off at its scope and below. See lib/rewards.ts.
export const rewardRules = sqliteTable(
  "reward_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scope: text("scope", { enum: ["company", "brand", "track"] }).notNull(),
    refId: integer("ref_id").notNull(), // companies.id, brands.id or tracks.id, checked in code
    level: integer("level").notNull(), // the track level whose first pass earns it
    kind: text("kind", { enum: ["certificate", "xp", "voucher", "money"] }).notNull(),
    enabled: text("enabled", { enum: ["on", "off"] }).notNull().default("on"),
    amount: integer("amount").notNull().default(0), // xp points, or money in minor units
    currency: text("currency").notNull().default(""),
    label: text("label").notNull().default(""), // what a voucher is for
    maxAwards: integer("max_awards").notNull().default(0), // budget cap; required for voucher and money, 0 = no cap otherwise
    createdBy: integer("created_by").references(() => users.id),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("reward_rule_slot").on(t.scope, t.refId, t.level, t.kind)],
);

// The ledger: one row per reward given. Unique per person, rule, track and level, so a retake never pays twice.
// gglearn never holds or moves money: a voucher or money award starts "pending" and the company marks it fulfilled once it has paid.
export const rewardAwards = sqliteTable(
  "reward_awards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    ruleId: integer("rule_id").notNull(),
    trackId: integer("track_id").notNull().references(() => tracks.id),
    level: integer("level").notNull(),
    kind: text("kind", { enum: ["certificate", "xp", "voucher", "money"] }).notNull(),
    amount: integer("amount").notNull().default(0),
    currency: text("currency").notNull().default(""),
    label: text("label").notNull().default(""),
    status: text("status", { enum: ["granted", "pending", "fulfilled", "void"] }).notNull(),
    reference: text("reference").notNull().default(""), // how it was paid: a voucher code, a payment reference
    settledBy: integer("settled_by").references(() => users.id),
    settledAt: integer("settled_at"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("reward_award_once").on(t.userId, t.ruleId, t.trackId, t.level), index("reward_award_user").on(t.userId), index("reward_award_status").on(t.status)],
);

// ---- Company and brand profile -------------------------------------------------------------------------------------------------
// What the company or brand knows about itself, so a new person can operate and contribute. The sections and their fields are defined
// in code (lib/profile.ts), so adding a question never needs a migration: one row here is one answered field. An empty value is a
// cleared answer. Not a boolean anywhere: drizzle-kit drops falsy defaults (see `companies`).
export const profileEntries = sqliteTable(
  "profile_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scope: text("scope", { enum: ["company", "brand"] }).notNull(),
    refId: integer("ref_id").notNull(), // companies.id or brands.id, checked in code
    section: text("section").notNull(), // key of a section in lib/profile.ts
    field: text("field").notNull(), // key of a field in that section
    value: text("value").notNull().default(""),
    updatedBy: integer("updated_by").references(() => users.id),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("profile_entry_slot").on(t.scope, t.refId, t.section, t.field)],
);

// Per section: who owns it, and whether it applies. "na" = reviewed and does not apply (a brand with no investors), so it stops counting
// against completeness. reviewedAt feeds the staleness check.
export const profileSections = sqliteTable(
  "profile_sections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scope: text("scope", { enum: ["company", "brand"] }).notNull(),
    refId: integer("ref_id").notNull(),
    section: text("section").notNull(),
    status: text("status", { enum: ["open", "na"] }).notNull().default("open"),
    ownerId: integer("owner_id").references(() => users.id),
    reviewedAt: integer("reviewed_at"),
    reviewedBy: integer("reviewed_by").references(() => users.id),
  },
  (t) => [uniqueIndex("profile_section_slot").on(t.scope, t.refId, t.section)],
);

// ---- Tool access register ------------------------------------------------------------------------------------------------------
// Every system people use (GitHub, Slack, the bank portal...), who owns it, and how to take access away.
export const tools = sqliteTable(
  "tools",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull().default("other"), // see TOOL_CATEGORIES in lib/access.ts
    scope: text("scope", { enum: ["global", "company", "brand"] }).notNull().default("company"), // global: every company
    refId: integer("ref_id").notNull().default(0), // companies.id or brands.id; 0 when global
    ownerId: integer("owner_id").references(() => users.id), // who grants and revokes
    // sensitive: money, production, customer data. Revoked first, and offboarding is not complete until it is.
    sensitivity: text("sensitivity", { enum: ["standard", "sensitive"] }).notNull().default("standard"),
    revokeSteps: text("revoke_steps").notNull().default(""), // how to take access away, in plain words
    retired: text("retired", { enum: ["no", "yes"] }).notNull().default("no"),
  },
  (t) => [index("tools_scope").on(t.scope, t.refId)],
);

// Which access a job role gets by default. Drives the onboarding checklist, and what changes on a role change.
export const toolRoleAccess = sqliteTable(
  "tool_role_access",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    toolId: integer("tool_id").notNull().references(() => tools.id),
    jobRole: text("job_role").notNull(), // users.jobRole, or "*" for everyone in the tool's scope
    level: text("level", { enum: ["user", "admin", "owner"] }).notNull().default("user"),
  },
  (t) => [uniqueIndex("tool_role_slot").on(t.toolId, t.jobRole)],
);

// One row per grant, kept after it ends: revokedAt set = no longer has it. The history answers "who had what, when".
export const toolAccess = sqliteTable(
  "tool_access",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    toolId: integer("tool_id").notNull().references(() => tools.id),
    level: text("level", { enum: ["user", "admin", "owner"] }).notNull().default("user"),
    reason: text("reason", { enum: ["onboarding", "role_change", "promotion", "request", "other"] }).notNull().default("onboarding"),
    grantedBy: integer("granted_by").references(() => users.id),
    grantedAt: integer("granted_at").notNull().default(now),
    revokedAt: integer("revoked_at"),
    revokedBy: integer("revoked_by").references(() => users.id),
    revokeReason: text("revoke_reason", { enum: ["offboarding", "role_change", "demotion", "no_longer_needed", "security", "other"] }),
  },
  (t) => [index("tool_access_user").on(t.userId), index("tool_access_tool").on(t.toolId)],
);

// A change of job role, and why. Promotion and demotion are different decisions from a sideways move, so the kind is kept.
// `actions` is the list of things to do in the tools (add, raise, lower, remove access), kept as text so the history reads as it was.
export const roleChanges = sqliteTable(
  "role_changes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    fromRole: text("from_role").notNull(),
    toRole: text("to_role").notNull(),
    kind: text("kind", { enum: ["promotion", "demotion", "role_change"] }).notNull(),
    note: text("note").notNull().default(""),
    actions: text("actions").notNull().default(""),
    decidedBy: integer("decided_by").notNull().references(() => users.id),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("role_changes_user").on(t.userId)],
);

// A starting level given to a person in a track, outside the exams: by a manager or admin, or from what their role normally holds.
// It lifts where they start and unlocks what comes next, and it never becomes an exam pass: certificates still need the exam. Only an
// admin may mark one "counts as complete", which lets it satisfy required training. Rows are never deleted: a revoked one stays as the record.
export const levelCredits = sqliteTable(
  "level_credits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    trackId: integer("track_id").notNull().references(() => tracks.id),
    level: integer("level").notNull(),
    source: text("source", { enum: ["manager", "admin", "role"] }).notNull(),
    grantedBy: integer("granted_by").notNull().references(() => users.id), // the person themselves for a role start they accepted
    reason: text("reason").notNull().default(""),
    countsAsComplete: integer("counts_as_complete", { mode: "boolean" }).notNull().default(false),
    expiresAt: integer("expires_at"),
    revokedAt: integer("revoked_at"),
    revokedBy: integer("revoked_by").references(() => users.id),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("level_credits_user").on(t.userId, t.trackId)],
);

// A question a company or brand adds to its own profile, on top of the built-in ones (lib/profile.ts). Retired, never deleted, so
// answers already given are kept. `columns` is a JSON list of {key, label} for kind "table" (a list of rows, e.g. KPIs), else empty.
export const profileFields = sqliteTable(
  "profile_fields",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scope: text("scope", { enum: ["company", "brand"] }).notNull(),
    refId: integer("ref_id").notNull(),
    section: text("section").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    hint: text("hint").notNull().default(""),
    kind: text("kind", { enum: ["text", "long", "table"] }).notNull().default("long"),
    columns: text("columns").notNull().default(""),
    required: text("required", { enum: ["no", "yes"] }).notNull().default("no"),
    retired: text("retired", { enum: ["no", "yes"] }).notNull().default("no"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("profile_field_slot").on(t.scope, t.refId, t.section, t.key)],
);

// ---- Exam integrity ------------------------------------------------------------------------------------------------------------
// How carefully an exam is watched, set in layers: the whole academy (scope "global", ref 0), a company, a brand, a track. A row holds only
// what that layer sets (`settings` is JSON: { v: {key: value}, lock: [key] }); everything else is inherited, and a key a wider layer has
// locked cannot be changed below it. See lib/integrity/policy.ts.
export const integrityPolicies = sqliteTable(
  "integrity_policies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scope: text("scope", { enum: ["global", "company", "brand", "track"] }).notNull(),
    refId: integer("ref_id").notNull(), // 0 for global, else companies.id, brands.id or tracks.id, checked in code
    settings: text("settings").notNull().default("{}"),
    updatedBy: integer("updated_by").references(() => users.id),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("integrity_policy_slot").on(t.scope, t.refId)],
);

// One watched exam attempt (a level run or a role check). `policy` is the resolved policy as it stood when the attempt began, so changing
// the policy later never rewrites what an earlier attempt was held to. `award` says whether a passing result's certificate and rewards were
// given straight away or are waiting for a person to look (status "review").
export const integritySessions = sqliteTable(
  "integrity_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    examKind: text("exam_kind", { enum: ["run", "role"] }).notNull(),
    examId: integer("exam_id").notNull(), // runs.id or role_exams.id
    userId: integer("user_id").notNull().references(() => users.id),
    trackId: integer("track_id"), // runs only
    level: integer("level").notNull().default(0),
    policy: text("policy").notNull(),
    consentAt: integer("consent_at"),
    status: text("status", { enum: ["open", "clear", "review", "cleared", "rejected"] }).notNull().default("open"),
    award: text("award", { enum: ["released", "held"] }).notNull().default("released"),
    score: integer("score").notNull().default(0), // risk 0..100
    flags: text("flags").notNull().default("[]"), // JSON: [{key, label, points, count}]
    note: text("note").notNull().default(""),
    reviewedBy: integer("reviewed_by").references(() => users.id),
    reviewedAt: integer("reviewed_at"),
    createdAt: integer("created_at").notNull().default(now),
    finishedAt: integer("finished_at"),
  },
  (t) => [uniqueIndex("integrity_session_exam").on(t.examKind, t.examId), index("integrity_session_status").on(t.status), index("integrity_session_user").on(t.userId)],
);

export const integrityEvents = sqliteTable(
  "integrity_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id").notNull().references(() => integritySessions.id),
    kind: text("kind").notNull(),
    detail: text("detail").notNull().default(""),
    at: integer("at").notNull().default(now),
  },
  (t) => [index("integrity_event_session").on(t.sessionId)],
);

// Small webcam stills (320px JPEG), kept only as long as the policy's retention says. Reviewed by a person; nothing here is matched by software.
export const integritySnapshots = sqliteTable(
  "integrity_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id").notNull().references(() => integritySessions.id),
    tag: text("tag", { enum: ["start", "random"] }).notNull(),
    faces: integer("faces"), // faces the browser counted, when it can; null = unknown
    data: blob("data", { mode: "buffer" }).notNull(),
    at: integer("at").notNull().default(now),
  },
  (t) => [index("integrity_snapshot_session").on(t.sessionId)],
);

// Directory sync (lib/scim.ts). A company's identity provider (Okta, Entra ID, Google Workspace...) calls our SCIM endpoints with one of these tokens to create,
// update and switch off its people. Only the SHA-256 of a token is kept; the token itself is shown once, when it is made.
export const directoryTokens = sqliteTable("directory_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id),
  label: text("label").notNull().default(""),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at").notNull().default(now),
  lastUsedAt: integer("last_used_at"),
  revokedAt: integer("revoked_at"),
}, (t) => [index("directory_token_company").on(t.companyId)]);

// The people a company's directory manages: only these can be changed through sync, never anyone else (an admin, someone in two companies, a stranger).
export const directoryUsers = sqliteTable("directory_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id),
  userId: integer("user_id").notNull().references(() => users.id),
  externalId: text("external_id").notNull().default(""),
  createdAt: integer("created_at").notNull().default(now),
}, (t) => [uniqueIndex("directory_user_pair").on(t.companyId, t.userId), index("directory_user_user").on(t.userId)]);

// Single sign-on for a company (lib/sso.ts): its OpenID Connect provider, the email domains that belong to it, and the rules for who may come in this way.
// The client secret is stored encrypted (AES-GCM, key derived from SESSION_SECRET), never in clear.
export const companySso = sqliteTable("company_sso", {
  companyId: integer("company_id").primaryKey().references(() => companies.id),
  enabled: text("enabled", { enum: ["no", "yes"] }).notNull().default("no"),
  issuer: text("issuer").notNull().default(""),
  clientId: text("client_id").notNull().default(""),
  clientSecret: text("client_secret").notNull().default(""),
  domains: text("domains").notNull().default(""), // comma-separated email domains
  jit: text("jit", { enum: ["no", "yes"] }).notNull().default("no"), // create an account on first sign-in for someone in those domains
  enforce: text("enforce", { enum: ["no", "yes"] }).notNull().default("no"), // learners and managers here must use SSO (admins can always use a password)
  verifiedAt: integer("verified_at"), // set when someone first signs in through it; SSO can only be enforced after that, so a wrong setting cannot lock a company out
  updatedAt: integer("updated_at").notNull().default(now),
});

// A sign-in with a personal Google or Microsoft account that belongs to one gglearn account (lib/social.ts). The provider's own stable id (`sub`) is what counts, not the
// email, so a changed email at the provider never moves an identity to someone else.
export const oauthIdentities = sqliteTable("oauth_identities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider", { enum: ["google", "microsoft"] }).notNull(),
  subject: text("subject").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  email: text("email").notNull().default(""), // as the provider reported it when linked; for display only
  createdAt: integer("created_at").notNull().default(now),
}, (t) => [uniqueIndex("oauth_identity_unique").on(t.provider, t.subject), index("oauth_identity_user").on(t.userId)]);

// What people pick in a map's problem finder, as anonymous daily counts (see lib/problemLog.ts): no person, no address and no typed
// text, only "this problem was picked this many times on this day". `kind` is a pick of a problem, a jump to a named stop, or a
// search that found nothing (`problem` is then empty). It shows which of the many problems people really have.
export const problemPicks = sqliteTable(
  "problem_picks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    day: text("day").notNull(), // UTC date, YYYY-MM-DD
    map: text("map").notNull(), // "business", "public" or "software"
    kind: text("kind", { enum: ["pick", "stop", "nomatch"] }).notNull(),
    problem: text("problem").notNull().default(""), // a problem id (pick), a stop id (stop) or "" (nomatch)
    n: integer("n").notNull().default(0),
  },
  (t) => [uniqueIndex("problem_pick_unique").on(t.day, t.map, t.kind, t.problem), index("problem_pick_day").on(t.day)],
);
