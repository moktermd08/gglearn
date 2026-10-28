import dns from "node:dns/promises";
import net from "node:net";
import type { Check } from "./types";

/**
 * Reads a person's public GitHub repository so a step is ticked because the work is there, not because they said so.
 * No sign-in with GitHub is needed: only what anyone can see is read, so the repository has to be public. GITHUB_TOKEN (optional, a token
 * with no scopes) lifts GitHub's limit for requests with no sign-in (60 an hour for the whole server) to 5,000.
 */

/** A problem with GitHub itself (not found, rate limited, down). The message is meant for the person, and nothing is changed when one is raised. */
export class GithubError extends Error {}

const API = "https://api.github.com";
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

/** "owner/name" from "owner/name" or any github.com address of a repository, or null. Nothing else is ever put in a request address. */
export function parseRepo(input: string): string | null {
  let s = input.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  s = s.split(/[/?#]/).slice(0, 2).join("/");
  const [owner, name, ...rest] = s.split("/");
  if (rest.length || !owner || !name || !OWNER.test(owner) || !NAME.test(name) || name === "." || name === "..") return null;
  return `${owner}/${name}`;
}

// ---- the web address of the finished product ----

/** True for an address that is not on the public internet. Used so "check my live site" cannot be pointed at this server's own network. */
export function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || (a === 192 && b === 0);
  }
  if (v === 6) {
    const l = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(l);
    if (mapped) return isPrivateIp(mapped[1]);
    return l === "::" || l === "::1" || /^f[cd]/.test(l) || /^fe[89ab]/.test(l) || l.startsWith("ff");
  }
  return true; // not an address at all
}

/** A live address we are willing to fetch: https, a real host name, no sign-in details, the normal port. */
export function parseSite(input: string): URL | null {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return null; }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
  if (!h.includes(".") || net.isIP(h) || h.startsWith("[") || /(^|\.)(localhost|local|internal|lan|home)$/.test(h)) return null;
  return u;
}

async function publicHost(host: string): Promise<boolean> {
  try {
    const found = await dns.lookup(host, { all: true });
    return found.length > 0 && found.every((a) => !isPrivateIp(a.address));
  } catch { return false; }
}

/** True/false when the address answered, null when we could not tell (offline, timeout). Redirects are followed by hand, and every hop is checked again. */
export async function siteAnswers(url: URL): Promise<boolean | null> {
  let at = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!(await publicHost(at.hostname))) return false;
    let res: Response;
    try { res = await fetch(at, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { "user-agent": "gglearn-site-check" } }); } catch { return null; }
    res.body?.cancel().catch(() => {});
    if (res.status >= 200 && res.status < 300) return true;
    const to = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!to) return res.status >= 500 ? null : false;
    const next = parseSite(new URL(to, at).toString());
    if (!next) return false;
    at = next;
  }
  return false;
}

// ---- the repository ----

type Meta = { private: boolean; default_branch: string; description: string | null; homepage: string | null; topics?: string[]; license: { spdx_id: string | null } | null };
type TreeEntry = { path: string; type: string; size?: number };

async function get<T>(path: string): Promise<{ data: T; link: string | null }> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "gglearn-build-check",
        ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    });
  } catch { throw new GithubError("Could not reach GitHub. Try again in a moment."); }
  if (res.status === 404) throw new GithubError("GitHub cannot find that repository. Check the name, and make sure it is public: only public repositories can be checked.");
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000;
    const mins = reset > Date.now() ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : 5;
    throw new GithubError(`GitHub is limiting how often we can look, so please try again in about ${mins} minute${mins === 1 ? "" : "s"}.`);
  }
  if (!res.ok) throw new GithubError(`GitHub answered with an error (${res.status}). Try again in a moment.`);
  return { data: (await res.json()) as T, link: res.headers.get("link") };
}

const lazy = <T>(f: () => Promise<T>) => { let p: Promise<T> | undefined; return () => (p ??= f()); };

/** Everything a check may ask about one repository. Each part is fetched only when a check needs it, and only once. */
export function openRepo(repo: string, siteUrl: string | null) {
  const meta = lazy(async () => {
    const { data } = await get<Meta>(`/repos/${repo}`);
    if (data.private) throw new GithubError("That repository is private. Make it public to be checked (Settings, then Danger Zone, then Change visibility).");
    return data;
  });
  const branch = async () => encodeURIComponent((await meta()).default_branch);
  const tree = lazy(async () => (await get<{ tree: TreeEntry[] }>(`/repos/${repo}/git/trees/${await branch()}?recursive=1`).catch((e) => {
    if (e instanceof GithubError && /cannot find/.test(e.message)) return { data: { tree: [] as TreeEntry[] } }; // an empty repository has no tree
    throw e;
  })).data.tree.filter((t) => t.type === "blob"));
  const commits = lazy(async () => {
    const { data, link } = await get<unknown[]>(`/repos/${repo}/commits?per_page=1&sha=${await branch()}`).catch((e) => {
      if (e instanceof GithubError && /error \(409\)/.test(e.message)) return { data: [] as unknown[], link: null }; // 409 = empty repository
      throw e;
    });
    const last = link && /[?&]page=(\d+)>; rel="last"/.exec(link);
    return last ? Number(last[1]) : data.length;
  });
  const mergedPrs = lazy(async () => (await get<{ merged_at: string | null }[]>(`/repos/${repo}/pulls?state=closed&per_page=100`)).data.filter((p) => p.merged_at).length);
  const issues = lazy(async () => (await get<{ pull_request?: unknown }[]>(`/repos/${repo}/issues?state=all&per_page=100`)).data.filter((i) => !i.pull_request).length);
  const ci = lazy(async () => {
    const { data } = await get<{ workflow_runs: { conclusion: string | null }[] }>(`/repos/${repo}/actions/runs?branch=${await branch()}&status=completed&per_page=1`);
    return data.workflow_runs[0]?.conclusion ?? null;
  });
  const releases = lazy(async () => (await get<{ draft: boolean }[]>(`/repos/${repo}/releases?per_page=100`)).data.filter((r) => !r.draft).length);
  return { meta, tree, commits, mergedPrs, issues, ci, releases, siteUrl };
}
type RepoView = ReturnType<typeof openRepo>;

// ---- checks ----

export type CheckResult = {
  ok: boolean;
  /** what was found, shown next to a ticked step */
  evidence: string;
  /** what is missing, shown on a step that is not ticked yet */
  hint: string;
  /** true when we could not tell, so the step is left as it was */
  unknown?: boolean;
};

const hit = (evidence: string): CheckResult => ({ ok: true, evidence, hint: "" });
const miss = (hint: string): CheckResult => ({ ok: false, evidence: "", hint });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function expand(g: string): string[] {
  const m = /\{([^{}]*)\}/.exec(g);
  if (!m) return [g];
  return m[1].split(",").flatMap((alt) => expand(g.slice(0, m.index) + alt + g.slice(m.index + m[0].length)));
}
function globRe(g: string): RegExp {
  let r = "";
  for (let i = 0; i < g.length; i++) {
    if (g.startsWith("**/", i)) { r += "(?:.*/)?"; i += 2; }
    else if (g.startsWith("**", i)) { r += ".*"; i += 1; }
    else if (g[i] === "*") r += "[^/]*";
    else r += g[i].replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${r}$`, "i");
}
/** The files in `tree` that `glob` names. Exported for the content check. */
export function matchFiles(tree: { path: string; size?: number }[], glob: string, minBytes = 0) {
  const res = expand(glob).map(globRe);
  return tree.filter((t) => (t.size ?? 0) >= minBytes && res.some((re) => re.test(t.path)));
}

export async function runCheck(c: Check, r: RepoView): Promise<CheckResult> {
  switch (c.kind) {
    case "repo": { await r.meta(); return hit("The repository is public."); }
    case "files": {
      const min = c.min ?? 1;
      const found = matchFiles(await r.tree(), c.glob, c.minBytes ?? 0);
      if (found.length >= min) return hit(found.slice(0, 3).map((f) => f.path).join(", ") + (found.length > 3 ? ` and ${found.length - 3} more` : ""));
      const real = c.minBytes ? ` of at least ${c.minBytes} characters` : "";
      const names = expand(c.glob).map((g) => g.replace(/\*\*\//g, ""));
      return miss(`Found ${plural(found.length, "file")}${real}, need ${min}. Looking for: ${names.slice(0, 4).join(" or ")}${names.length > 4 ? " or similar" : ""}`);
    }
    case "absent": {
      const bad = matchFiles(await r.tree(), c.glob).filter((f) => !/\.(example|sample|template)$/i.test(f.path));
      return bad.length ? miss(`Committed and should not be: ${bad.slice(0, 3).map((f) => f.path).join(", ")}. Remove it, add it to .gitignore, and replace any real key it held: deleting a file does not remove it from history.`) : hit("No secret files committed.");
    }
    case "commits": { const n = await r.commits(); return n >= c.n ? hit(`${plural(n, "commit")}.`) : miss(`${plural(n, "commit")} so far, need ${c.n}.`); }
    case "prs": { const n = await r.mergedPrs(); return n >= c.n ? hit(`${plural(n, "merged pull request")}.`) : miss(`${plural(n, "merged pull request")} so far, need ${c.n}.`); }
    case "issues": { const n = await r.issues(); return n >= c.n ? hit(`${plural(n, "issue")}.`) : miss(`${plural(n, "issue")} so far, need ${c.n}.`); }
    case "ci": {
      const s = await r.ci();
      if (s === "success") return hit("The latest GitHub Actions run passed.");
      return miss(s ? `The latest GitHub Actions run ended as "${s}". Open the Actions tab, read the log and fix it.` : "No finished GitHub Actions run yet. Add a workflow in .github/workflows and push.");
    }
    case "releases": { const n = await r.releases(); return n >= c.n ? hit(`${plural(n, "release")}.`) : miss(`${plural(n, "published release")} so far, need ${c.n}.`); }
    case "license": { const l = (await r.meta()).license?.spdx_id; return l && l !== "NOASSERTION" ? hit(`Licence: ${l}.`) : miss("GitHub does not recognise a licence. Add a LICENSE file from the Add file menu, which offers the common ones."); }
    case "discoverable": {
      const m = await r.meta();
      const topics = m.topics?.length ?? 0;
      const gaps = [!m.description?.trim() && "a description", !m.homepage?.trim() && "a website address", topics < c.topics && `${c.topics - topics} more topic${c.topics - topics === 1 ? "" : "s"}`].filter(Boolean);
      return gaps.length ? miss(`Still needs ${gaps.join(", ")}. Set them with the gear icon beside About on the repository page.`) : hit(`Described, linked, ${plural(topics, "topic")}.`);
    }
    case "site": {
      if (!r.siteUrl) return miss("Add the web address where your product is live.");
      const u = parseSite(r.siteUrl);
      if (!u) return miss("The live address must start with https:// and be a real website address.");
      const ok = await siteAnswers(u);
      if (ok === null) return { ok: false, evidence: "", hint: "Could not reach the site just now. Try again in a moment.", unknown: true };
      return ok ? hit(`${u.hostname} is live.`) : miss(`${u.hostname} did not answer with a page. Open it in your browser and fix what you see.`);
    }
    case "self": return miss("This step is ticked by you, with a note of what happened.");
  }
}
