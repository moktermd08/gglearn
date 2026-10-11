import type { Family } from "../types";
import { NAMES, NOUNS, WORDS, money, nearNums, num, round, tier } from "../kit";
import type { Rng } from "../rng";

const pct = (x: number, d = 2) => `${num(x, d)}%`;
const moneyWrong = (r: Rng, v: number, extra: number[] = []) => [...new Set([v * 2, v / 2, v + 10, v - 10, v * 10, v / 10, v * 1.1, v * 0.9, ...extra])].filter((x) => x > 0 && round(x) !== round(v)).map((x) => money(round(x)));

export const bizFamilies: Family[] = [
  {
    id: "mk.metrics", tags: ["marketing", "analytics"], levels: [1, 20],
    make(r, level) {
      const imp = r.int(10, 500) * 1000, ctr = r.int(5, 60) / 10, clicks = Math.round((imp * ctr) / 100), spend = r.int(2, 90) * 100, conv = r.int(2, 12) / 100, orders = Math.max(1, Math.round(clicks * conv)), rev = r.int(2, 9) * 1000 + r.int(0, 9) * 100;
      const forms: [string, string, string[]][] = [
        [`${imp.toLocaleString("en-US")} impressions and ${clicks.toLocaleString("en-US")} clicks, what is the click-through rate (CTR)?`, pct((clicks / imp) * 100), [pct((imp / clicks) * 100), pct(clicks / imp), pct(((clicks / imp) * 100) / 2)]],
        [`a spend of ${money(spend)} that produced ${clicks.toLocaleString("en-US")} clicks, what is the cost per click (CPC)?`, money(round(spend / clicks)), moneyWrong(r, spend / clicks, [spend / imp, (spend / imp) * 1000])],
        [`a spend of ${money(spend)} for ${imp.toLocaleString("en-US")} impressions, what is the CPM (cost per thousand impressions)?`, money(round((spend / imp) * 1000)), moneyWrong(r, (spend / imp) * 1000, [spend / imp, spend / clicks])],
        [`${money(spend)} spent and ${money(rev)} of revenue attributed, what is the ROAS (revenue ÷ spend) as a multiple?`, `${num(rev / spend)}x`, [`${num(spend / rev)}x`, `${num((rev - spend) / spend)}x`, `${num(rev / spend + 1)}x`, `${num((rev * 100) / spend, 0)}x`]],
        [`${money(spend)} spent and ${money(rev)} of revenue, what is the return on investment (ROI) as a percentage ((revenue − spend) ÷ spend)?`, pct(((rev - spend) / spend) * 100), [pct((rev / spend) * 100), pct((spend / rev) * 100), pct(((rev - spend) / rev) * 100), pct(((spend - rev) / spend) * 100)]],
        [`${clicks.toLocaleString("en-US")} clicks, a ${pct(conv * 100, 0)} landing-page conversion rate and a spend of ${money(spend)}, what is the cost per acquisition (CPA) per conversion (conversions rounded to a whole number)?`, money(round(spend / orders)), moneyWrong(r, spend / orders, [spend / clicks])],
        [`a CTR of ${pct(ctr, 1)} on ${imp.toLocaleString("en-US")} impressions and a ${pct(conv * 100, 0)} conversion rate on clicks, roughly how many conversions result (rounded)?`, orders.toLocaleString("en-US"), nearNums(r, orders, 3, Math.max(1, Math.round(orders / 8))).map((x) => x.toLocaleString("en-US"))],
      ];
      const [text, v, wr] = r.pick(level < 6 ? forms.slice(0, 4) : forms);
      return { prompt: `Given ${text}`, correct: v, wrong: wr.filter((x) => x !== v), topic: "campaign metrics", hint: "CTR = clicks ÷ impressions; CPC = spend ÷ clicks; CPM = spend ÷ impressions × 1000; CPA = spend ÷ conversions." };
    },
  },
  {
    id: "mk.linkedin", tags: ["marketing"], levels: [1, 20],
    make(r, level) {
      const imp = r.int(5, 200) * 100, react = r.int(10, 200), com = r.int(1, 40), share = r.int(0, 30), clicks = r.int(10, 300), sent = r.int(20, 200), acc = r.int(5, sent), inm = r.int(10, 100), rep = r.int(1, inm), followers = r.int(500, 9000), gain = r.int(10, 400);
      const eng = react + com + share + clicks;
      const forms: [string, string, string[]][] = [
        [`a post with ${imp.toLocaleString("en-US")} impressions, ${react} reactions, ${com} comments, ${share} shares and ${clicks} clicks, what is the engagement rate ((reactions + comments + shares + clicks) ÷ impressions)?`, pct((eng / imp) * 100), [pct(((react + com + share) / imp) * 100), pct((clicks / imp) * 100), pct((eng / (imp + eng)) * 100), pct((react / imp) * 100)]],
        [`you sent ${sent} connection requests and ${acc} were accepted, what is the acceptance rate?`, pct((acc / sent) * 100), [pct((sent / acc) * 100), pct(((sent - acc) / sent) * 100), pct((acc / (sent + acc)) * 100)]],
        [`${inm} InMail messages sent and ${rep} replies, what is the response rate?`, pct((rep / inm) * 100), [pct((inm / rep) * 100), pct(((inm - rep) / inm) * 100), pct((rep / (inm + rep)) * 100)]],
        [`a page with ${followers.toLocaleString("en-US")} followers that gained ${gain} new followers this month, what is the follower growth rate?`, pct((gain / followers) * 100), [pct((gain / (followers + gain)) * 100), pct((followers / gain) * 100), pct((gain / followers) * 10)]],
        [`a sponsored post with ${clicks} clicks from ${imp.toLocaleString("en-US")} impressions, what is the CTR?`, pct((clicks / imp) * 100), [pct((imp / clicks) * 100), pct(clicks / imp), pct(((clicks + react) / imp) * 100)]],
      ];
      const [text, v, wr] = r.pick(forms);
      return { prompt: `On LinkedIn, given ${text}`, correct: v, wrong: wr.filter((x) => x !== v), topic: "LinkedIn metrics" };
    },
  },
  {
    id: "an.funnel", tags: ["analytics", "marketing", "crm"], levels: [3, 20],
    make(r, level) {
      const steps = ["Visit", "Sign-up", "Trial", "Paid"].slice(0, 3 + (level > 10 ? 1 : 0)), counts: number[] = [r.int(20, 500) * 100];
      for (let i = 1; i < steps.length; i++) counts.push(Math.max(1, Math.round(counts[i - 1] * (r.int(8, 70) / 100))));
      const i = r.int(1, steps.length - 1), ask = r.pick(["step", "overall", "drop"] as const);
      const lbl = counts.map((c, k) => `${steps[k]} ${c.toLocaleString("en-US")}`).join(" → ");
      const v = ask === "step" ? pct((counts[i] / counts[i - 1]) * 100, 1) : ask === "overall" ? pct((counts[counts.length - 1] / counts[0]) * 100, 2) : String(counts[i - 1] - counts[i]);
      const q = ask === "step" ? `the conversion rate from ${steps[i - 1]} to ${steps[i]} (1 decimal)` : ask === "overall" ? `the overall conversion rate from ${steps[0]} to ${steps[steps.length - 1]} (2 decimals)` : `the number of people who drop off between ${steps[i - 1]} and ${steps[i]}`;
      const wr = ask === "drop" ? nearNums(r, Number(v), 3, 10).map(String) : [pct((counts[i - 1] / counts[i]) * 100, 1), pct((counts[i] / counts[0]) * 100, 1), pct(((counts[i - 1] - counts[i]) / counts[i - 1]) * 100, 1), pct((counts[counts.length - 1] / counts[counts.length - 2]) * 100, 2), pct((counts[0] / counts[counts.length - 1]) * 100, 2), pct((counts[1] / counts[0]) * 100, 2)];
      return { prompt: `A funnel records ${lbl}. What is ${q}?`, correct: v, wrong: wr.filter((x) => x !== v), topic: "funnels" };
    },
  },
  {
    id: "an.sessions", tags: ["analytics"], levels: [2, 20],
    make(r, level) {
      const sessions = r.int(5, 90) * 100, bounced = Math.round(sessions * (r.int(20, 80) / 100)), pages = sessions * r.int(12, 50) / 10, users = Math.round(sessions * (r.int(55, 90) / 100)), dur = r.int(40, 400);
      const forms: [string, string, string[]][] = [
        [`${sessions.toLocaleString("en-US")} sessions of which ${bounced.toLocaleString("en-US")} were single-page, what is the bounce rate?`, pct((bounced / sessions) * 100, 1), [pct(((sessions - bounced) / sessions) * 100, 1), pct((bounced / users) * 100, 1), pct((sessions / bounced) * 100, 1)]],
        [`${Math.round(pages).toLocaleString("en-US")} page views over ${sessions.toLocaleString("en-US")} sessions, how many pages per session (2 decimals)?`, num(Math.round(pages) / sessions, 2), [num(sessions / Math.round(pages), 2), num(Math.round(pages) / users, 2), num(Math.round(pages) / sessions + 1, 2)]],
        [`${sessions.toLocaleString("en-US")} sessions from ${users.toLocaleString("en-US")} users, how many sessions per user (2 decimals)?`, num(sessions / users, 2), [num(users / sessions, 2), num(sessions / users + 1, 2), num((sessions - users) / users, 2)]],
        [`${sessions.toLocaleString("en-US")} sessions with a total engaged time of ${(sessions * dur).toLocaleString("en-US")} seconds, what is the average engaged time per session in seconds?`, String(dur), nearNums(r, dur, 3, 10).map(String)],
        [`${sessions.toLocaleString("en-US")} sessions where ${bounced.toLocaleString("en-US")} bounced, how many sessions were engaged (not bounced)?`, (sessions - bounced).toLocaleString("en-US"), nearNums(r, sessions - bounced, 3, 100).map((x) => x.toLocaleString("en-US"))],
      ];
      const [text, v, wr] = r.pick(forms);
      return { prompt: `Given ${text}`, correct: v, wrong: wr.filter((x) => x !== v), topic: "web analytics" };
    },
  },
  {
    id: "crm.pipeline", tags: ["crm"], levels: [1, 20],
    make(r, level) {
      const n = r.int(3, 4 + tier(level)), deals = Array.from({ length: n }, () => ({ n: r.pick(NAMES), v: r.int(2, 90) * 1000, p: r.pick([10, 25, 40, 50, 60, 75, 90]) }));
      const weighted = deals.reduce((s, d) => s + (d.v * d.p) / 100, 0), total = deals.reduce((s, d) => s + d.v, 0), won = r.int(3, 20), lost = r.int(3, 30), quota = r.int(5, 40) * 10000, closed = Math.round(quota * (r.int(40, 130) / 100)), mrr = r.int(5, 90) * 1000, churn = r.int(1, 9);
      const list = deals.map((d) => `${d.n} ${money(d.v).replace(".00", "")} at ${d.p}%`).join(", ");
      const forms: [string, string, string[]][] = [
        [`open deals ${list}, what is the weighted pipeline value?`, money(weighted).replace(/\.00$/, ""), moneyWrong(r, weighted, [total, total / 2]).map((x) => x.replace(/\.00$/, ""))],
        [`open deals ${list}, what is the total (unweighted) pipeline value?`, money(total).replace(/\.00$/, ""), moneyWrong(r, total, [weighted]).map((x) => x.replace(/\.00$/, ""))],
        [`${won} deals won and ${lost} lost this quarter, what is the win rate?`, pct((won / (won + lost)) * 100, 1), [pct((won / lost) * 100, 1), pct((lost / (won + lost)) * 100, 1), pct((won / (won + lost + 1)) * 100, 1)]],
        [`a quota of ${money(quota).replace(".00", "")} and ${money(closed).replace(".00", "")} closed, what is the quota attainment?`, pct((closed / quota) * 100, 1), [pct((quota / closed) * 100, 1), pct(((closed - quota) / quota) * 100, 1), pct((closed / (quota + closed)) * 100, 1)]],
        [`monthly recurring revenue of ${money(mrr).replace(".00", "")}, what is the annual recurring revenue (ARR)?`, money(mrr * 12).replace(/\.00$/, ""), [mrr, mrr * 52, mrr * 4, mrr * 365].map((x) => money(x).replace(/\.00$/, ""))],
        [`MRR of ${money(mrr).replace(".00", "")} and ${churn}% monthly churn, how much MRR is lost to churn in the month?`, money((mrr * churn) / 100).replace(/\.00$/, ""), moneyWrong(r, (mrr * churn) / 100).map((x) => x.replace(/\.00$/, ""))],
      ];
      const [text, v, wr] = r.pick(level < 5 ? forms.slice(0, 3) : forms);
      return { prompt: `Given ${text}`, correct: v, wrong: wr.filter((x) => x !== v), topic: "sales and CRM math", hint: "Weighted value = amount × probability; win rate = won ÷ (won + lost)." };
    },
  },
  {
    id: "llm.cost", tags: ["llm"], levels: [1, 20],
    make(r, level) {
      const pin = r.pick([1, 2, 3, 5, 10, 15]), pout = pin * r.pick([3, 4, 5]), tin = r.int(2, 90) * 1000, tout = r.int(1, 40) * 100, calls = r.int(1, 50) * (level > 8 ? 100 : 1);
      const one = (tin / 1e6) * pin + (tout / 1e6) * pout, total = one * calls;
      const ask = r.pick(["one", "total"] as const), v = ask === "one" ? one : total;
      const f = (x: number) => `$${num(x, 4)}`;
      return { prompt: `A model costs $${pin} per million input tokens and $${pout} per million output tokens. Each call sends ${tin.toLocaleString("en-US")} input tokens and receives ${tout.toLocaleString("en-US")} output tokens${ask === "total" ? `. What do ${calls.toLocaleString("en-US")} identical calls cost` : ". What does one call cost"}?`, correct: f(v),
        wrong: [(tin / 1e6) * pin, (tout / 1e6) * pout, (tin / 1e6) * pout + (tout / 1e6) * pin, one / 1000, one * 1000, ((tin + tout) / 1e6) * pin].map((x) => f(ask === "total" ? x * calls : x)).filter((x) => x !== f(v)), topic: "token pricing" };
    },
  },
  {
    id: "llm.context", tags: ["llm"], levels: [3, 20],
    make(r, level) {
      const win = r.pick([8000, 16000, 32000, 128000, 200000]), sys = r.int(2, 20) * 100, msg = r.int(2, 30) * 100, maxOut = r.int(5, 40) * 100, hist = r.int(1, 30);
      const used = sys + hist * msg + maxOut, left = win - used, ask = r.pick(["fits", "left", "turns"] as const);
      if (ask === "turns") { const turns = Math.floor((win - sys - maxOut) / msg); return { prompt: `A context window holds ${win.toLocaleString("en-US")} tokens. A system prompt uses ${sys} tokens, each message ${msg} tokens, and ${maxOut} tokens are reserved for the reply. How many whole messages of history fit?`, correct: String(turns), wrong: nearNums(r, turns, 3, Math.max(1, Math.round(turns / 10))).map(String).filter((x) => Number(x) >= 0), topic: "context windows" }; }
      if (ask === "left") return { prompt: `A ${win.toLocaleString("en-US")}-token context window has a ${sys}-token system prompt, ${hist} messages of ${msg} tokens each, and max_tokens set to ${maxOut}. How many tokens are still unused?`, correct: left.toLocaleString("en-US"), wrong: [left + maxOut, left - maxOut, win - sys - hist * msg, left + sys, win - hist * msg - maxOut].map((x) => x.toLocaleString("en-US")), topic: "context windows" };
      const fits = left >= 0;
      return { prompt: `A ${win.toLocaleString("en-US")}-token context window gets a ${sys}-token system prompt, ${hist} messages of ${msg} tokens each, and a request for up to ${maxOut} output tokens. Does the request fit?`, correct: fits ? "Yes, with room to spare or exactly full" : "No, it exceeds the window", wrong: [fits ? "No, it exceeds the window" : "Yes, with room to spare or exactly full", "Only if the system prompt is removed", "The window grows automatically to fit"], topic: "context windows" };
    },
  },
  {
    id: "llm.rate", tags: ["llm", "rest"], levels: [5, 20],
    make(r, level) {
      const rpm = r.pick([50, 100, 500, 1000]), tpm = r.pick([40000, 80000, 200000, 400000]), avg = r.int(2, 40) * 100;
      const byTok = Math.floor(tpm / avg), v = Math.min(rpm, byTok);
      return { prompt: `An API key allows ${rpm.toLocaleString("en-US")} requests per minute and ${tpm.toLocaleString("en-US")} tokens per minute. Every request uses ${avg.toLocaleString("en-US")} tokens. What is the most requests you can send in one minute?`, correct: String(v), wrong: [rpm, byTok, Math.round(tpm / (avg * 2)), v + 10, rpm + byTok].map(String).filter((x) => x !== String(v)), topic: "rate limits", hint: "Both limits apply; the lower one wins." };
    },
  },
  {
    id: "cloud.lambda", tags: ["lambda", "cloud"], levels: [2, 20],
    make(r, level) {
      const reqs = r.int(1, 90) * 100000, dur = r.pick([50, 100, 200, 400, 800, 1500]), mem = r.pick([128, 256, 512, 1024, 2048]), pgb = r.pick([0.0000166667, 0.0000133334, 0.00002]), preq = r.pick([0.2, 0.4]);
      const gbs = reqs * (dur / 1000) * (mem / 1024), cost = gbs * pgb + (reqs / 1e6) * preq, ask = r.pick(["gbs", "cost"] as const);
      if (ask === "gbs") return { prompt: `A function runs ${reqs.toLocaleString("en-US")} times a month for ${dur} ms each with ${mem} MB of memory. How many GB-seconds of compute is that? (GB = 1024 MB)`, correct: gbs.toLocaleString("en-US", { maximumFractionDigits: 1 }), wrong: [reqs * (dur / 1000), reqs * dur * (mem / 1024), reqs * (dur / 1000) * mem, gbs / 1000, gbs * 2].map((x) => x.toLocaleString("en-US", { maximumFractionDigits: 1 })), topic: "Lambda billing" };
      const f = (x: number) => money(round(x));
      return { prompt: `Lambda bills $${pgb} per GB-second plus $${preq} per million requests (no free tier here). A function runs ${reqs.toLocaleString("en-US")} times for ${dur} ms with ${mem} MB. What is the monthly cost?`, correct: f(cost), wrong: [gbs * pgb, (reqs / 1e6) * preq, cost * 2, cost / 2, (gbs * pgb) * 1.5 + (reqs / 1e6) * preq].map(f).filter((x) => x !== f(cost)), topic: "Lambda billing" };
    },
  },
  {
    id: "lambda.concurrency", tags: ["lambda"], levels: [6, 20],
    make(r, level) {
      const rps = r.int(5, 400), dur = r.pick([100, 200, 500, 1000, 2500]), limit = r.pick([100, 500, 1000]);
      const conc = Math.ceil((rps * dur) / 1000);
      const ask = r.pick(["conc", "throttle"] as const);
      if (ask === "conc") return { prompt: `A Lambda function receives ${rps} requests per second and each invocation takes ${dur} ms. About how many concurrent executions does it need (requests per second × duration in seconds, rounded up)?`, correct: String(conc), wrong: nearNums(r, conc, 3, Math.max(1, Math.round(conc / 6))).map(String).concat([String(rps)]).filter((x) => x !== String(conc) && Number(x) > 0), topic: "Lambda concurrency" };
      const over = conc > limit;
      return { prompt: `An account limits Lambda to ${limit} concurrent executions. Traffic is ${rps} requests per second with ${dur} ms per invocation (steady state). Will requests be throttled?`, correct: over ? `Yes: needs about ${conc}, over the ${limit} limit` : `No: needs about ${conc}, within the ${limit} limit`, wrong: [over ? `No: needs about ${conc}, within the ${limit} limit` : `Yes: needs about ${conc}, over the ${limit} limit`, `Only the first ${limit} requests ever succeed`, "Lambda queues requests silently with no limit"], topic: "Lambda concurrency" };
    },
  },
  {
    id: "cloud.cidr", tags: ["cloud"], levels: [3, 20],
    make(r, level) {
      const p = r.int(16, 28), ask = r.pick(["hosts", "aws", "subnets", "prefix"] as const);
      if (ask === "hosts") return { prompt: `How many usable host addresses does a /${p} IPv4 network have in a traditional network (network and broadcast excluded)?`, correct: String(2 ** (32 - p) - 2), wrong: [2 ** (32 - p), 2 ** (32 - p) - 1, 2 ** (32 - p) - 5, 2 ** (31 - p) - 2, 2 ** (33 - p) - 2].map(String), topic: "CIDR" };
      if (ask === "aws") return { prompt: `An AWS VPC subnet is created as a /${p}. AWS reserves 5 addresses in every subnet. How many are available for your instances?`, correct: String(2 ** (32 - p) - 5), wrong: [2 ** (32 - p), 2 ** (32 - p) - 2, 2 ** (32 - p) - 1, 2 ** (32 - p) - 3, 2 ** (32 - p) - 6].map(String), topic: "VPC subnets" };
      if (ask === "subnets") { const q = p + r.int(1, 4); return { prompt: `How many /${q} subnets fit inside one /${p} network?`, correct: String(2 ** (q - p)), wrong: [2 ** (q - p) - 1, 2 ** (q - p) + 1, (q - p) * 2, 2 ** (q - p + 1), q - p].map(String), topic: "CIDR" }; }
      const need = r.pick([10, 30, 60, 100, 250, 500, 1000, 4000]), best = 32 - Math.ceil(Math.log2(need + 2));
      return { prompt: `What is the longest prefix (smallest network) that still gives at least ${need} usable hosts in a traditional IPv4 network?`, correct: `/${best}`, wrong: [best - 1, best + 1, best - 2, best + 2, 32 - Math.ceil(Math.log2(need))].map((x) => `/${x}`).filter((x) => x !== `/${best}`), topic: "CIDR" };
    },
  },
  {
    id: "cloud.iam", tags: ["cloud"], levels: [5, 20],
    make(r, level) {
      const bucket = r.pick(WORDS), other = r.pick(WORDS.filter((w) => w !== bucket)), acts = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"];
      type St = { eff: "Allow" | "Deny"; act: string; res: string };
      const sts: St[] = [{ eff: "Allow", act: r.pick(["s3:*", "s3:Get*", "s3:GetObject", "s3:PutObject"]), res: r.pick([`arn:aws:s3:::${bucket}/*`, `arn:aws:s3:::${other}/*`, "*"]) }];
      if (r.chance(0.8)) sts.push({ eff: r.pick(["Allow", "Deny"]), act: r.pick(["s3:DeleteObject", "s3:Put*", "s3:*", "s3:GetObject"]), res: r.pick([`arn:aws:s3:::${bucket}/*`, "*"]) });
      if (level > 12) sts.push({ eff: "Deny", act: r.pick(["s3:Put*", "s3:DeleteObject"]), res: `arn:aws:s3:::${other}/*` });
      const reqAct = r.pick(acts.slice(0, 3)), reqRes = `arn:aws:s3:::${r.pick([bucket, other])}/file.txt`;
      const re = (g: string) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
      const hit = sts.filter((s) => re(s.act).test(reqAct) && re(s.res).test(reqRes));
      const v = hit.some((s) => s.eff === "Deny") ? "Denied (explicit Deny wins)" : hit.length ? "Allowed" : "Denied (implicit deny: nothing allows it)";
      const code = JSON.stringify({ Statement: sts.map((s) => ({ Effect: s.eff, Action: s.act, Resource: s.res })) }, null, 2);
      return { prompt: `The identity policy below is attached to a user. Is the request ${reqAct} on ${reqRes} allowed?`, code, correct: v, wrong: ["Allowed", "Denied (explicit Deny wins)", "Denied (implicit deny: nothing allows it)", "Allowed only after MFA"].filter((x) => x !== v), topic: "IAM evaluation", hint: "Explicit Deny beats any Allow; with no matching Allow the default is deny." };
    },
  },
  {
    id: "cloud.sla", tags: ["cloud"], levels: [8, 20],
    make(r, level) {
      const a = r.pick([99, 99.5, 99.9, 99.95, 99.99]), b = r.pick([99, 99.5, 99.9, 99.95]), mode = r.pick(["serial", "parallel", "downtime"] as const);
      if (mode === "downtime") { const mins = (1 - a / 100) * 30 * 24 * 60; return { prompt: `A service promises ${a}% availability. About how many minutes of downtime per 30-day month is that?`, correct: num(mins, 1), wrong: [mins * 2, mins / 2, mins * 12, (1 - a / 100) * 365 * 24 * 60, mins / 10].map((x) => num(x, 1)).filter((x) => x !== num(mins, 1)), topic: "availability" }; }
      const v = mode === "serial" ? (a / 100) * (b / 100) * 100 : (1 - (1 - a / 100) * (1 - b / 100)) * 100;
      const f = (x: number) => `${x.toFixed(4)}%`;
      return { prompt: `Two components with ${a}% and ${b}% availability are ${mode === "serial" ? "both required (in series)" : "redundant, either one is enough (in parallel)"}. What is the combined availability?`, correct: f(v), wrong: [Math.min(a, b), (a + b) / 2, mode === "serial" ? (1 - (1 - a / 100) * (1 - b / 100)) * 100 : (a / 100) * (b / 100) * 100, a * b / 100 + 0.01, 100 - (100 - a) - (100 - b)].map(f).filter((x) => x !== f(v)), topic: "availability" };
    },
  },
];
