import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listFor } from "@/lib/competitions";
import { CompetitionCard } from "@/components/CompetitionCard";

export const metadata = { title: "Compete — gglearn" };

export default async function Competitions() {
  const user = await currentUser();
  const all = listFor(user);
  const mine = user ? listFor(user, { mineOnly: true }) : [];
  const mineIds = new Set(mine.map((m) => m.c.id));
  const open = all.filter((a) => !mineIds.has(a.c.id) && a.state !== "canceled");
  const group = (s: string) => open.filter((a) => a.state === s);

  return (
    <div className="space-y-8">
      <div className="card flex flex-wrap items-center gap-4 p-6">
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">Compete</h1>
          <p className="text-slate-300">Pick any topic, set a goal and a deadline, then race a bot, a friend or a whole group. Public contests can be watched by anyone; private ones only by the people in them.</p>
        </div>
        {user ? <Link href="/competitions/new" className="btn">Start a contest</Link> : <Link href="/login" className="btn">Sign in to compete</Link>}
      </div>

      {mine.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Your contests</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{mine.map((m) => <CompetitionCard key={m.c.id} card={m} />)}</div>
        </section>
      )}

      {(["live", "upcoming", "finished"] as const).map((s) => group(s).length > 0 && (
        <section key={s}>
          <h2 className="mb-3 text-lg font-bold">{s === "live" ? "Live now" : s === "upcoming" ? "Starting soon" : "Recently finished"} · public</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group(s).slice(0, 12).map((m) => <CompetitionCard key={m.c.id} card={m} />)}</div>
        </section>
      ))}

      {open.length === 0 && mine.length === 0 && <p className="text-slate-400">No public contests yet. Be the first to start one.</p>}
    </div>
  );
}
