import type { Family } from "../types";
import { IDENTS, NAMES, WORDS, nearNums, tier } from "../kit";

const q = (s: string) => JSON.stringify(s);
const pyList = (a: (number | string)[]) => `[${a.map((x) => (typeof x === "string" ? q(x) : x)).join(", ")}]`;
const fdiv = (a: number, b: number) => Math.floor(a / b);
const mod = (a: number, b: number) => ((a % b) + b) % b;

export const pyFamilies: Family[] = [
  {
    id: "py.arith", tags: ["py"], levels: [1, 20],
    make(r, level) {
      const t = tier(level), a = r.int(5, 20 + t * 30), b = r.int(2, 9), c = r.int(1, 9);
      const forms: [string, string][] = [
        [`${a} // ${b}`, String(fdiv(a, b))], [`${a} % ${b}`, String(mod(a, b))], [`-${a} // ${b}`, String(fdiv(-a, b))], [`-${a} % ${b}`, String(mod(-a, b))],
        [`${b} ** ${c}`, String(b ** c)], [`${a} + ${b} * ${c}`, String(a + b * c)], [`divmod(${a}, ${b})`, `(${fdiv(a, b)}, ${mod(a, b)})`],
        [`round(${a}.5)`, String(Math.round(a + 0.5) % 2 === 0 ? Math.round(a + 0.5) : Math.round(a + 0.5) - 1)], [`${a} / ${b} == ${a} // ${b}`, a / b === fdiv(a, b) ? "True" : "False"],
        [`abs(${c} - ${a}) % ${b}`, String(Math.abs(c - a) % b)], [`int("${a}") + ${b}`, String(a + b)], [`"${a}" * ${Math.min(c, 3)}`, String(a).repeat(Math.min(c, 3))],
      ];
      const [e, v] = r.pick(t === 0 ? forms.slice(0, 7) : forms);
      const n = Number(v);
      const wrong = Number.isFinite(n) && !v.includes("(") ? nearNums(r, n).map(String) : [`(${fdiv(a, b) + 1}, ${mod(a, b)})`, `(${mod(a, b)}, ${fdiv(a, b)})`, `(${fdiv(a, b)}, ${mod(a, b) + 1})`, `${a / b}`];
      wrong.push("True", "False", "TypeError", String(a / b));
      return { prompt: `What does \`print(${e})\` output in Python 3?`, correct: v, wrong: wrong.filter((x) => x !== v), topic: "operators",
        hint: "// floors toward negative infinity; % takes the sign of the divisor.", verify: { lang: "py", src: `print(${e})`, expect: v } };
    },
  },
  {
    id: "py.slice", tags: ["py"], levels: [2, 20],
    make(r, level) {
      const s = r.pick(WORDS) + r.pick(WORDS).slice(0, 3), n = s.length, a = r.int(1, 3), b = r.int(a + 2, n - 1), st = r.int(2, 3);
      const L = Array.from({ length: n }, (_, i) => i + r.int(0, 2));
      const sl = (x: (string | number)[] | string, i?: number, j?: number, k = 1) => {
        const arr = Array.from(x as ArrayLike<string | number>), len = arr.length, out: (string | number)[] = [];
        const norm = (v: number | undefined, d: number) => (v === undefined ? d : v < 0 ? Math.max(0, len + v) : Math.min(len, v));
        if (k > 0) for (let p = norm(i, 0); p < norm(j, len); p += k) out.push(arr[p]);
        else for (let p = i === undefined ? len - 1 : i < 0 ? len + i : i; p > (j === undefined ? -1 : j < 0 ? len + j : j); p += k) out.push(arr[p]);
        return out;
      };
      const forms: [string, string][] = [
        [`${q(s)}[${a}:${b}]`, sl(s, a, b).join("")], [`${q(s)}[-${a}:]`, sl(s, -a).join("")], [`${q(s)}[::-1]`, sl(s, undefined, undefined, -1).join("")],
        [`${q(s)}[::${st}]`, sl(s, undefined, undefined, st).join("")], [`${q(s)}[:${a}] + ${q(s)}[-${a}:]`, sl(s, 0, a).join("") + sl(s, -a).join("")],
        [`${q(s)}[${a}:-${a}]`, sl(s, a, -a).join("")], [`len(${q(s)}[${a}:${b}:${st}])`, String(sl(s, a, b, st).length)],
        [`${pyList(L)}[${a}:${b}]`, pyList(sl(L, a, b))], [`${pyList(L)}[::-${st}]`, pyList(sl(L, undefined, undefined, -st))], [`${pyList(L)}[-${a}:]`, pyList(sl(L, -a))],
      ];
      const [e, v] = r.pick(level < 6 ? forms.slice(0, 4) : forms);
      const wr = new Set([s.slice(a, b + 1), s.slice(a - 1, b), s.slice(0, a), s.slice(a), [...s].reverse().join("").slice(1), s.slice(0, -a), String(b - a), String(b - a + 1)]);
      if (v.startsWith("[")) { wr.clear(); [pyList(sl(L, a, b + 1)), pyList(sl(L, a - 1, b)), pyList(sl(L, 0, a)), pyList(sl(L, a)), pyList(sl(L, undefined, undefined, -1)), pyList(sl(L, 0, b))].forEach((x) => wr.add(x)); }
      wr.delete(v);
      return { prompt: `What does \`print(${e})\` output?`, correct: v, wrong: [...wr], topic: "slicing", hint: "start is inclusive, stop is exclusive; a negative step walks backwards.",
        verify: { lang: "py", src: `print(${e})`, expect: v } };
    },
  },
  {
    id: "py.comprehension", tags: ["py"], levels: [4, 20],
    make(r, level) {
      const n = r.int(4, 9 + tier(level) * 2), k = r.int(2, 6), m = r.int(0, k - 1), add = r.int(1, 9);
      const nums = Array.from({ length: n }, (_, i) => i + 1);
      const forms: [string, string][] = [
        [`[x * ${k} for x in range(${n})]`, pyList(Array.from({ length: n }, (_, i) => i * k))], [`[x for x in range(${n}) if x % ${k} == ${m}]`, pyList(nums.map((x) => x - 1).filter((x) => x % k === m))],
        [`sum(x * x for x in range(${n}))`, String(nums.reduce((s, x) => s + (x - 1) ** 2, 0))], [`len([x for x in range(${n}) if x % ${k}])`, String(nums.map((x) => x - 1).filter((x) => x % k).length)],
        [`{x % ${k} for x in range(${n})}`, `{${[...new Set(Array.from({ length: n }, (_, i) => i % k))].join(", ")}}`], [`list(map(lambda x: x + ${add}, range(${k}, ${n})))`, pyList(Array.from({ length: Math.max(0, n - k) }, (_, i) => k + i + add))],
        [`[x + y for x in range(${k}) for y in range(${add})][-1]`, String(k - 1 + add - 1)], [`max([x * (${n} - x) for x in range(${n})])`, String(Math.max(...Array.from({ length: n }, (_, x) => x * (n - x))))],
        [`sorted({x % ${k} for x in range(${n})}, reverse=True)`, pyList([...new Set(Array.from({ length: n }, (_, i) => i % k))].sort((a, b) => b - a))],
      ];
      const [e, v] = r.pick(level < 8 ? forms.slice(0, 4) : forms);
      const base = Number(v);
      const wr = Number.isFinite(base) ? nearNums(r, base).map(String) : [];
      if (!Number.isFinite(base)) {
        const alt = (f: number) => pyList(Array.from({ length: n }, (_, i) => i * k + f));
        wr.push(alt(1), alt(-1), pyList(Array.from({ length: n - 1 }, (_, i) => i * k)), pyList(nums.map((x) => x * k)), pyList(nums.filter((x) => x % k === m)), `{${m}}`, `{${k}}`, pyList(nums.map((x) => x - 1)));
      }
      return { prompt: `What does \`print(${e})\` output?`, correct: v, wrong: wr.filter((x) => x !== v), topic: "comprehensions", verify: { lang: "py", src: `print(${e})`, expect: v } };
    },
  },
  {
    id: "py.dict", tags: ["py"], levels: [4, 20],
    make(r, level) {
      const keys = r.sample(WORDS, 3), vals = [r.int(1, 9), r.int(1, 9), r.int(1, 9)], d = `{${keys.map((k, i) => `${q(k)}: ${vals[i]}`).join(", ")}}`;
      const extra = r.pick(WORDS.filter((w) => !keys.includes(w))), n = r.int(2, 6);
      const forms: [string, string][] = [
        [`d = ${d}\nprint(d.get(${q(extra)}, ${n}))`, String(n)], [`d = ${d}\nd[${q(keys[0])}] += ${n}\nprint(d[${q(keys[0])}])`, String(vals[0] + n)],
        [`d = ${d}\nprint(len(d), ${q(keys[1])} in d, ${q(extra)} in d)`, `3 True False`], [`d = ${d}\nd.pop(${q(keys[2])})\nprint(sum(d.values()))`, String(vals[0] + vals[1])],
        [`d = ${d}\nd.setdefault(${q(extra)}, ${n})\nd.setdefault(${q(keys[0])}, ${n + 10})\nprint(sum(d.values()))`, String(vals[0] + vals[1] + vals[2] + n)],
        [`d = ${d}\nprint(max(d, key=d.get) == ${q(keys[vals.indexOf(Math.max(...vals))])})`, "True"],
        [`d = ${d}\nd.update({${q(keys[0])}: ${n}, ${q(extra)}: ${n}})\nprint(len(d), d[${q(keys[0])}])`, `4 ${n}`],
        [`d = ${d}\nprint(list(d)[-1])`, keys[2]], [`d = ${d}\ne = d\ne[${q(extra)}] = ${n}\nprint(len(d))`, "4"], [`d = ${d}\ne = dict(d)\ne[${q(extra)}] = ${n}\nprint(len(d))`, "3"],
        [`d = ${d}\nprint({v: k for k, v in d.items()}[${vals[0]}] in d)`, "True"],
      ];
      const [code, v] = r.pick(level < 8 ? forms.slice(0, 5) : forms);
      const wr = /^\d+$/.test(v) ? [...nearNums(r, Number(v)).map(String), "KeyError"] : v === "True" || v === "False" ? ["True", "False", "None", "KeyError"] : v.includes(" ") ? [`4 ${n}`, `3 ${n}`, "3 True True", "3 True False", "4 False", `${n} 3`, "3 False False"] : [keys[0], keys[1], keys[2], "None"];
      return { prompt: `What does this print? (dictionary keys: ${keys.join(", ")})`, code, correct: v, wrong: wr.filter((x) => x !== v), topic: "dictionaries", verify: { lang: "py", src: code, expect: v } };
    },
  },
  {
    id: "py.function", tags: ["py"], levels: [8, 20],
    make(r, level) {
      const nm = r.pick(IDENTS), a = r.int(1, 9), calls = r.int(2, 6), kind = r.pick(["mutable", "star", "default", "global"] as const);
      let code = "", val = "", wr: string[] = [];
      if (kind === "mutable") {
        code = `def add(x, bucket=[]):\n    bucket.append(x)\n    return len(bucket)\n\n${Array.from({ length: calls - 1 }, (_, i) => `add(${a + i})`).join("\n")}\nprint(add(${a}))`;
        val = String(calls); wr = [String(1), String(calls - 1), String(calls + 1), "None", "[]"];
      } else if (kind === "star") {
        const xs = Array.from({ length: calls + 1 }, () => r.int(1, 9));
        code = `def f(first, *rest, ${nm}=${a}):\n    return first + sum(rest) + ${nm}\n\nprint(f(${xs.join(", ")}))`;
        const total = xs.reduce((s, x) => s + x, 0) + a; val = String(total); wr = nearNums(r, total).map(String); wr.push(String(total - a), "TypeError");
      } else if (kind === "default") {
        code = `def scale(x, k=${a}):\n    return x * k\n\nk = ${a + 5}\nprint(scale(${calls}) + scale(${calls}, k))`;
        val = String(calls * a + calls * (a + 5)); wr = [String(calls * (a + 5) * 2), String(calls * a * 2), String(calls * (a + 5)), String(calls * a)];
      } else {
        code = `${nm} = ${a}\n\ndef bump():\n    ${nm} = ${nm} + ${calls}\n    return ${nm}\n\nprint(bump())`;
        val = "UnboundLocalError"; wr = [String(a + calls), String(a), "NameError", "None"];
      }
      const ok = kind === "global" ? { lang: "check" as const, ok: () => true } : { lang: "py" as const, src: code, expect: val };
      return { prompt: `What does this program print? (${kind} case, value ${a}, count ${calls}, name ${nm})`, code, correct: val, wrong: wr.filter((x) => x !== val), topic: "functions", verify: ok };
    },
  },
  {
    id: "py.sort", tags: ["py"], levels: [6, 20],
    make(r, level) {
      const n = r.int(4, 6), names = r.sample(NAMES, n), ages = names.map(() => r.int(18, 40));
      const rows = names.map((x, i) => [x, ages[i]] as [string, number]);
      const lit = `[${rows.map(([x, y]) => `(${q(x)}, ${y})`).join(", ")}]`;
      const stableKey = (a: [string, number], b: [string, number]) => a[1] - b[1];
      const forms: [string, string][] = [
        [`sorted(${lit}, key=lambda p: p[1])[0][0]`, [...rows].sort(stableKey)[0][0]], [`sorted(${lit}, key=lambda p: p[1], reverse=True)[0][0]`, [...rows].sort((a, b) => b[1] - a[1] || 0)[0][0]],
        [`sorted(${lit})[-1][0]`, [...rows].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]))[n - 1][0]], [`[p[0] for p in sorted(${lit}, key=lambda p: -p[1])][:2]`, `[${[...rows].sort((a, b) => b[1] - a[1]).slice(0, 2).map((p) => q(p[0]).replace(/"/g, "'")).join(", ")}]`],
        [`min(${lit}, key=lambda p: len(p[0]))[0]`, [...rows].reduce((m, p) => (p[0].length < m[0].length ? p : m))[0]], [`sum(p[1] for p in ${lit}) // len(${lit})`, String(fdiv(ages.reduce((s, x) => s + x, 0), n))],
      ];
      const [e, v] = r.pick(forms);
      const pool = [...names, String(Math.min(...ages)), String(Math.max(...ages)), `['${names[0]}', '${names[1]}']`, `['${names[1]}', '${names[0]}']`, String(ages[0])];
      return { prompt: `What does \`print(${e})\` output? (${n} entries, first is ${names[0]})`, correct: v, wrong: pool.filter((x) => x !== v), topic: "sorting", hint: "sorted() is stable: equal keys keep their original order.",
        verify: { lang: "py", src: `print(${e})`, expect: v } };
    },
  },
  {
    id: "py.exception", tags: ["py"], levels: [9, 20],
    make(r, level) {
      const L = r.sample(["A", "B", "C", "D", "E", "F"], 5), [t, ex, el, fi, af] = L, bad = r.chance(0.5), withElse = r.chance(0.6);
      const body = bad ? `1 / 0` : `1 / 1`;
      const code = `def run():\n    try:\n        print("${t}")\n        ${body}\n    except ZeroDivisionError:\n        print("${ex}")\n        return "x"\n${withElse ? `    else:\n        print("${el}")\n` : ""}    finally:\n        print("${fi}")\n    print("${af}")\n\nrun()`;
      const seq = bad ? [t, ex, fi] : [t, ...(withElse ? [el] : []), fi, af];
      const alt = [[t, ex, fi, af], [t, fi, ex], [t, ex, af], bad ? [t, ex] : [t, fi, af], [t, el, ex, fi]];
      return { prompt: `In what order are the letters printed? (letters ${L.join(" ")}; error raised: ${bad ? "yes" : "no"}; else block: ${withElse ? "yes" : "no"})`, code,
        correct: seq.join(", "), wrong: alt.map((a) => a.join(", ")), topic: "exceptions", hint: "finally always runs, even when except returns; else runs only when nothing was raised.",
        verify: { lang: "py", src: code, expect: seq.join("\n") } };
    },
  },
  {
    id: "py.generator", tags: ["py"], levels: [12, 20],
    make(r, level) {
      const n = r.int(3, 9), k = r.int(2, 7), take = r.int(1, n - 1);
      const forms: [string, string][] = [
        [`def gen(n):\n    for i in range(n):\n        yield i * ${k}\n\ng = gen(${n})\nnext(g)\nprint(sum(g))`, String(Array.from({ length: n }, (_, i) => i * k).slice(1).reduce((a, b) => a + b, 0))],
        [`def gen(n):\n    for i in range(n):\n        yield i * ${k}\n\ng = gen(${n})\nprint(sum(g) + sum(g))`, String(Array.from({ length: n }, (_, i) => i * k).reduce((a, b) => a + b, 0))],
        [`g = (x * ${k} for x in range(${n}))\nprint(next(g), next(g), len(list(g)))`, `0 ${k} ${n - 2}`],
        [`import itertools\nprint(list(itertools.islice((x for x in range(100) if x % ${k} == 0), ${take})))`, `[${Array.from({ length: take }, (_, i) => i * k).join(", ")}]`],
        [`def counter():\n    c = 0\n    while True:\n        c += ${k}\n        yield c\n\ng = counter()\nfor _ in range(${n}):\n    v = next(g)\nprint(v)`, String(k * n)],
      ];
      const [code, v] = r.pick(forms);
      const b = Number(v);
      const wr = Number.isFinite(b) ? nearNums(r, b, 3, k).map(String) : [v.replace(/\d+/, (m) => String(Number(m) + 1)), `[${take}]`, "[]", `0 ${k} ${n}`, `0 0 ${n}`];
      return { prompt: `What does this print? (n=${n}, step=${k}${forms.indexOf(forms.find((f) => f[0] === code)!) === 3 ? `, take=${take}` : ""})`, code, correct: v, wrong: wr.filter((x) => x !== v), topic: "generators",
        hint: "A generator is consumed as you iterate it; a second pass sees nothing.", verify: { lang: "py", src: code, expect: v } };
    },
  },
];
