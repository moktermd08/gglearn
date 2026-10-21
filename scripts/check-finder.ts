/**
 * Checks the map's problem finder, sector lens and share links: npm run check:finder (pure logic, no database).
 * The matching rules changed several times while the finder was built, and each change could quietly break a query that used to work.
 * The queries below are real sentences people might type; each says which problem must come first (or be among the results).
 */
import { MAPS } from "../lib/lifecycle/maps";
import { combineProblems, findProblems, findStops, STAGE_QUESTIONS, suggestStage } from "../lib/lifecycle/problems";
import { describeRoute, parsePick, pickQuery } from "../lib/lifecycle/share";
import { loadRoles } from "../lib/lifecycle/roles";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const biz = MAPS.business, pub = MAPS.public, soft = MAPS.software;
const ids = (q: string, m = biz, max = 5) => findProblems(q, m.PROBLEMS, max).map((p) => p.id);

// ---- sentences that must find their problem (first result) ----
const FIRST: [string, string][] = [
  ["I'm busy all the time but still broke", "busybroke"],
  ["customers pay me late", "late"],
  ["I make sales but run out of cash", "cash"],
  ["I have to sack someone", "dismiss"],
  ["my staff are burning out", "burnout"],
  ["we take ages to make decisions and then reverse them", "decisions"],
  ["I just go with my gut", "decisions"],
  ["I am always firefighting and have no time", "firefight"],
  ["nobody knows who decides what", "chaos"],
  ["I just got promoted and have to manage people", "manager"],
  ["how do I raise money from investors", "investor"],
  ["I want to win tenders", "tender2"],
  ["can I sell abroad", "export"],
  ["I'm worried about being hacked", "hacked"],
  ["I don't know how to run payroll", "payroll"],
  ["I'm a trustee and don't know my duties", "trustee"],
  ["we have a mission statement nobody uses", "mission"],
  ["I'm a plumber going self employed", "sec-trades"],
  ["I'm opening a care home", "sec-care"],
  ["I want to open a charity shop", "charity"],
  ["I run a consulting practice", "sec-services"],
  ["I make candles and sell them", "sec-making"],
];
for (const [q, want] of FIRST) check(`"${q}" finds ${want}`, ids(q)[0] === want);
check(`"I run a cafe" finds the food route`, ids("I run a cafe and don't know where to start").includes("sec-food"));
check(`"open a charity shop" does not match the food route (open is a filler word)`, !ids("I want to open a charity shop").includes("sec-food"));

// ---- nonsense and thin input ----
check("nonsense finds nothing", ids("xyzzy plugh").length === 0);
check("an empty box finds nothing", ids("").length === 0 && ids("   ").length === 0);
check("filler words alone find nothing", ids("I want to").length === 0);
check("punctuation and apostrophes do not leave stray letters (can't, don't)", !ids("too busy, can't prioritise").some((id) => id === "oneidea" || id === "whichidea"));
check("results never exceed the limit", ids("staff", biz, 3).length <= 3);
check("a weak match does not trail a strong one", ids("my staff are burning out").length === 1);

// ---- the other maps ----
check("public: 'we are being audited' finds assurance", findProblems("we are being audited", pub.PROBLEMS)[0]?.id === "p-assure");
check("public: 'buying something and need the rules' finds procurement", findProblems("I'm buying something and need to follow the rules", pub.PROBLEMS)[0]?.id === "p-procure");
check("software: 'our releases are scary' finds the release problem", findProblems("our releases are scary", soft.PROBLEMS)[0]?.id === "s-release");
check("one map's problems are never offered on another", biz.PROBLEMS.every((p) => !pub.PROBLEMS.some((q) => q.id === p.id)));

// ---- finding a stop by name ----
check("typing 'payroll' goes to the Payroll & Pensions stop", findStops("payroll", biz.STATIONS)[0]?.id === "payroll");
check("typing 'tender' finds Tenders & Bids", findStops("tenders", biz.STATIONS).some((s) => s.id === "tender"));
check("nonsense finds no stop", findStops("xyzzy", biz.STATIONS).length === 0);
check("short fragments find no stop (under three letters)", findStops("ab", biz.STATIONS).length === 0);

// ---- combining several problems ----
const both = combineProblems("late+busybroke", biz.PROBLEMS);
check("two problems combine, each stop once", !!both && new Set(both.stops).size === both.stops.length && ["invoice", "pricing"].every((s) => both.stops.includes(s)));
check("a space works as well as a plus (a + in an address becomes a space)", combineProblems("late busybroke", biz.PROBLEMS)?.id === "late+busybroke");
check("one unknown problem refuses the whole combination", combineProblems("late+nope", biz.PROBLEMS) === null);
check("an empty or missing id gives nothing", combineProblems("", biz.PROBLEMS) === null && combineProblems(null, biz.PROBLEMS) === null);
check("a combination keeps at most four problems", (combineProblems("late+cash+busybroke+nocust+leave+dismiss", biz.PROBLEMS)?.id.split("+").length ?? 0) === 4);
check("one id combines to itself", combineProblems("late", biz.PROBLEMS)?.id === "late");

// ---- the route a problem lights ----
const rt = biz.buildRoute(null, "all", "human", null, null, null, ["pricing", "profit", "numbers"]);
check("a problem lights exactly its own stops", rt.ids.size === 3 && ["pricing", "profit", "numbers"].every((s) => rt.ids.has(s)));
check("a problem's stops ignore a stage, a size and a role picked before", (() => {
  const role = loadRoles()[0];
  const r = biz.buildRoute(role as never, "all", "human", "launch", "large", 3, ["pricing", "profit", "numbers"]);
  return r.ids.size === 3 && r.deferred.size === 0;
})());
check("an unknown stop in a problem is ignored, not a crash", biz.buildRoute(null, "all", "human", null, null, null, ["pricing", "nope"]).ids.size === 1);
check("no problem leaves the normal route alone", biz.buildRoute(null, "all", "human").ids.size === biz.STATIONS.length);

// ---- share links: round trip, and junk can never break the page ----
const roles = loadRoles();
const pick = (sp: Record<string, string>, m = biz) => parsePick(sp, roles, m);
check("a problem survives a link round trip", pick({ problem: "late" }).problem === "late" && pickQuery({ ...pick({}), problem: "late" }) === "?problem=late");
check("several problems survive a link round trip", pick({ problem: "late+cash" }).problem === "late+cash");
check("a sector survives a link round trip", pick({ sector: "food" }).sector === "food" && pickQuery({ ...pick({}), sector: "food" }) === "?sector=food");
check("a problem and a sector go in one link", pickQuery({ ...pick({}), problem: "sec-food", sector: "food" }) === "?problem=sec-food&sector=food");
check("an unknown problem in a link is ignored", pick({ problem: "<script>alert(1)</script>" }).problem === null);
check("an unknown sector in a link is ignored", pick({ sector: "zzz" }).sector === null);
check("a problem from another map in a link is ignored", pick({ problem: "p-procure" }).problem === null && pick({ problem: "p-procure" }, pub).problem === "p-procure");
check("a very long junk value is ignored", pick({ problem: "x".repeat(5000) }).problem === null);
check("an array value uses its first item", parsePick({ problem: ["late", "cash"] } as never, roles, biz).problem === "late");
check("a plain map has an empty query", pickQuery(pick({})) === "");
check("a role link still works", (() => { const k = roles[0].key; return pick({ role: k }).role === k; })());
check("a sector alone gives a readable title", describeRoute({ ...pick({}), sector: "food" }, roles, biz).who.includes("Food & hospitality"));
check("a problem gives its own words as the title", describeRoute({ ...pick({}), problem: "late" }, roles, biz).who === biz.PROBLEMS.find((p) => p.id === "late")!.say);

// ---- the quick questions that name a stage ----
const stageOf = (a: Record<string, boolean>) => suggestStage(a);
check("thinking of selling or closing is the closing stage", stageOf({ leaving: true, trading: true }) === "close");
check("customers and growing is the growing stage", stageOf({ trading: true, bigger: true }) === "grow");
check("customers and steady weeks is the up-and-running stage", stageOf({ trading: true, steady: true }) === "steady");
check("customers and nothing else is the first-customers stage", stageOf({ trading: true }) === "launch");
check("getting ready to open is the setting-up stage", stageOf({ open: true }) === "setup");
check("no answers is the idea stage", stageOf({}) === "idea");
check("every stage the questions can suggest exists on the business map", ["close", "grow", "steady", "launch", "setup", "idea"].every((s) => biz.STAGE_BY_ID.has(s)));
check("every question has an id and words", STAGE_QUESTIONS.every((q) => q.id && q.ask.endsWith("?")));

// ---- sectors ----
check("a known sector gives a note on a stop it changes", !!biz.sectorNote("licence", "food"));
check("an unknown sector or no sector gives no note", biz.sectorNote("licence", "zzz") === null && biz.sectorNote("licence", null) === null);
check("a stop a sector says nothing about gives no note", biz.sectorNote("idea", "food") === null);
check("every sector's finder entry lights its key stops", biz.SECTORS.every((s) => JSON.stringify(biz.PROBLEMS.find((p) => p.id === `sec-${s.id}`)?.stops) === JSON.stringify(s.key)));

// ---- which map suits a role ----
const cloud = roles.find((r) => r.key === "cloud engineer");
check("a cloud engineer is covered far better by the Software map than the business map", !!cloud && soft.roleCoverage(cloud.core) >= biz.roleCoverage(cloud.core) + 3);
const ceo = roles.find((r) => r.key === "ceo");
check("a CEO is not pointed away from the business map", !!ceo && biz.roleCoverage(ceo.core) / ceo.core.length > 0.5);

if (fails) { console.error(`${fails} failed`); process.exit(1); }
console.log("finder ok");
