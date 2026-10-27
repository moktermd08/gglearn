import { escapeHtml, type Mail } from "@/lib/mail";

/**
 * The two reminder emails, as plain text and HTML. Pure: everything they say comes in as data, and every name that came from a person is escaped.
 * Each carries the reason it was sent and a one-click unsubscribe, and sets the List-Unsubscribe headers mail apps use for their own button.
 */
export type Recap = {
  name: string; academy: string; base: string; unsubscribe: string;
  xp: number; newLevels: number; activeDays: number; streak: number;
  /** the subject worked on most this week, and how that stands against its rival */
  topic?: { name: string; passed: number; rival: string; rivalLevel: number };
  team?: { name: string; rank: number; size: number };
};
export type StreakNote = { name: string; academy: string; base: string; unsubscribe: string; streak: number; topic?: string };

export const BTN = "display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600";
export const wrap = (inner: string, why: string, unsub: string) => `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.5">${inner}
<p style="font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:24px">${escapeHtml(why)} <a href="${escapeHtml(unsub)}" style="color:#6b7280">Unsubscribe in one click</a>.</p></div>`;
export const unsubHeaders = (unsub: string) => ({ "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const streakOf = (n: number) => `${n}-day streak`;

export function recapMail(to: string, r: Recap): Mail {
  const first = r.name.split(" ")[0] || "there", link = `${r.base}/dashboard`;
  const lines: string[] = [];
  lines.push(`${r.xp.toLocaleString("en-GB")} XP across ${plural(r.activeDays, "day")}`);
  if (r.newLevels > 0) lines.push(`${plural(r.newLevels, "new level")} passed`);
  if (r.streak > 0) lines.push(`a ${streakOf(r.streak)} going`);
  let rival = "";
  if (r.topic) rival = r.topic.passed > r.topic.rivalLevel ? `In ${r.topic.name} you are ahead of ${r.topic.rival}. Keep it that way.` : r.topic.passed === r.topic.rivalLevel ? `In ${r.topic.name} you are level with ${r.topic.rival}.` : `In ${r.topic.name}, ${r.topic.rival} is ${r.topic.rivalLevel - r.topic.passed} ${r.topic.rivalLevel - r.topic.passed === 1 ? "level" : "levels"} ahead. Time to catch up.`;
  const team = r.team ? `In ${r.team.name} you finished the week #${r.team.rank} of ${r.team.size}.` : "";
  const why = `You get this because you asked for a weekly recap from ${r.academy}.`;
  const text = `Hi ${first},\n\nYour week on ${r.academy}: ${lines.join(", ")}.${rival ? `\n\n${rival}` : ""}${team ? `\n${team}` : ""}\n\nPick up where you left off:\n${link}\n\n${why} Unsubscribe in one click: ${r.unsubscribe}`;
  const html = wrap(`<p>Hi ${escapeHtml(first)},</p><p style="font-size:18px"><b>Your week on ${escapeHtml(r.academy)}</b></p>
<ul style="padding-left:18px">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>${rival ? `<p>${escapeHtml(rival)}</p>` : ""}${team ? `<p>${escapeHtml(team)}</p>` : ""}
<p><a href="${escapeHtml(link)}" style="${BTN}">Pick up where you left off</a></p>`, why, r.unsubscribe);
  return { to, subject: r.newLevels > 0 ? `You passed ${plural(r.newLevels, "level")} this week` : `Your week on ${r.academy}: ${r.xp.toLocaleString("en-GB")} XP`, text, html, headers: unsubHeaders(r.unsubscribe) };
}

export function streakMail(to: string, s: StreakNote): Mail {
  const first = s.name.split(" ")[0] || "there", link = `${s.base}/dashboard`;
  const line = `Your ${streakOf(s.streak)} ends at midnight UTC unless you do one quest today. A five-question drill takes about two minutes.`;
  const why = `You get this because you asked for streak reminders from ${s.academy}.`;
  const text = `Hi ${first},\n\n${line}${s.topic ? `\n\nA good one to do: ${s.topic}.` : ""}\n\n${link}\n\n${why} Unsubscribe in one click: ${s.unsubscribe}`;
  const html = wrap(`<p>Hi ${escapeHtml(first)},</p><p style="font-size:18px"><b>Your ${escapeHtml(streakOf(s.streak))} is at risk</b></p><p>${escapeHtml(line)}</p>${s.topic ? `<p>A good one to do: ${escapeHtml(s.topic)}.</p>` : ""}
<p><a href="${escapeHtml(link)}" style="${BTN}">Keep the streak alive</a></p>`, why, s.unsubscribe);
  return { to, subject: `Your ${streakOf(s.streak)} ends tonight`, text, html, headers: unsubHeaders(s.unsubscribe) };
}
