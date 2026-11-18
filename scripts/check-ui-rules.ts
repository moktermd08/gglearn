/** Checks small rules behind the interface: npm run check:uirules (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { inArray, like } from "drizzle-orm";
import { db, userScopes, users } from "../lib/db";
import { modeLabel } from "../lib/competitions";
import { glanceCounts } from "../lib/glance";
import fs from "node:fs";
import path from "node:path";
import { safeNext } from "../lib/nextPath";

process.env.GLANCE_TTL_MS = "0"; // read fresh each time
let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

function sweep() {
  const ids = db.select({ id: users.id }).from(users).where(like(users.email, "%@uirules.check")).all().map((r) => r.id);
  if (ids.length) { db.delete(userScopes).where(inArray(userScopes.userId, ids)).run(); db.delete(users).where(inArray(users.id, ids)).run(); }
}
sweep();
const person = (tag: string, role: "admin" | "manager" | "learner", over: Partial<typeof users.$inferInsert> = {}) =>
  db.insert(users).values({ email: `t-${tag}@uirules.check`, name: `t-${tag}`, jobRole: "developer", role, ...over }).returning().get();

try {
  // what a race with nobody in it is called
  check("an empty race is open, not solo", modeLabel(0, 0) === "Open: be the first");
  check("one person alone is solo", modeLabel(1, 0) === "Solo");
  check("a person against a bot", modeLabel(1, 1) === "Human vs Bot");
  check("two people", modeLabel(2, 0) === "Human vs Human");
  check("a group", modeLabel(3, 0) === "Group race");

  // the admin's "people with no company" to-do: only people it is a problem for
  const owner = person("owner", "admin");
  const boss = glanceCounts({ id: owner.id, role: "admin" });
  const before = boss.unassigned;
  person("mgr", "manager");                                  // a manager with no scopes is the platform owner too: on purpose
  person("admin2", "admin");
  person("guest", "learner", { guest: "yes" });              // came in by a contest link: not meant to have a company
  person("lost", "learner");                                 // a real gap: nobody has put them anywhere
  person("lostcust", "learner", { audience: "customer" });   // a customer with no product would start with nothing
  const after = glanceCounts({ id: owner.id, role: "admin" }).unassigned;
  check("owners, managers and guests are not counted as unassigned", after - before === 2);

  // a link may only go inside the site (also used by the invite link sign-in)
  check("login sends people to a path inside the site", safeNext("/competitions/x/join/y") === "/competitions/x/join/y");
  check("and never to another address", safeNext("https://evil.example") === null && safeNext("//evil.example") === null);
} finally {
  sweep();
}
// A list whose items are option buttons: the <li> around each option is only structure, so it must say so (role="presentation").
// Without it a screen reader sees a listbox with plain list items inside, and axe reports aria-required-children and aria-required-parent
// as critical (the role, stage, size, level and sector pickers all had this). Read from the source, so no browser is needed.
{
  const src = fs.readFileSync(path.join(process.cwd(), "components", "lifecycle", "LifecycleMap.tsx"), "utf8");
  const wrapped = [...src.matchAll(/<li\b([^>]*)>\s*<button\b[^>]*role="option"/g)];
  const bare = wrapped.filter((m) => !/role="presentation"/.test(m[1]));
  check(`every list item around an option button is marked role="presentation" (${wrapped.length} checked)`, wrapped.length >= 10 && bare.length === 0);
  if (bare.length) for (const m of bare.slice(0, 3)) console.log("     bare: <li" + m[1].slice(0, 60) + ">");
  const lists = [...src.matchAll(/<ul\b[^>]*role="listbox"[^>]*>/g)].length;
  check("the option lists are still there to check (a rename must not make the rule pass by finding nothing)", lists >= 6);
}

// a form must not sit inside a paragraph: it is invalid HTML and React fails to hydrate the page ("<form> cannot be a descendant of <p>")
{
  const files: string[] = [];
  const walk = (dir: string) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f); else if (f.endsWith(".tsx")) files.push(f); } };
  walk(path.join(process.cwd(), "app")); walk(path.join(process.cwd(), "components"));
  const bad: string[] = [];
  for (const f of files) fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => { if (/<p\b[^>]*>(?:(?!<\/p>).)*<(?:InlineAction|CvForm|KeepForm|form)\b/.test(line)) bad.push(`${path.relative(process.cwd(), f)}:${i + 1}`); });
  check(`no form sits inside a paragraph (${files.length} pages and components checked)`, files.length > 100 && bad.length === 0);
  for (const b of bad.slice(0, 5)) console.log("     form inside <p>: " + b);
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
