/** Local-only learner for trying the app: npm run seed:demo. Email and password are below; never use them anywhere real. */
import { eq } from "drizzle-orm";
import { db, enrollments, tracks, users } from "../lib/db";
import { hashPasswordSync } from "../lib/password";

const EMAIL = "demo@gglearn.local", PASSWORD = "demo-learner-local-only";
const TRACKS = ["api-claude-titan", "llm-prompting-titan", "rag-pipelines-titan"];

const u = db.select().from(users).where(eq(users.email, EMAIL)).get()
  ?? db.insert(users).values({ email: EMAIL, name: "Demo Learner", role: "learner", jobRole: "developer", passwordHash: hashPasswordSync(PASSWORD) }).returning().get();
for (const slug of TRACKS) {
  const t = db.select().from(tracks).where(eq(tracks.slug, slug)).get();
  if (t) db.insert(enrollments).values({ userId: u.id, trackId: t.id, goal: "Try the AI tracks" }).onConflictDoNothing().run();
}
console.log(`demo learner ready: ${EMAIL} (password is in scripts/seed-demo-user.ts), enrolled in ${TRACKS.join(", ")}`);
