import type { Family } from "../types";
import { IDENTS, NAMES, WORDS, nearNums, tier, variants } from "../kit";

const q = (s: string) => `'${s}'`;
const arr = (a: number[]) => `[${a.join(", ")}]`;

export const phpFamilies: Family[] = [
  {
    id: "php.arith", tags: ["php"], levels: [1, 20],
    make(r, level) {
      const t = tier(level), a = r.int(5, 20 + t * 20), b = r.int(2, 9), c = r.int(1, 8);
      const forms: [string, string][] = [
        [`${a} % ${b}`, String(a % b)], [`intdiv(${a}, ${b})`, String(Math.trunc(a / b))], [`${a} + ${b} * ${c}`, String(a + b * c)], [`${b} ** ${c}`, String(b ** c)],
        [`-${a} % ${b}`, String(-a % b === 0 ? 0 : -(a % b))], [`${a} <=> ${b}`, String(Math.sign(a - b))], [`max(${a}, ${b}, ${c}) - min(${a}, ${b}, ${c})`, String(Math.max(a, b, c) - Math.min(a, b, c))],
        [`${q(String(a))} . ${b}`, `${a}${b}`], [`${a} . ${b} + ${c}`, `${a}${b + c}`], [`abs(${c} - ${a})`, String(Math.abs(c - a))], [`floor(${a} / ${b})`, String(Math.floor(a / b))],
      ];
      const [e, v] = r.pick(t === 0 ? forms.slice(0, 6) : forms);
      const n = Number(v);
      return { prompt: `What does \`echo ${e};\` output in PHP 8?`, correct: v, wrong: nearNums(r, n).map(String).concat(["1", "0", "-1", `${a}${b}`]), topic: "operators",
        hint: "PHP 8: . and + have different precedence from PHP 7; use parentheses mentally.", verify: { lang: "php", src: `echo ${e};`, expect: v } };
    },
  },
  {
    id: "php.loose", tags: ["php"], levels: [4, 20],
    make(r, level) {
      const n = r.int(1, 99), w = r.pick(WORDS);
      const forms: [string, string][] = [
        [`${q(String(n))} == ${n}`, "true"], [`${q(String(n))} === ${n}`, "false"], [`${q(w)} == 0`, "false"], [`null == false`, "true"], [`[] == false`, "true"], [`${q("0")} == false`, "true"],
        [`${q(w)} == ${q(w.toUpperCase())}`, "false"], [`${q(String(n) + "abc")} == ${n}`, "false"], [`${q("1e3")} == ${q("1000")}`, "true"], [`${n} <=> ${n + 1}`, "-1"], [`empty(${q("0")})`, "true"], [`isset($zz)`, "false"],
        [`${q("")} ?: ${q(w)}`, w], [`null ?? ${q(w)}`, w], [`(int) ${q(String(n) + w)}`, String(n)],
      ];
      const [e, v] = r.pick(forms);
      const prompt = `What does \`var_dump(${e});\` print (PHP 8)?`;
      const fmt = (x: string) => (x === "true" || x === "false" ? `bool(${x})` : /^-?\d+$/.test(x) ? `int(${x})` : `string(${x.length}) "${x}"`);
      const correct = fmt(v);
      const pool = ["bool(true)", "bool(false)", "int(0)", "int(1)", "int(-1)", `string(${w.length}) "${w}"`, `int(${n})`, "NULL"];
      return { prompt, correct, wrong: pool.filter((x) => x !== correct), topic: "type juggling", verify: { lang: "php", src: `var_dump(${e});`, expect: correct } };
    },
  },
  {
    id: "php.array", tags: ["php"], levels: [3, 20],
    make(r, level) {
      const len = r.int(4, 5 + tier(level)), xs = Array.from({ length: len }, () => r.int(1, 9 + tier(level) * 8)), k = r.int(2, 4), cut = r.int(1, len - 2), A = arr(xs);
      const forms: [string, string][] = [
        [`array_sum(${A})`, String(xs.reduce((a, b) => a + b, 0))], [`count(array_filter(${A}, fn($x) => $x % ${k} === 0))`, String(xs.filter((x) => x % k === 0).length)],
        [`implode("-", array_map(fn($x) => $x * ${k}, ${A}))`, xs.map((x) => x * k).join("-")], [`implode(",", array_slice(${A}, ${cut}))`, xs.slice(cut).join(",")],
        [`max(${A}) - min(${A})`, String(Math.max(...xs) - Math.min(...xs))], [`array_search(${xs[cut]}, ${A})`, String(xs.indexOf(xs[cut]))], [`implode(",", array_reverse(${A}))`, [...xs].reverse().join(",")],
        [`count(array_unique(${A}))`, String(new Set(xs).size)], [`array_product(array_slice(${A}, 0, 2))`, String(xs[0] * xs[1])], [`array_key_last(${A})`, String(len - 1)],
        [`implode(",", array_keys(array_filter(${A}, fn($x) => $x > ${k * 3})))`, xs.map((x, i) => (x > k * 3 ? i : -1)).filter((i) => i >= 0).join(",")],
      ];
      const [e, v] = r.pick(level < 6 ? forms.slice(0, 5) : forms);
      const n = Number(v);
      const wr = Number.isFinite(n) && !v.includes(",") ? nearNums(r, n).map(String) : [xs.join(","), xs.slice(0, cut).join(","), [...xs].reverse().slice(1).join(","), xs.slice(cut + 1).join("-"), xs.map((x) => x + k).join("-"), ""];
      wr.push("Array", "false");
      return { prompt: `What does \`echo ${e};\` output?`, correct: v, wrong: wr.filter((x) => x !== v), topic: "arrays", verify: { lang: "php", src: `echo ${e};`, expect: v } };
    },
  },
  {
    id: "php.string", tags: ["php"], levels: [2, 20],
    make(r, level) {
      const w = r.pick(WORDS) + r.pick(WORDS), n = r.int(1, 3), k = r.int(n + 1, 6), ph = (s: string) => s;
      const forms: [string, string][] = [
        [`substr(${q(w)}, ${n}, ${k})`, w.substr(n, k)], [`substr(${q(w)}, -${k})`, w.slice(-k)], [`strtoupper(${q(w)}[${n}])`, w[n].toUpperCase()], [`strlen(${q(w)}) - ${n}`, String(w.length - n)],
        [`strpos(${q(w)}, ${q(w[k])})`, String(w.indexOf(w[k]))], [`ucfirst(${q(w)})`, w[0].toUpperCase() + w.slice(1)], [`strrev(${q(w.slice(0, k))})`, [...w.slice(0, k)].reverse().join("")],
        [`str_pad(${q(w.slice(0, n))}, ${k}, "*", STR_PAD_LEFT)`, w.slice(0, n).padStart(k, "*")], [`substr_count(${q(w)}, ${q(w[n])})`, String([...w].filter((c) => c === w[n]).length)],
        [`str_replace(${q(w[n])}, "_", ${q(w)})`, w.split(w[n]).join("_")], [`ucwords(${q(w.slice(0, 3) + " " + w.slice(3))})`, ph(w.slice(0, 3)[0].toUpperCase() + w.slice(1, 3) + " " + w[3].toUpperCase() + w.slice(4))],
        [`strcmp(${q(w)}, ${q(w)})`, "0"], [`str_word_count(${q(w.slice(0, 3) + " " + w.slice(3))})`, "2"], [`wordwrap(${q(w)}, ${k}, "|", true)`, w.match(new RegExp(`.{1,${k}}`, "g"))!.join("|")],
      ];
      const [e, v] = r.pick(level < 6 ? forms.slice(0, 6) : forms);
      const wr = new Set<string>(/^-?\d+$/.test(v) ? nearNums(r, Number(v)).map(String) : variants(v));
      wr.delete(v);
      return { prompt: `What does \`echo ${e};\` output?`, correct: v, wrong: [...wr], topic: "strings", verify: { lang: "php", src: `echo ${e};`, expect: v } };
    },
  },
  {
    id: "php.function", tags: ["php"], levels: [8, 20],
    make(r, level) {
      const a = r.int(1, 9), calls = r.int(2, 6), kind = r.pick(["static", "ref", "value", "default", "closure"] as const);
      let code = "", v = "", wr: string[] = [];
      if (kind === "static") { code = `function hit() {\n    static $n = ${a};\n    return ++$n;\n}\n${Array.from({ length: calls - 1 }, () => "hit();").join("\n")}\necho hit();`; v = String(a + calls); wr = [String(a + 1), String(a + calls - 1), String(a + calls + 1), String(calls)]; }
      if (kind === "ref") { code = `function add(&$x, $by) {\n    $x += $by;\n}\n$n = ${a};\n${Array.from({ length: calls }, (_, i) => `add($n, ${i + 1});`).join("\n")}\necho $n;`; const tot = a + (calls * (calls + 1)) / 2; v = String(tot); wr = nearNums(r, tot).map(String); }
      if (kind === "value") { code = `function add($x, $by) {\n    $x += $by;\n    return $x;\n}\n$n = ${a};\nadd($n, ${calls});\necho $n;`; v = String(a); wr = [String(a + calls), "0", "null", String(calls)]; }
      if (kind === "default") { code = `function area($w, $h = ${a}) {\n    return $w * $h;\n}\necho area(${calls}) + area(${calls}, ${calls});`; v = String(calls * a + calls * calls); wr = [String(calls * calls * 2), String(calls * a * 2), String(calls * a), String(calls * calls)]; }
      if (kind === "closure") { code = `$base = ${a};\n$f = function($x) use ($base) {\n    return $x + $base;\n};\n$base = ${a + 10};\necho $f(${calls});`; v = String(a + calls); wr = [String(a + 10 + calls), String(calls), String(a), "0"]; }
      return { prompt: `What does this PHP script output? (${kind} case, start ${a}, ${calls} calls)`, code, correct: v, wrong: [...new Set([...wr, ...nearNums(r, Number(v)).map(String)])].filter((x) => x !== v), topic: "functions", verify: { lang: "php", src: code, expect: v } };
    },
  },
];
