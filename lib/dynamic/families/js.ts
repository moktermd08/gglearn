import type { Family } from "../types";
import { IDENTS, NAMES, WORDS, nearNums, tier, variants } from "../kit";

const q = (s: string) => JSON.stringify(s);

export const jsFamilies: Family[] = [
  {
    id: "js.arith", tags: ["js"], levels: [1, 20],
    make(r, level) {
      const t = tier(level), a = r.int(2, 9 + t * 12), b = r.int(2, 9 + t * 8), c = r.int(2, 9 + t * 6), d = r.int(2, 5);
      const forms: [string, number][] = [
        [`${a} + ${b} * ${c}`, a + b * c], [`(${a} + ${b}) * ${c}`, (a + b) * c], [`${a} * ${b} - ${c}`, a * b - c],
        [`${a * b + c} % ${b}`, (a * b + c) % b], [`${a} ** 2 + ${b}`, a ** 2 + b], [`Math.floor(${a * d + c} / ${d})`, Math.floor((a * d + c) / d)],
        [`${a} + ${b} % ${d} * ${c}`, a + (b % d) * c], [`Math.max(${a}, ${b}) - Math.min(${b}, ${c})`, Math.max(a, b) - Math.min(b, c)],
        [`${a} - ${b} - ${c}`, a - b - c], [`${a} ** ${d} % ${c + 2}`, (a ** d) % (c + 2)],
      ];
      const [expr, val] = r.pick(t === 0 ? forms.slice(0, 4) : forms);
      return { prompt: `What does \`console.log(${expr})\` print?`, correct: String(val), wrong: nearNums(r, val).map(String), topic: "operators",
        hint: "Multiplication, division and % bind tighter than + and -; ** binds tighter still.", verify: { lang: "js", src: `console.log(${expr})`, expect: String(val) } };
    },
  },
  {
    id: "js.coerce", tags: ["js"], levels: [3, 20],
    make(r, level) {
      const n = r.int(2, 9 + level), m = r.int(2, 9), w = r.pick(WORDS);
      const forms: [string, string][] = [
        [`${q(String(n))} + ${m}`, `${n}${m}`], [`${q(String(n))} - ${m}`, String(n - m)], [`${q(String(n))} * ${q(String(m))}`, String(n * m)],
        [`${n} + ${m} + ${q(w)}`, `${n + m}${w}`], [`${q(w)} + ${n} + ${m}`, `${w}${n}${m}`], [`${q(String(n))} == ${n}`, "true"], [`${q(String(n))} === ${n}`, "false"],
        [`[${n}] + [${m}]`, `${n}${m}`], [`typeof (${q(String(n))} * 1)`, "number"], [`+${q(w)}`, "NaN"], [`${n} > ${q(String(m))}`, String(n > m)],
        [`[${n}, ${m}] + ""`, `${n},${m}`], [`!!${q("")} + !!${q(w)}`, "1"], [`${n} + null`, String(n)], [`${n} + undefined`, "NaN"],
      ];
      const [expr, val] = r.pick(forms);
      const types = ["number", "string", "boolean", "object", "undefined"];
      const wrongs = val === "true" || val === "false" ? [val === "true" ? "false" : "true", "NaN", "undefined", "TypeError"]
        : /^-?\d+$/.test(val) ? [...nearNums(r, Number(val)).map(String), "NaN"]
        : val === "NaN" ? ["0", "undefined", "null", "1"] : types.includes(val) ? types
        : [...variants(val), String(n + m), String(n * m)];
      return { prompt: `What does \`console.log(${expr})\` print?`, correct: val, wrong: r.shuffle(wrongs), topic: "type coercion",
        hint: "+ concatenates once either side is a string; - * / convert to numbers.", verify: { lang: "js", src: `console.log(${expr})`, expect: val } };
    },
  },
  {
    id: "js.string", tags: ["js"], levels: [1, 20],
    make(r, level) {
      const w = r.pick(WORDS) + r.pick(WORDS), n = r.int(1, 3), k = r.int(n + 1, Math.min(w.length - 1, n + 5));
      const forms: [string, string][] = [
        [`${q(w)}.slice(${n}, ${k})`, w.slice(n, k)], [`${q(w)}.slice(-${n})`, w.slice(-n)], [`${q(w)}.toUpperCase().charAt(${n})`, w.toUpperCase().charAt(n)],
        [`${q(w)}.indexOf(${q(w[k])})`, String(w.indexOf(w[k]))], [`${q(w)}.length - ${n}`, String(w.length - n)], [`${q(w)}.substring(${k}, ${n})`, w.substring(k, n)],
        [`${q(w)}.split(${q(w[n])}).length`, String(w.split(w[n]).length)], [`${q(w.slice(0, k))}.padEnd(${w.length}, "-")`, w.slice(0, k).padEnd(w.length, "-")],
        [`${q(w)}.replace(${q(w[n])}, "_")`, w.replace(w[n], "_")], [`${q(w)}.repeat(${n}).length`, String(w.length * n)],
        [`${q(w)}.split("").reverse().join("").slice(0, ${k})`, w.split("").reverse().join("").slice(0, k)], [`${q(w)}.at(-${n})`, w.at(-n)!],
        [`${q(w)}.lastIndexOf(${q(w[n])})`, String(w.lastIndexOf(w[n]))], [`${q(w)}.includes(${q(w.slice(n, k))})`, "true"],
      ];
      const [expr, val] = r.pick(level < 6 ? forms.slice(0, 7) : forms);
      const wr = new Set<string>(/^-?\d+$/.test(val) ? nearNums(r, Number(val)).map(String) : val === "true" || val === "false" ? ["true", "false", "undefined", "-1"] : variants(val));
      wr.delete(val);
      return { prompt: `What does \`console.log(${expr})\` print?`, correct: val, wrong: [...wr], topic: "strings", verify: { lang: "js", src: `console.log(${expr})`, expect: val } };
    },
  },
  {
    id: "js.array", tags: ["js"], levels: [2, 20],
    make(r, level) {
      const len = r.int(4, 5 + tier(level)), arr = Array.from({ length: len }, () => r.int(1, 9 + tier(level) * 10));
      const k = r.int(2, 4), cut = r.int(1, len - 2), A = `[${arr.join(", ")}]`;
      const forms: [string, string][] = [
        [`${A}.map(x => x * ${k}).join("-")`, arr.map((x) => x * k).join("-")], [`${A}.filter(x => x % ${k} === 0).length`, String(arr.filter((x) => x % k === 0).length)],
        [`${A}.reduce((s, x) => s + x, 0)`, String(arr.reduce((s, x) => s + x, 0))], [`${A}.slice(${cut}).join("")`, arr.slice(cut).join("")],
        [`${A}.indexOf(${arr[cut]})`, String(arr.indexOf(arr[cut]))], [`${A}.some(x => x > ${k * 5})`, String(arr.some((x) => x > k * 5))],
        [`${A}.every(x => x > ${k})`, String(arr.every((x) => x > k))], [`${A}.find(x => x > ${k * 3}) ?? "none"`, String(arr.find((x) => x > k * 3) ?? "none")],
        [`[...${A}].sort().join(",")`, [...arr].sort().join(",")], [`[...${A}].sort((a, b) => b - a)[0]`, String(Math.max(...arr))],
        [`${A}.reduce((m, x) => Math.max(m, x), 0) - ${A}.reduce((m, x) => Math.min(m, x), 99)`, String(Math.max(...arr) - Math.min(...arr))],
        [`${A}.findLastIndex(x => x < ${k * 4})`, String(arr.findLastIndex((x) => x < k * 4))], [`${A}.flatMap(x => [x, ${k}]).length`, String(len * 2)],
        [`${A}.toSpliced(${cut}, 1).length`, String(len - 1)],
      ];
      const [expr, val] = r.pick(level < 5 ? forms.slice(0, 5) : forms);
      const base = Number(val);
      const wr = Number.isFinite(base) && val !== "" && !val.includes("-") ? nearNums(r, base).map(String) : [];
      wr.push("true", "false", "undefined", "none", arr.join("-"), String(len), [...arr].sort().join(","), arr.slice(0, cut).join(""));
      return { prompt: `What does \`console.log(${expr})\` print?`, correct: val, wrong: wr.filter((x) => x !== val), topic: "arrays",
        hint: "default sort() compares as strings; sort((a,b)=>a-b) compares numerically.", verify: { lang: "js", src: `console.log(${expr})`, expect: val } };
    },
  },
  {
    id: "js.scope", tags: ["js"], levels: [5, 20],
    make(r, level) {
      const n = r.int(3, 5), v = r.pick(IDENTS), kind = r.pick(["var", "let"] as const);
      const delay = r.pick(["0", "10"]);
      const code = `for (${kind} ${v} = 0; ${v} < ${n}; ${v}++) {\n  setTimeout(() => console.log(${v}), ${delay});\n}`;
      const correct = kind === "var" ? Array(n).fill(String(n)).join(", ") : Array.from({ length: n }, (_, i) => i).join(", ");
      const alt = kind === "var" ? Array.from({ length: n }, (_, i) => i).join(", ") : Array(n).fill(String(n)).join(", ");
      const wr = [alt, Array.from({ length: n }, (_, i) => i + 1).join(", "), Array(n).fill("undefined").join(", "), Array.from({ length: n }, (_, i) => n - 1 - i).join(", "), String(n)];
      return { prompt: `What is logged by this ${kind} loop (${v} is the counter, ${n} iterations, timeout ${delay}ms)?`, code, correct, wrong: wr, topic: "scope and closures",
        hint: "var is function scoped: all callbacks share one binding. let creates a new binding per iteration.",
        verify: { lang: "js", src: `${code.replace(/console\.log\(/, "console.log(")}`, expect: correct.split(", ").join("\n") } };
    },
  },
  {
    id: "js.closure", tags: ["js"], levels: [7, 20],
    make(r, level) {
      const step = r.int(1, 4 + tier(level)), start = r.int(0, 9), calls = r.int(2, 5), two = r.chance(0.5);
      const code = `function makeCounter(n) {\n  return () => (n += ${step});\n}\nconst a = makeCounter(${start});\n${two ? `const b = makeCounter(${start});\n` : ""}${Array.from({ length: calls - 1 }, () => "a();").join("\n")}\nconsole.log(${two ? "a() + b()" : "a()"});`;
      const val = two ? start + step * calls + (start + step) : start + step * calls;
      return { prompt: `What is printed (counter starts at ${start}, step ${step}, ${calls} calls to a${two ? " and one to b" : ""})?`, code, correct: String(val),
        wrong: nearNums(r, val, 3, step).map(String), topic: "closures", hint: "Each makeCounter call owns its own n; calls on the same closure accumulate.",
        verify: { lang: "js", src: code, expect: String(val) } };
    },
  },
  {
    id: "js.async", tags: ["js", "node"], levels: [9, 20],
    make(r, level) {
      const L = r.shuffle(["A", "B", "C", "D", "E", "F", "G"]).slice(0, 5 + (level > 14 ? 1 : 0)), [s1, p1, t1, p2, s2] = L;
      const hasNT = level > 14, nt = hasNT ? L[5] : null;
      const code = `console.log("${s1}");\nsetTimeout(() => console.log("${t1}"), 0);\nPromise.resolve().then(() => console.log("${p1}"));\n${nt ? `process.nextTick(() => console.log("${nt}"));\n` : ""}(async () => {\n  await null;\n  console.log("${p2}");\n})();\nconsole.log("${s2}");`;
      const order = [s1, s2, ...(nt ? [nt] : []), p1, p2, t1];
      const correct = order.join(", ");
      const wr = [[s1, s2, t1, p1, p2], [s1, p1, p2, t1, s2], [s1, s2, p2, p1, t1], [t1, s1, s2, p1, p2], [s1, s2, t1, p1, p2].reverse()].map((a) => (nt ? [...a, nt] : a).join(", "));
      if (nt) wr.push([s1, s2, p1, p2, nt, t1].join(", "));
      return { prompt: `In what order do the letters print (Node.js, CommonJS)? Letters here: ${L.join(" ")}.`, code, correct, wrong: wr, topic: "event loop",
        hint: "Sync code first, then nextTick, then promise microtasks, then timers.", verify: { lang: "js", src: code, expect: order.join("\n") } };
    },
  },
  {
    id: "js.object", tags: ["js"], levels: [6, 20],
    make(r, level) {
      const name = r.pick(NAMES), age = r.int(18, 60), key = r.pick(IDENTS), val = r.int(1, 99);
      const forms: [string, string][] = [
        [`const { name, age = ${age + 1} } = { name: ${q(name)} };\nconsole.log(age);`, String(age + 1)],
        [`const o = { ${key}: ${val}, ...{ ${key}: ${val + 1} } };\nconsole.log(o.${key});`, String(val + 1)],
        [`const o = { a: { b: ${val} } };\nconsole.log(o.a?.c?.d ?? ${age});`, String(age)],
        [`const o = { ${key}: 0 };\nconsole.log(o.${key} || ${val}, o.${key} ?? ${val});`, `${val} 0`],
        [`const [x, , y = ${age}] = [${val}, ${val + 1}];\nconsole.log(x + y);`, String(val + age)],
        [`const o = { n: ${val} };\nconst p = o;\np.n++;\nconsole.log(o.n);`, String(val + 1)],
        [`const o = { n: ${val} };\nconst p = { ...o };\np.n++;\nconsole.log(o.n);`, String(val)],
        [`console.log(Object.keys({ ${key}: 1, [${q(name)}]: 2, 3: 3 }).join());`, `3,${key},${name}`],
        [`const f = ({ a, b = ${val} } = {}) => a + b;\nconsole.log(f({ a: ${age} }));`, String(age + val)],
        [`const m = new Map([[${val}, ${q(name)}]]);\nconsole.log(m.get(${val}), m.get(${q(String(val))}));`, `${name} undefined`],
      ];
      const [code, val2] = r.pick(level < 9 ? forms.slice(0, 6) : forms);
      const wr = [...nearNums(r, Number(val2) || val).map(String), "undefined", "NaN", "null", String(val), String(age), `${name} ${name}`, `${val} ${val}`];
      return { prompt: `What does this print? (values: ${key}=${val}, n=${val}, age=${age})`, code, correct: val2, wrong: wr.filter((x) => x !== val2), topic: "objects and destructuring",
        verify: { lang: "js", src: code, expect: val2 } };
    },
  },
  {
    id: "js.recursion", tags: ["js"], levels: [10, 20],
    make(r, level) {
      const n = r.int(3, 6 + tier(level)), kind = r.pick(["fact", "fib", "sumDigits", "pow", "gcd"] as const);
      let fn = "", call = "", val = 0;
      if (kind === "fact") { fn = "const f = (n) => (n <= 1 ? 1 : n * f(n - 1));"; call = `f(${n})`; val = Array.from({ length: n }, (_, i) => i + 1).reduce((a, b) => a * b, 1); }
      if (kind === "fib") { fn = "const f = (n) => (n < 2 ? n : f(n - 1) + f(n - 2));"; call = `f(${n + 3})`; const fib = (k: number): number => (k < 2 ? k : fib(k - 1) + fib(k - 2)); val = fib(n + 3); }
      if (kind === "sumDigits") { const big = r.int(10 ** n, 10 ** (n + 1) - 1); fn = "const f = (n) => (n < 10 ? n : (n % 10) + f(Math.floor(n / 10)));"; call = `f(${big})`; val = String(big).split("").reduce((s, d) => s + Number(d), 0); }
      if (kind === "pow") { const b = r.int(2, 4); fn = "const f = (b, e) => (e === 0 ? 1 : b * f(b, e - 1));"; call = `f(${b}, ${n})`; val = b ** n; }
      if (kind === "gcd") { const a = r.int(2, 12) * r.int(2, 9), b = r.int(2, 12) * r.int(2, 9); fn = "const f = (a, b) => (b === 0 ? a : f(b, a % b));"; call = `f(${a}, ${b})`; const g = (x: number, y: number): number => (y ? g(y, x % y) : x); val = g(a, b); }
      return { prompt: `What does \`${call}\` return?`, code: fn, correct: String(val), wrong: nearNums(r, val, 3, Math.max(1, Math.round(val / 10))).map(String), topic: "recursion",
        verify: { lang: "js", src: `${fn}\nconsole.log(${call});`, expect: String(val) } };
    },
  },
];
