import type { Family } from "../types";
import { IDENTS, NAMES, NOUNS, WORDS, nearNums, tier } from "../kit";

// Test-time only: the real `semver` package re-derives answers in scripts/dynamic-check.ts. It is not a runtime dependency.
const semverPath = () => JSON.stringify(process.cwd() + "/node_modules/semver");

type V = { n: [number, number, number]; pre: (string | number)[] };
const parse = (s: string): V => {
  const dash = s.indexOf("-"), core = dash < 0 ? s : s.slice(0, dash), pre = dash < 0 ? "" : s.slice(dash + 1);
  const [a, b, c] = core.split(".").map(Number);
  return { n: [a, b, c], pre: pre ? pre.split(".").map((x) => (/^\d+$/.test(x) ? Number(x) : x)) : [] };
};
const fmt = (v: V) => `${v.n.join(".")}${v.pre.length ? `-${v.pre.join(".")}` : ""}`;
const cmp = (a: string, b: string) => { const x = parse(a).n, y = parse(b).n; return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
/** The highest plain version in `list` satisfying one of: ^x.y.z ~x.y.z >=v <v >v <w M.x M.m.x ^M.m ~M.m *. */
function maxSatisfying(list: string[], range: string): string | null {
  const ge = (v: string, lo: string) => cmp(v, lo) >= 0, lt = (v: string, hi: string) => cmp(v, hi) < 0;
  const fill = (s: string) => { const p = s.split("."); while (p.length < 3) p.push("0"); return p.join("."); };
  let test: (v: string) => boolean;
  const bump = (s: string, i: number) => { const n = parse(fill(s)).n; n[i]++; for (let k = i + 1; k < 3; k++) n[k] = 0; return n.join("."); };
  if (range === "*") test = () => true;
  else if (/^>\S+ <\S+$/.test(range)) { const [lo, hi] = range.split(" "); test = (v) => cmp(v, lo.slice(1)) > 0 && lt(v, hi.slice(1)); }
  else if (range.startsWith(">=")) test = (v) => ge(v, range.slice(2));
  else if (range.startsWith("<")) test = (v) => lt(v, range.slice(1));
  else if (range.startsWith("^")) { const base = fill(range.slice(1)), n = parse(base).n, idx = n[0] > 0 ? 0 : n[1] > 0 ? 1 : 2; test = (v) => ge(v, base) && lt(v, bump(base, idx)); }
  else if (range.startsWith("~")) { const base = fill(range.slice(1)); test = (v) => ge(v, base) && lt(v, bump(base, 1)); }
  else if (/^\d+\.x$/.test(range)) { const base = fill(range.replace(".x", "")); test = (v) => ge(v, base) && lt(v, bump(base, 0)); }
  else if (/^\d+\.\d+\.x$/.test(range)) { const base = fill(range.replace(".x", "")); test = (v) => ge(v, base) && lt(v, bump(base, 1)); }
  else throw new Error(`unsupported range ${range}`);
  const ok = list.filter(test).sort(cmp);
  return ok.length ? ok[ok.length - 1] : null;
}
/** npm version <kind> for a version that may carry a numeric-suffixed prerelease like 1.2.3-beta.4. */
function inc(s: string, kind: "patch" | "minor" | "major" | "prerelease" | "premajor"): string {
  const v = parse(s), [M, m, p] = v.n, pre = v.pre.length > 0;
  if (kind === "patch") return pre ? `${M}.${m}.${p}` : `${M}.${m}.${p + 1}`;
  if (kind === "minor") return pre && p === 0 ? `${M}.${m}.0` : `${M}.${m + 1}.0`;
  if (kind === "major") return pre && m === 0 && p === 0 ? `${M}.0.0` : `${M + 1}.0.0`;
  if (kind === "premajor") return `${M + 1}.0.0-0`;
  if (!pre) return `${M}.${m}.${p + 1}-0`;
  const next = [...v.pre];
  const last = next.length - 1;
  if (typeof next[last] === "number") next[last] = (next[last] as number) + 1; else next.push(0);
  return fmt({ n: v.n, pre: next });
}

const octal = (m: number) => m.toString(8).padStart(3, "0");
const sym = (m: number) => [...Array(9)].map((_, i) => ((m >> (8 - i)) & 1 ? "rwx"[i % 3] : "-")).join("");

export const opsFamilies: Family[] = [
  {
    id: "linux.chmod", tags: ["linux"], levels: [1, 20],
    make(r, level) {
      const mode = r.int(0, 511) & 0o777, ask = r.pick(["toSym", "toOct", "apply"] as const);
      if (ask === "toSym") return { prompt: `Which symbolic permission string matches \`chmod ${octal(mode)}\`?`, correct: sym(mode), wrong: [0, 1, 2, 3, 4, 5].map((i) => sym((mode ^ (1 << r.int(0, 8))) & 0o777)).concat([sym(mode ^ 0o111), sym(mode ^ 0o444)]), topic: "file permissions" };
      if (ask === "toOct") return { prompt: `\`ls -l\` shows -${sym(mode)} for a file. Which \`chmod\` octal value gives exactly these permissions?`, correct: octal(mode), wrong: [mode ^ 0o111, mode ^ 0o444, mode ^ 0o222, (mode ^ (1 << r.int(0, 8))) & 0o777, ((mode >> 3) | (mode << 6)) & 0o777].map(octal), topic: "file permissions" };
      const who = r.pick(["u", "g", "o", "a"]), op = r.pick(["+", "-", "="]), what = r.pick(["r", "w", "x", "rw", "rx", "wx", "rwx"]);
      const whoShift: Record<string, number[]> = { u: [6], g: [3], o: [0], a: [6, 3, 0] };
      let m = mode;
      const bits = (what.includes("r") ? 4 : 0) | (what.includes("w") ? 2 : 0) | (what.includes("x") ? 1 : 0);
      for (const sh of whoShift[who]) { if (op === "+") m |= bits << sh; else if (op === "-") m &= ~(bits << sh); else m = (m & ~(7 << sh)) | (bits << sh); }
      m &= 0o777;
      const sh2 = `set -e\ncd "$(mktemp -d)"\ntouch f\nchmod ${octal(mode)} f\nchmod ${who}${op}${what} f\n(stat -f %Lp f 2>/dev/null || stat -c %a f) | sed 's/^\\([0-7]\\{1,2\\}\\)$/0\\1/;s/^0*\\([0-7]\\{3\\}\\)$/\\1/'`;
      const fix = (x: string) => x.padStart(3, "0");
      return { prompt: `A file has mode ${octal(mode)}. What is its mode after \`chmod ${who}${op}${what} file\`?`, correct: octal(m), wrong: [mode, m ^ 0o111, m ^ 0o444, m ^ 0o222, (m ^ (1 << r.int(0, 8))) & 0o777].map(octal),
        topic: "file permissions", hint: "u/g/o are owner/group/others; + adds bits, - removes them, = replaces them.", verify: { lang: "sh", src: sh2, expect: fix(octal(m)) } };
    },
  },
  {
    id: "linux.umask", tags: ["linux"], levels: [5, 20],
    make(r, level) {
      const um = r.pick([0o002, 0o022, 0o027, 0o077, 0o007, 0o037, 0o012, 0o026, 0o006, 0o072, 0o052, 0o042, 0o017, 0o047, 0o067, 0o032, 0o062, 0o013]), ask = r.pick(["file", "dir"] as const);
      const base = ask === "file" ? 0o666 : 0o777, m = base & ~um & 0o777;
      const sh = `set -e\ncd "$(mktemp -d)"\numask ${octal(um)}\n${ask === "file" ? "touch x" : "mkdir x"}\n(stat -f %Lp x 2>/dev/null || stat -c %a x)`;
      return { prompt: `With \`umask ${octal(um)}\`, what mode does a newly created ${ask === "file" ? "regular file (touch)" : "directory (mkdir)"} get? (umask given as ${octal(um)}, base ${octal(base)})`, correct: octal(m),
        wrong: [(base & ~(um ^ 0o111)) & 0o777, ask === "file" ? 0o777 & ~um : 0o666 & ~um, base - um, um, base ^ um].map((x) => octal(x & 0o777)), topic: "umask", hint: "New files start from 666 and directories from 777, then the umask bits are cleared.",
        verify: { lang: "sh", src: sh, expect: octal(m) } };
    },
  },
  {
    id: "linux.pipeline", tags: ["linux"], levels: [3, 20],
    make(r, level) {
      const n = r.int(5, 8 + tier(level)), rows = Array.from({ length: n }, () => ({ name: r.pick(NAMES), team: r.pick(["ops", "dev", "qa"]), n: r.int(1, 90) }));
      const csv = rows.map((x) => `${x.name},${x.team},${x.n}`).join("\n");
      const t = r.pick(["ops", "dev", "qa"]), k = r.int(10, 60);
      const forms: [string, string][] = [
        [`cut -d, -f2 | sort -u | wc -l`, String(new Set(rows.map((x) => x.team)).size)], [`grep -c ',${t},'`, String(rows.filter((x) => x.team === t).length)],
        [`grep ',${t},' | cut -d, -f3 | paste -sd+ - | bc`, String(rows.filter((x) => x.team === t).reduce((s, x) => s + x.n, 0))], [`awk -F, '$3 > ${k}' | wc -l`, String(rows.filter((x) => x.n > k).length)],
        [`sort -t, -k3 -n | tail -1 | cut -d, -f1`, [...rows].sort((a, b) => a.n - b.n)[n - 1].name], [`cut -d, -f1 | sort | head -1`, [...rows].map((x) => x.name).sort()[0]],
        [`awk -F, '{s+=$3} END {print s}'`, String(rows.reduce((s, x) => s + x.n, 0))], [`cut -d, -f1 | sort | uniq -d | wc -l`, String([...new Set(rows.map((x) => x.name))].filter((nm) => rows.filter((x) => x.name === nm).length > 1).length)],
        [`head -3 | tail -1 | cut -d, -f1`, rows[2].name], [`wc -l`, String(n)],
      ];
      const [cmd, v] = r.pick(level < 8 ? forms.slice(0, 5) : forms);
      const wr = Number.isFinite(Number(v)) ? nearNums(r, Number(v)).map(String).filter((x) => Number(x) >= 0) : [...new Set(rows.map((x) => x.name))];
      const sh = `printf '%s\\n' ${rows.map((x) => `'${x.name},${x.team},${x.n}'`).join(" ")} | ${cmd} | tr -d ' '`;
      return { prompt: `A file data.csv holds the ${n} lines below (name,team,count). What does \`cat data.csv | ${cmd}\` print?`, code: csv, correct: v, wrong: wr.filter((x) => x !== v), topic: "pipes and text tools",
        verify: { lang: "sh", src: sh, expect: v } };
    },
  },
  {
    id: "linux.path", tags: ["linux"], levels: [2, 20],
    make(r, level) {
      const segs = r.sample(WORDS, 4), start = `/${segs.slice(0, r.int(2, 3)).join("/")}`;
      const steps = Array.from({ length: r.int(2, 3 + tier(level)) }, () => r.pick(["..", "..", ".", `${r.pick(WORDS)}`, `../${r.pick(WORDS)}`, `./${r.pick(WORDS)}`]));
      const cur = start.split("/").filter(Boolean);
      for (const s of steps) for (const p of s.split("/")) { if (p === "..") cur.pop(); else if (p !== ".") cur.push(p); }
      const v = "/" + cur.join("/");
      const posix = `const p=require("path").posix;let c=${JSON.stringify(start)};for(const s of ${JSON.stringify(steps)})c=p.resolve(c,s);console.log(c)`;
      const wr = ["/" + cur.slice(0, -1).join("/"), "/" + [...cur, steps[0]].join("/"), start, "/" + start.split("/").filter(Boolean).slice(0, 1).join("/"), "/" + cur.slice(1).join("/"), "/" + [...cur, r.pick(WORDS)].join("/"), "/" + [...start.split("/").filter(Boolean), ...steps.filter((x) => !x.includes(".")).slice(0, 1)].join("/")];
      return { prompt: `You are in ${start} and run \`${steps.map((s) => `cd ${s}`).join(" && ")}\`. What does \`pwd\` print? (Every directory exists.)`, correct: v === "/" ? "/" : v, wrong: wr.filter((x) => x !== v), topic: "paths",
        verify: { lang: "js", src: posix, expect: v } };
    },
  },
  {
    id: "npm.semver", tags: ["npm"], levels: [3, 20],
    make(r, level) {
      const maj = r.int(0, 4), mins = r.int(1, 4);
      const all: string[] = [];
      for (let ma = Math.max(0, maj - 1); ma <= maj + 1; ma++) for (let mi = 0; mi < mins; mi++) for (const pa of [0, r.int(1, 4)]) all.push(`${ma}.${mi}.${pa}`);
      const versions = [...new Set(all)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), pick = r.pick(versions.filter((v) => !v.startsWith("0.") || r.chance(0.3)));
      const [pm, pmi, pp] = pick.split(".").map(Number);
      const forms = [`^${pick}`, `~${pick}`, `>=${pick}`, `<${pick}`, `${pm}.x`, `${pm}.${pmi}.x`, `>${pick} <${pm + 1}.0.0`, `^${pm}.${pmi}`, `~${pm}.${pmi}`, `*`];
      const range = r.shuffle(level < 8 ? forms.slice(0, 4) : forms).find((f) => maxSatisfying(versions, f));
      if (!range) throw new Error("none");
      const v = maxSatisfying(versions, range)!;
      const others = versions.filter((x) => x !== v);
      return { prompt: `The registry has these versions: ${versions.join(", ")}. Which version does npm install for the range "${range}"?`, correct: v, wrong: r.shuffle(others), topic: "semver ranges", hint: "npm picks the highest version that satisfies the range. ^ allows changes that keep the left-most non-zero digit.",
        verify: { lang: "js", src: `const s=require(${semverPath()});console.log(s.maxSatisfying(${JSON.stringify(versions)},${JSON.stringify(range)}))`, expect: v } };
    },
  },
  {
    id: "npm.bump", tags: ["npm"], levels: [1, 20],
    make(r, level) {
      const v = `${r.int(0, 9)}.${r.int(0, 20)}.${r.int(0, 30)}${r.chance(level > 8 ? 0.4 : 0) ? `-${r.pick(["alpha", "beta", "rc"])}.${r.int(0, 5)}` : ""}`;
      const kind = r.pick(["patch", "minor", "major", "prerelease"] as const);
      const out = inc(v, kind);
      const near = (["patch", "minor", "major", "prerelease", "premajor"] as const).map((k) => inc(v, k));
      return { prompt: `package.json is at version ${v}. What version is it after \`npm version ${kind}\`?`, correct: out, wrong: near.filter((x) => x !== out), topic: "npm version",
        verify: { lang: "js", src: `console.log(require(${semverPath()}).inc(${JSON.stringify(v)},${JSON.stringify(kind)}))`, expect: out } };
    },
  },
  {
    id: "npm.scripts", tags: ["npm"], levels: [5, 20],
    make(r, level) {
      const name = r.pick(["build", "test", "start", "lint", "deploy"]), [a, b, c] = r.sample(WORDS, 3);
      const hasPre = r.chance(0.7), hasPost = r.chance(0.7), chain = r.chance(0.5), other = r.pick(["build", "test", "lint", "deploy"].filter((x) => x !== name));
      const scripts: Record<string, string> = { [name]: `echo ${a}${chain ? ` && echo ${b}` : ""}` };
      if (hasPre) scripts[`pre${name}`] = `echo ${c}`;
      if (hasPost) scripts[`post${name}`] = `echo ${b}${c}`;
      const failing = r.chance(0.25) && hasPre;
      if (failing) scripts[`pre${name}`] = `echo ${c} && exit 1`;
      const out = [...(hasPre ? [c] : []), ...(failing ? [] : [a, ...(chain ? [b] : []), ...(hasPost ? [b + c] : [])])];
      const sh = `set -e\ncd "$(mktemp -d)"\nprintf '%s' '${JSON.stringify({ name: "t", version: "1.0.0", scripts })}' > package.json\nnpm run -s ${name} 2>/dev/null || true`;
      void other;
      return { prompt: `package.json scripts: ${JSON.stringify(scripts)}. What lines (in order) are printed by \`npm run ${name}\`?`, correct: out.join(", "),
        wrong: [[...out].reverse(), out.slice(1), out.slice(0, -1), [a, ...(hasPre ? [c] : [])], [...out, other], [a, b + c, c], [c, a, b], [a], [...out, a], [other, ...out]].map((x) => x.join(", ")).filter((x) => x && x !== out.join(", ")), topic: "npm scripts", hint: "npm runs pre<name> first and post<name> last; a failing pre-script stops the run.",
        verify: { lang: "sh", src: sh, expect: out.join("\n") } };
    },
  },
  {
    id: "docker.layers", tags: ["docker"], levels: [1, 20],
    make(r, level) {
      const meta = ["ENV NODE_ENV=production", `EXPOSE ${r.pick([3000, 8080, 5432])}`, `LABEL team=${r.pick(WORDS)}`, `ARG VERSION=${r.int(1, 9)}`, `USER app`, `CMD ["node", "server.js"]`, `ENTRYPOINT ["./run.sh"]`];
      const fs = ["RUN npm ci", `COPY package.json /app/`, `COPY . /app`, `RUN apt-get update`, `ADD ${r.pick(WORDS)}.tar.gz /opt/`, `RUN echo ${r.pick(WORDS)} > /tmp/x`, `COPY --from=build /out /app`];
      const pick = r.shuffle([...r.sample(fs, r.int(2, 4 + tier(level))), ...r.sample(meta, r.int(2, 4))]);
      const layers = pick.filter((x) => /^(RUN|COPY|ADD)\b/.test(x)).length;
      return { prompt: `The Dockerfile below has ${pick.length} instructions after FROM. How many new image layers do they add? (Instructions: ${pick.map((p) => p.split(" ")[0]).join(" ")})`, code: `FROM node:20\n${pick.join("\n")}`, correct: String(layers),
        wrong: nearNums(r, layers).map(String).concat([String(pick.length)]).filter((x) => x !== String(layers) && Number(x) >= 0), topic: "image layers", hint: "Only RUN, COPY and ADD change the filesystem and create layers; the rest only record metadata." };
    },
  },
  {
    id: "docker.cache", tags: ["docker"], levels: [4, 20],
    make(r, level) {
      const steps = r.shuffle(["COPY package.json ./", "RUN npm ci", "COPY . .", "RUN npm run build", "ENV NODE_ENV=production", "EXPOSE 3000", `RUN echo ${r.pick(WORDS)}`, "CMD [\"npm\", \"start\"]"]).slice(0, r.int(5, 8));
      const idx = r.int(0, steps.length - 1);
      const rebuilt = steps.length - idx;
      return { prompt: `You rebuild after changing the content of step ${idx + 1} of ${steps.length} (${steps[idx].split(" ")[0]}). With layer caching, how many instructions after FROM run again (including that step)? Changed step: ${steps[idx]}`, code: `FROM node:20\n${steps.map((s, i) => `${s}${i === idx ? "   # changed" : ""}`).join("\n")}`,
        correct: String(rebuilt), wrong: nearNums(r, rebuilt).map(String).concat([String(steps.length), "1"]).filter((x) => x !== String(rebuilt) && Number(x) > 0), topic: "build cache", hint: "A changed instruction invalidates the cache for itself and every instruction after it." };
    },
  },
  {
    id: "docker.cmd", tags: ["docker"], levels: [8, 20],
    make(r, level) {
      const ep = r.pick(["python", "node", "java", "sh"]), file = r.pick(WORDS) + r.pick([".py", ".js", ".jar"]), arg = r.pick(["--fast", "--debug", "-v", "--port=80"]), arg2 = r.pick(["--dry", "-q", "--env=prod"]);
      const kind = r.pick(["both", "cmdOnly", "epOnly", "override"] as const);
      const df = kind === "cmdOnly" ? `CMD ["${ep}", "${file}"]` : kind === "epOnly" ? `ENTRYPOINT ["${ep}", "${file}"]` : `ENTRYPOINT ["${ep}"]\nCMD ["${file}", "${arg}"]`;
      const run = kind === "override" ? ` ${arg2}` : kind === "epOnly" ? ` ${arg2}` : "";
      const v = kind === "cmdOnly" ? `${ep} ${file}${run}` : kind === "epOnly" ? `${ep} ${file} ${arg2}` : kind === "both" ? `${ep} ${file} ${arg}` : `${ep} ${arg2}`;
      const v2 = kind === "cmdOnly" && run ? arg2 : v;
      const wr = [`${ep} ${file}`, `${ep} ${file} ${arg}`, `${ep} ${arg2}`, `${file} ${arg2}`, `${ep} ${file} ${arg2}`, `${ep} ${file} ${arg} ${arg2}`];
      const cmd = `docker run img${run}`;
      return { prompt: `Given this Dockerfile (${ep} ${file}${kind === "both" || kind === "override" ? ` default arg ${arg}` : ""}), which process command line runs inside the container for \`${cmd}\`?`, code: df, correct: v2, wrong: wr.filter((x) => x !== v2), topic: "ENTRYPOINT and CMD",
        hint: "Arguments to docker run replace CMD but are appended to an exec-form ENTRYPOINT." };
    },
  },
  {
    id: "docker.ports", tags: ["docker"], levels: [2, 20],
    make(r, level) {
      const host = r.pick([8080, 8000, 3001, 5000, 9090, 8443]), cont = r.pick([80, 3000, 5432, 8080, 443]), bind = r.chance(0.3) ? "127.0.0.1:" : "";
      const flag = `-p ${bind}${host}:${cont}`;
      return { prompt: `A web server listens on port ${cont} inside the container. The container starts with \`docker run ${flag} app\`. On the Docker host, which URL reaches it${bind ? " (from another machine on the network)" : ""}?`,
        correct: bind ? "Not reachable: it is bound to localhost only" : `http://localhost:${host}`, wrong: bind ? [`http://<host-ip>:${host}`, `http://<host-ip>:${cont}`, `http://localhost:${cont}`] : [`http://localhost:${cont}`, `http://localhost:${host + 1}`, `http://container:${host}`, `http://localhost:${host}:${cont}`],
        topic: "port publishing", hint: "-p host:container publishes the container port on the host port." };
    },
  },
];
