import type { Family } from "../types";
import { WORDS, nearNums } from "../kit";
import type { Rng } from "../rng";

type Commit = { id: number; parents: number[] };
type Repo = { commits: Commit[]; branches: Record<string, number>; head: string; next: number };

const reach = (repo: Repo, tip: number) => {
  const seen = new Set<number>(), st = [tip];
  while (st.length) { const c = st.pop()!; if (seen.has(c)) continue; seen.add(c); st.push(...repo.commits[c].parents); }
  return seen;
};
const isAncestor = (repo: Repo, a: number, b: number) => reach(repo, b).has(a); // a reachable from b

/** Builds a random but conflict-free command script (every commit adds its own file) and models it independently of git. */
function script(r: Rng, steps: number) {
  const repo: Repo = { commits: [{ id: 0, parents: [] }], branches: { main: 0 }, head: "main", next: 1 };
  const cmds: string[] = ["git init -q -b main", "git config user.email a@b.c", "git config user.name t", "echo 0 > f0; git add .; git commit -qm c0"];
  const names = ["dev", "fix", "ui"];
  const commit = () => {
    const id = repo.next++; repo.commits.push({ id, parents: [repo.branches[repo.head]] }); repo.branches[repo.head] = id;
    cmds.push(`echo ${id} > f${id}; git add .; git commit -qm c${id}`);
  };
  for (let s = 0; s < steps; s++) {
    const options = ["commit", "commit", "branch", "checkout", "merge", "reset", "revert"].filter((o) => {
      if (o === "branch") return Object.keys(repo.branches).length < 3;
      if (o === "checkout" || o === "merge") return Object.keys(repo.branches).length > 1;
      if (o === "reset") return repo.commits[repo.branches[repo.head]].parents.length === 1 && reach(repo, repo.branches[repo.head]).size > 2;
      if (o === "revert") return true;
      return true;
    });
    const op = r.pick(options);
    if (op === "commit") commit();
    else if (op === "branch") { const nm = names.find((x) => !(x in repo.branches))!; repo.branches[nm] = repo.branches[repo.head]; repo.head = nm; cmds.push(`git checkout -q -b ${nm}`); }
    else if (op === "checkout") { const to = r.pick(Object.keys(repo.branches).filter((x) => x !== repo.head)); repo.head = to; cmds.push(`git checkout -q ${to}`); }
    else if (op === "merge") {
      const other = r.pick(Object.keys(repo.branches).filter((x) => x !== repo.head)), a = repo.branches[repo.head], b = repo.branches[other];
      if (isAncestor(repo, b, a)) { cmds.push(`git merge -q --no-edit ${other} 2>/dev/null || true`); }
      else if (isAncestor(repo, a, b)) { repo.branches[repo.head] = b; cmds.push(`git merge -q --no-edit ${other}`); }
      else { const id = repo.next++; repo.commits.push({ id, parents: [a, b] }); repo.branches[repo.head] = id; cmds.push(`git merge -q --no-edit ${other}`); }
    } else if (op === "reset") { const tip = repo.branches[repo.head]; repo.branches[repo.head] = repo.commits[tip].parents[0]; cmds.push(`git reset -q --hard HEAD~1`); }
    else if (op === "revert") { const id = repo.next++; const tip = repo.branches[repo.head]; if (repo.commits[tip].parents.length !== 1) { repo.next--; continue; } repo.commits.push({ id, parents: [tip] }); repo.branches[repo.head] = id; cmds.push(`git revert --no-edit HEAD >/dev/null`); }
  }
  return { repo, cmds };
}

export const gitFamilies: Family[] = [
  {
    id: "git.count", tags: ["git"], levels: [3, 20],
    make(r, level) {
      const steps = 4 + Math.floor(level / 2), { repo, cmds } = script(r, steps);
      const ask = r.pick(["head", "main"] as const);
      const tip = ask === "head" ? repo.branches[repo.head] : repo.branches.main;
      const v = reach(repo, tip).size;
      const shown = cmds.slice(3).map((c) => c.replace(/^echo (\d+) > f\d+; git add \.; git commit -qm c\d+$/, "git commit (new file)").replace(/ 2>\/dev\/null \|\| true/, "").replace(/ -q/g, "").replace(/^git commit \(new file\)$/, "git commit"));
      const bash = `${cmds.join("\n")}\ngit rev-list --count ${ask === "head" ? "HEAD" : "main"}`;
      return { prompt: `Starting from one commit on main (c0), these commands run in order (each commit adds its own file; merges use default fast-forward behaviour). How many commits does \`git rev-list --count ${ask === "head" ? "HEAD" : "main"}\` report at the end? Commands: ${shown.map((c, i) => `${i + 1}) ${c}`).join("  ")}`,
        correct: String(v), wrong: nearNums(r, v).map(String).filter((x) => Number(x) > 0), topic: "commit history", hint: "Merging when one side is an ancestor fast-forwards; otherwise a merge commit is created. reset --hard HEAD~1 drops the tip.",
        verify: { lang: "sh", src: `set -e\ncd "$(mktemp -d)"\nexport GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null\n${bash}`, expect: String(v) } };
    },
  },
  {
    id: "git.rev", tags: ["git"], levels: [1, 20],
    make(r, level) {
      const n = r.int(6, 14 + Math.floor(level / 4)), a = r.int(1, 4), b = r.int(0, 3), form = r.pick(["tilde", "chain", "caret", "log"] as const);
      const spec = form === "tilde" ? `HEAD~${a + b}` : form === "chain" ? `HEAD~${a}~${b}` : form === "caret" ? `HEAD${"^".repeat(a + b)}` : `HEAD~${a}`;
      const idx = n - 1 - (form === "chain" ? a + b : form === "tilde" ? a + b : form === "caret" ? a + b : a);
      const bash = `set -e\ncd "$(mktemp -d)"\nexport GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null\ngit init -q -b main\ngit config user.email a@b.c; git config user.name t\nfor i in $(seq 1 ${n}); do echo $i > f; git add .; git commit -qm "step $i"; done\ngit log -1 --format=%s ${spec}`;
      return { prompt: `A linear history has ${n} commits with messages "step 1" (oldest) to "step ${n}" (HEAD). What message does \`git log -1 --format=%s ${spec}\` print?`, correct: `step ${idx + 1}`,
        wrong: [idx, idx + 2, idx + 3, idx - 1, n - idx].filter((x) => x >= 1 && x <= n && x !== idx + 1).map((x) => `step ${x}`), topic: "revisions", hint: "HEAD~n and n carets both walk n commits back along first parents.",
        verify: { lang: "sh", src: bash, expect: `step ${idx + 1}` } };
    },
  },
  {
    id: "git.ignore", tags: ["git"], levels: [4, 20],
    make(r, level) {
      const ext = r.pick(["log", "tmp", "bak"]), dir = r.pick(["build", "dist", "cache"]), word = r.pick(WORDS), keep = `keep.${ext}`;
      // Only these pattern shapes are used, so the matcher below can be exact: *.ext, dir/, /dir, docs/*.md, word*, !keep.ext
      const pool = [`*.${ext}`, `${dir}/`, `/${dir}`, `docs/*.md`, `${word}*`];
      const chosen = r.sample(pool, 2);
      const patterns = r.chance(0.6) && chosen.includes(`*.${ext}`) ? [...chosen, `!${keep}`] : r.chance(0.5) ? [...chosen, `!${keep}`] : chosen;
      const files = r.sample([`app.${ext}`, keep, `${dir}/main.js`, `src/${dir}/x.js`, `${dir}/lib/y.js`, `docs/a.md`, `docs/sub/b.md`, `src/app.js`, `${word}.txt`, `sub/${word}.${ext}`, `sub/deep.${ext}`, `src/${keep}`], 7);
      const base = (f: string) => f.split("/").pop()!;
      const hitsFile = (p: string, f: string) =>
        p.startsWith("*.") ? base(f).endsWith(p.slice(1)) : p === "docs/*.md" ? /^docs\/[^/]*\.md$/.test(f) : p.endsWith("*") ? base(f).startsWith(p.slice(0, -1)) : p === `/${dir}` ? f.split("/")[0] === dir : false;
      const dirIgnored = (f: string) => { const segs = f.split("/").slice(0, -1); return patterns.some((p) => (p === `${dir}/` && segs.includes(dir)) || (p === `/${dir}` && segs[0] === dir)); };
      const ignored = (f: string) => {
        if (dirIgnored(f)) return true;
        let res = false;
        for (const p of patterns) {
          if (p.startsWith("!")) { if (base(f) === p.slice(1)) res = false; } else if (hitsFile(p, f)) res = true;
        }
        return res;
      };
      const v = files.filter((f) => !ignored(f)).length;
      const sh = `set -e\ncd "$(mktemp -d)"\nexport GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null\ngit init -q\nprintf '%s\\n' ${patterns.map((p) => `'${p}'`).join(" ")} > .gitignore\nfor f in ${files.map((f) => `'${f}'`).join(" ")}; do mkdir -p "$(dirname "$f")"; echo x > "$f"; done\ngit add -A >/dev/null\ngit ls-files | grep -vc '^.gitignore$' || true`;
      return { prompt: `A .gitignore holds ${patterns.length} patterns. After \`git add -A\`, how many of these ${files.length} files get staged (not counting .gitignore)? Files: ${files.join(", ")}`, code: patterns.join("\n"), correct: String(v),
        wrong: nearNums(r, v).map(String).filter((x) => Number(x) >= 0), topic: ".gitignore", hint: "A ! pattern re-includes a file unless a parent directory is itself ignored.",
        verify: { lang: "sh", src: sh, expect: String(v) } };
    },
  },
];
