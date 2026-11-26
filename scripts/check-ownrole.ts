/** Who may say what their own job is: npm run check:ownrole (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { eq, inArray, like } from "drizzle-orm";
import { careerGoals, careerLevels, db, enrollments, roleChanges, userScopes, users } from "../lib/db";
import { chooseOwnRole, mayChooseOwnRole } from "../lib/ownRole";
import { journeyFor } from "../lib/journey";
import { requirementsFor } from "../lib/paths";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const ROLE = "own role check";
const sweep = () => {
  const ids = db.select({ id: users.id }).from(users).where(like(users.email, "%@ownrole.check")).all().map((u) => u.id);
  if (ids.length) {
    for (const t of [roleChanges, userScopes, enrollments, careerGoals]) db.delete(t).where(inArray(t.userId, ids)).run();
    db.delete(users).where(inArray(users.id, ids)).run();
  }
  db.delete(careerLevels).where(eq(careerLevels.jobRole, ROLE)).run();
};
sweep();
try {
  db.insert(careerLevels).values([{ jobRole: ROLE, level: 1, title: "Starter" }, { jobRole: ROLE, level: 2, title: "Next" }]).run();
  let n = 0;
  const mk = (over: Partial<typeof users.$inferInsert> = {}) => db.insert(users).values({ name: "p", email: `p${++n}@ownrole.check`, jobRole: "general", audience: "staff", guest: "yes", role: "learner", passwordHash: "x", ...over }).returning().get();
  const me = (id: number) => db.select().from(users).where(eq(users.id, id)).get()!;

  const solo = mk();
  check("someone with no job role has no journey yet", journeyFor(solo).state === "no-ladder");
  check("someone who signed up on their own may say their job", mayChooseOwnRole(solo));
  check("a job that is not on the list is refused", "error" in chooseOwnRole(solo, "astronaut of nowhere") && me(solo.id).jobRole === "general");
  check("choosing a job sets it", "ok" in chooseOwnRole(solo, "  Own Role Check ") && me(solo.id).jobRole === ROLE);
  const j = journeyFor(me(solo.id));
  check("and a journey appears, starting at the first level", j.state === "ok" && j.here.title === "Starter");
  const log = db.select().from(roleChanges).where(eq(roleChanges.userId, solo.id)).all();
  check("the change is on record, as their own", log.length === 1 && log[0].decidedBy === solo.id && log[0].fromRole === "general" && log[0].toRole === ROLE);
  check("nothing becomes required of them", db.select().from(enrollments).where(eq(enrollments.userId, solo.id)).all().length === 0);
  check("nor is anything counted as required when their learning is worked out", requirementsFor(me(solo.id), []).length === 0);
  check("choosing the same job again records nothing new", "ok" in chooseOwnRole(me(solo.id), ROLE) && db.select().from(roleChanges).where(eq(roleChanges.userId, solo.id)).all().length === 1);

  const refused: [string, ReturnType<typeof mk>][] = [
    ["someone placed in a company", mk()],
    ["an account a company made", mk({ guest: "no" })],
    ["an admin", mk({ role: "admin" })],
    ["a manager", mk({ role: "manager" })],
    ["a customer", mk({ audience: "customer" })],
    ["a deactivated person", mk({ status: "offboarded" })],
  ];
  db.insert(userScopes).values({ userId: refused[0][1].id, kind: "company", refId: 1 }).run();
  for (const [who, u] of refused) check(`${who} may not`, !mayChooseOwnRole(u) && "error" in chooseOwnRole(u, ROLE) && me(u.id).jobRole === "general");
} finally {
  sweep();
}
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
