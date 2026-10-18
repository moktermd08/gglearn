/**
 * The one thing the dashboard asks a person to do next. A plain function of what the page already knows, so the order can be tested and
 * changed in one place. The order is: someone is waiting on you (an invitation), then what is overdue or about to be, then today's
 * quest (which also keeps a streak alive), then a race you are in, and last a nudge to start something.
 */
export type NextInput = {
  invites: { slug: string; title: string; from: string }[];
  /** material updates to read: how many, the first title, and whether any is overdue */
  updates: { count: number; first: string; overdue: boolean };
  /** required subjects not yet passed, most urgent first */
  required: { slug: string; name: string; overdue: boolean; daysLeft: number; enrolled: boolean }[];
  /** races this person is in that are running now */
  races: { slug: string; title: string; hoursLeft: number }[];
  /** the subject to work on today, with which of today's quests are done; null when nothing is started */
  focus: { slug: string; name: string; enrolled: boolean; passed: number; done: ReadonlySet<string> } | null;
  streak: number;
  /** quests finished today, on any subject */
  questsToday: number;
  maxLevel: number;
};

export type NextAction = {
  kind: "invite" | "update" | "overdue" | "race-ending" | "due-soon" | "quest" | "start-subject" | "race" | "done" | "start";
  title: string;
  why: string;
  cta: string;
  href: string;
  /** a smaller way to do the same thing */
  also?: { label: string; href: string }[];
  xp?: number;
};

const QUESTS = [
  { k: "drill", label: "5-question drill", xp: 30, path: (s: string) => `/tracks/${s}/drill` },
  { k: "study", label: "Study guide", xp: 20, path: (s: string, lvl: number) => `/tracks/${s}/learn/${lvl}` },
  { k: "exam", label: "Level exam", xp: 40, path: (s: string) => `/tracks/${s}#levels` },
] as const;

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function nextAction(i: NextInput): NextAction {
  const inv = i.invites[0];
  if (inv) return { kind: "invite", title: `${inv.from} invited you to a race`, why: inv.title, cta: "See the invitation", href: `/competitions/${inv.slug}` };

  if (i.updates.overdue) return { kind: "update", title: "Read what changed", why: `${plural(i.updates.count, "update")} to read, and it is overdue: ${i.updates.first}`, cta: "Read it now", href: "/updates" };

  const late = i.required.find((r) => r.overdue);
  if (late) return { kind: "overdue", title: late.name, why: "Required, and past its deadline. Passing it clears it.", cta: late.enrolled ? "Continue" : "Start now", href: `/tracks/${late.slug}` };

  const ending = i.races.filter((r) => r.hoursLeft <= 48).sort((a, b) => a.hoursLeft - b.hoursLeft)[0];
  if (ending) return { kind: "race-ending", title: ending.title, why: ending.hoursLeft < 1 ? "Your race ends within the hour." : `Your race ends in ${plural(Math.floor(ending.hoursLeft), "hour")}.`, cta: "Back to the race", href: `/competitions/${ending.slug}` };

  const soon = i.required.find((r) => r.daysLeft <= 7);
  if (soon) return { kind: "due-soon", title: soon.name, why: `Required, due in ${plural(Math.max(0, soon.daysLeft), "day")}.`, cta: soon.enrolled ? "Continue" : "Start now", href: `/tracks/${soon.slug}` };

  const f = i.focus;
  if (f && f.enrolled && f.passed < i.maxLevel) {
    const left = QUESTS.filter((q) => !f.done.has(q.k));
    const first = left[0];
    if (first) {
      const nextLevel = Math.min(i.maxLevel, f.passed + 1);
      const why = i.streak > 0 && i.questsToday === 0 ? `Keep your ${plural(i.streak, "day")} streak alive. ${first.label}, +${first.xp} XP.`
        : f.passed === 0 ? `A good place to begin. ${first.label}, +${first.xp} XP.` : `Level ${nextLevel} is next. ${first.label}, +${first.xp} XP.`;
      return { kind: "quest", title: f.name, why, cta: `Start the ${first.label.toLowerCase()}`, href: first.path(f.slug, nextLevel), xp: first.xp,
        also: left.slice(1).map((q) => ({ label: `${q.label} +${q.xp}`, href: q.path(f.slug, nextLevel) })) };
    }
  }
  if (f && !f.enrolled) return { kind: "start-subject", title: f.name, why: "Required for you. It takes a minute to begin.", cta: "Start this subject", href: `/tracks/${f.slug}` };

  const race = i.races[0];
  if (race) return { kind: "race", title: race.title, why: "You are racing. Passing a level in this topic moves you up the board.", cta: "Open the race", href: `/competitions/${race.slug}` };

  if (f && f.enrolled && i.questsToday > 0) {
    return { kind: "done", title: "Today's goal is done", why: "Nothing is due. Race a friend and make it count, or take the next exam.", cta: "Race a friend", href: "/start",
      also: [{ label: `Level ${Math.min(i.maxLevel, f.passed + 1)} exam`, href: `/tracks/${f.slug}#levels` }] };
  }
  return { kind: "start", title: "Start your first race", why: "Pick any topic. Race in one tap, or find your level first.", cta: "Choose a topic", href: "/start" };
}
