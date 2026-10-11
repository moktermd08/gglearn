import type { Family } from "../types";
import { IDENTS, NAMES, NOUNS, WORDS, nearNums, tier } from "../kit";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const langFamilies: Family[] = [
  {
    id: "oop.dispatch", tags: ["oop", "js"], levels: [1, 20],
    make(r, level) {
      const [A, B, C] = r.sample(["Animal", "Vehicle", "Shape", "Account", "Widget", "Member", "Report", "Engine"], 3).map((x, i) => x + (i ? ["", "Pro", "Max"][i] : ""));
      const [a, b, c] = r.sample(WORDS, 3), depth = level > 10 ? 3 : 2, callSuper = [r.chance(0.7), r.chance(0.7)], overrideB = r.chance(0.8), overrideC = depth === 3 && r.chance(0.8);
      let code = `class ${A} {\n  who() { return "${a}"; }\n  hi() { return "hi-" + this.who(); }\n}\n`;
      code += `class ${B} extends ${A} {\n${overrideB ? `  who() { return ${callSuper[0] ? `super.who() + "+${b}"` : `"${b}"`}; }\n` : ""}}\n`;
      if (depth === 3) code += `class ${C} extends ${B} {\n${overrideC ? `  who() { return ${callSuper[1] ? `super.who() + "+${c}"` : `"${c}"`}; }\n` : ""}}\n`;
      const leaf = depth === 3 ? C : B;
      const who = (cls: number): string => {
        if (cls === 0) return a;
        if (cls === 1) return overrideB ? (callSuper[0] ? `${who(0)}+${b}` : b) : who(0);
        return overrideC ? (callSuper[1] ? `${who(1)}+${c}` : c) : who(1);
      };
      const v = `hi-${who(depth === 3 ? 2 : 1)}`;
      code += `console.log(new ${leaf}().hi());`;
      const wr = [`hi-${a}`, `hi-${b}`, `hi-${a}+${b}`, `hi-${b}+${a}`, `hi-${c}`, `hi-${b}+${c}`, `hi-${a}+${b}+${c}`, "hi-undefined", `hi-${c}+${b}`];
      return { prompt: `What does this program print? (classes ${A}${" › " + B}${depth === 3 ? " › " + C : ""}; labels ${a}, ${b}${depth === 3 ? ", " + c : ""})`, code, correct: v, wrong: wr.filter((x) => x !== v), topic: "inheritance and polymorphism",
        hint: "this.who() dispatches on the object's real class; super.who() calls the parent's version.", verify: { lang: "js", src: code, expect: v } };
    },
  },
  {
    id: "oop.static", tags: ["oop", "js"], levels: [2, 20],
    make(r, level) {
      const K = cap(r.pick(NOUNS)), n = r.int(2, 5), step = r.int(1, 4), kind = r.pick(["static", "instance", "both"] as const);
      const code = `class ${K} {\n  static total = 0;\n  count = 0;\n  add() {\n    ${K}.total += ${step};\n    this.count += ${step};\n    return this;\n  }\n}\nconst x = new ${K}();\nconst y = new ${K}();\n${Array.from({ length: n }, (_, i) => `${i % 2 ? "y" : "x"}.add();`).join("\n")}\nconsole.log(${kind === "static" ? `${K}.total` : kind === "instance" ? "x.count" : "x.count + y.count + " + K + ".total"});`;
      const xs = Math.ceil(n / 2), ys = Math.floor(n / 2), v = kind === "static" ? n * step : kind === "instance" ? xs * step : xs * step + ys * step + n * step;
      return { prompt: `What does this print? (class ${K}, ${n} add() calls alternating x, y; step ${step}; expression kind: ${kind})`, code, correct: String(v), wrong: nearNums(r, v, 3, step).map(String).concat([String(n * step * 2)]).filter((x) => x !== String(v)), topic: "static vs instance state",
        verify: { lang: "js", src: code, expect: String(v) } };
    },
  },
  {
    id: "ts.assign", tags: ["ts"], levels: [1, 20],
    make(r, level) {
      const [a, b, c] = r.sample(IDENTS, 3), T = cap(r.pick(NOUNS)), lit = r.sample(["draft", "live", "paused", "done", "open"], 3), n = r.int(1, 90), w = r.pick(WORDS);
      type S = { decls: string; good: string[]; bad: string[]; topic: string };
      const pool: S[] = [
        { decls: `type Mode = ${lit.slice(0, 2).map((x) => `"${x}"`).join(" | ")};`, good: [`let m: Mode = "${lit[0]}";`, `const m: Mode = "${lit[1]}";`, `let m: Mode = "${lit[0]}"; m = "${lit[1]}";`], bad: [`let m: Mode = "${lit[2]}";`, `let m: Mode = "${lit[0]}"; m = "${lit[2]}";`, `const m: Mode = 1;`], topic: "literal unions" },
        { decls: `interface ${T} { ${a}: number; ${b}?: string }`, good: [`const v: ${T} = { ${a}: ${n} };`, `const v: ${T} = { ${a}: ${n}, ${b}: "${w}" };`, `const v: ${T} = { ${a}: ${n} }; v.${a}++;`], bad: [`const v: ${T} = { ${b}: "${w}" };`, `const v: ${T} = { ${a}: "${w}" };`, `const v: ${T} = { ${a}: ${n}, ${c}: 1 };`], topic: "object types" },
        { decls: `type Pair = [number, string];`, good: [`const p: Pair = [${n}, "${w}"];`, `const p: Pair = [${n}, "${w}"]; const q: number = p[0];`, `let p: Pair = [0, ""]; p = [${n}, "${w}"];`], bad: [`const p: Pair = ["${w}", ${n}];`, `const p: Pair = [${n}];`, `const p: Pair = [${n}, "${w}", true];`], topic: "tuples" },
        { decls: `const cfg = { ${a}: ${n}, ${b}: "${w}" } as const;`, good: [`const x: number = cfg.${a};`, `const x: "${w}" = cfg.${b};`, `const x = cfg.${a} + 1;`], bad: [`cfg.${a} = ${n + 1};`, `cfg.${b} = "x";`, `const x: string = cfg.${a};`], topic: "readonly and as const" },
        { decls: `function find(id: number): string | null { return id > 0 ? "${w}" : null; }`, good: [`const r = find(${n})?.length;`, `const r = find(${n}) ?? "none";`, `const r = find(${n}); if (r) { r.length; }`], bad: [`const r = find(${n}).length;`, `const r: string = find(${n});`, `find("${w}");`], topic: "null checks" },
        { decls: `function area(w: number, h?: number): number { return w * (h ?? 1); }`, good: [`area(${n});`, `area(${n}, ${n + 1});`, `const v: number = area(${n});`], bad: [`area();`, `area(${n}, ${n}, ${n});`, `const v: string = area(${n});`], topic: "function parameters" },
        { decls: `const xs: readonly number[] = [${n}, ${n + 1}];`, good: [`xs.map((x) => x * 2);`, `const y = xs[0];`, `const z = [...xs, ${n}];`], bad: [`xs.push(${n});`, `xs[0] = ${n};`, `xs.length = 0;`], topic: "readonly arrays" },
        { decls: `let u: unknown = ${n};`, good: [`if (typeof u === "number") { u.toFixed(); }`, `const s = String(u);`, `u = "${w}";`], bad: [`u.toFixed();`, `const n: number = u;`, `u + 1;`], topic: "unknown" },
        { decls: `type Shape = { kind: "sq"; side: number } | { kind: "ci"; r: number };`, good: [`const s: Shape = { kind: "sq", side: ${n} };`, `const s: Shape = { kind: "ci", r: ${n} };`, `function f(s: Shape) { return s.kind === "sq" ? s.side : s.r; }`], bad: [`const s: Shape = { kind: "sq", r: ${n} };`, `function f(s: Shape) { return s.side; }`, `const s: Shape = { kind: "tri", side: ${n} };`], topic: "discriminated unions" },
      ];
      const sc = r.pick(level < 6 ? pool.slice(0, 4) : pool);
      const bad = r.pick(sc.bad), good = r.sample(sc.good, 3);
      return { prompt: `With \`strict\` on, which statement fails to compile? (${sc.topic}; ${sc.decls.replace(/\s+/g, " ").slice(0, 60)})`, code: sc.decls, correct: bad, wrong: good, topic: sc.topic,
        verify: { lang: "ts", programs: [{ src: `${sc.decls}\n${bad}`, ok: false }, ...good.map((g) => ({ src: `${sc.decls}\n${g}`, ok: true }))] } };
    },
  },
  {
    id: "ts.keys", tags: ["ts"], levels: [5, 20],
    make(r, level) {
      const keys = r.sample(["id", "name", "email", "age", "city", "role", "plan", "score"], r.int(4, 6)), T = cap(r.pick(NOUNS));
      const opt = new Set(r.sample(keys, r.int(0, 2)));
      const decl = `interface ${T} { ${keys.map((k) => `${k}${opt.has(k) ? "?" : ""}: ${r.pick(["string", "number", "boolean"])}`).join("; ")} }`;
      const pk = r.sample(keys, r.int(2, 3));
      const forms: [string, string[]][] = [
        [`keyof Pick<${T}, ${pk.map((k) => `"${k}"`).join(" | ")}>`, pk], [`keyof Omit<${T}, ${pk.map((k) => `"${k}"`).join(" | ")}>`, keys.filter((k) => !pk.includes(k))], [`keyof ${T}`, keys],
        [`keyof Partial<${T}>`, keys], [`Exclude<keyof ${T}, ${pk.map((k) => `"${k}"`).join(" | ")}>`, keys.filter((k) => !pk.includes(k))], [`Extract<keyof ${T}, "${pk[0]}" | "zzz">`, [pk[0]]],
      ];
      const [ty, ks] = r.pick(level < 9 ? forms.slice(0, 3) : forms);
      const fmt = (a: string[]) => a.map((k) => `"${k}"`).join(" | ");
      const wrong = [forms[2][1], keys.filter((k) => !ks.includes(k)), ks.slice(1), [...ks, r.pick(keys.filter((k) => !ks.includes(k)).concat(["zzz"]))], keys.slice(0, 2), pk].map(fmt);
      return { prompt: `Given \`${decl}\`, what union of keys is the type \`${ty}\`? (${keys.length} keys)`, correct: fmt(ks), wrong: wrong.filter((x) => x !== fmt(ks)), topic: "utility types",
        verify: { lang: "tskeys", src: decl, type: ty.startsWith("keyof ") ? ty.slice(6) : `Pick<{ [K in ${ty}]: 1 }, ${ty}>`, expect: ks } };
    },
  },
];
