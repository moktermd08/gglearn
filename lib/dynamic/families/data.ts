import type { Family } from "../types";
import { IDENTS, NAMES, NOUNS, WORDS, nearNums, tier } from "../kit";
import type { Rng } from "../rng";

const jq = JSON.stringify;

function randomValue(r: Rng, depth: number): unknown {
  const k = r.int(0, depth > 1 ? 3 : 5);
  if (k === 0) return r.int(0, 99);
  if (k === 1) return r.pick(WORDS);
  if (k === 2) return r.chance(0.5);
  if (k === 3) return r.chance(0.2) ? null : r.int(1, 9) / 2;
  if (k === 4) return Array.from({ length: r.int(2, 3) }, () => randomValue(r, depth + 1));
  const o: Record<string, unknown> = {};
  for (const key of r.sample(IDENTS, r.int(2, 3))) o[key] = randomValue(r, depth + 1);
  return o;
}

export const dataFamilies: Family[] = [
  {
    id: "json.valid", tags: ["json", "js"], levels: [1, 20],
    make(r, level) {
      const o = { [r.pick(IDENTS)]: r.int(1, 99), [r.pick(NOUNS)]: r.pick(WORDS), tags: [r.pick(WORDS), r.pick(WORDS)], on: r.chance(0.5) };
      let text = JSON.stringify(o, null, 2);
      const kinds = ["Valid JSON", "Trailing comma", "Single-quoted string", "Unquoted key", "Missing comma", "Comment", "undefined value", "Hex or leading-zero number"] as const;
      const kind = r.pick(level < 5 ? kinds.slice(0, 5) : kinds);
      const lines = text.split("\n"), body = lines.map((l, i) => i).filter((i) => i > 0 && i < lines.length - 1);
      const at = r.pick(body);
      if (kind === "Trailing comma") { const last = body[body.length - 1]; lines[last] = lines[last].replace(/,$/, "") + ","; }
      if (kind === "Single-quoted string") { const idx = body.find((i) => /: "/.test(lines[i])); if (idx === undefined) throw new Error("no string"); lines[idx] = lines[idx].replace(/: "([^"]*)"/, ": '$1'"); }
      if (kind === "Unquoted key") lines[at] = lines[at].replace(/"([a-zA-Z]+)":/, "$1:");
      if (kind === "Missing comma") { const idx = body.find((i, p) => lines[i].endsWith(",") && p < body.length - 1); if (idx === undefined) throw new Error("no comma"); lines[idx] = lines[idx].slice(0, -1); }
      if (kind === "Comment") lines.splice(at, 0, "  // note");
      if (kind === "undefined value") { const idx = body.find((i) => /: \d+/.test(lines[i])); if (idx === undefined) throw new Error("no num"); lines[idx] = lines[idx].replace(/: \d+/, ": undefined"); }
      if (kind === "Hex or leading-zero number") { const idx = body.find((i) => /: \d+/.test(lines[i])); if (idx === undefined) throw new Error("no num"); lines[idx] = lines[idx].replace(/: (\d+)/, ": 0x$1"); }
      text = lines.join("\n");
      let valid = true;
      try { JSON.parse(text); } catch { valid = false; }
      if (valid !== (kind === "Valid JSON")) throw new Error("injection did not change validity");
      return { prompt: `Is this JSON text valid, and if not, what is wrong with it? (${Object.keys(o).join(", ")})`, code: text, correct: kind, wrong: kinds.filter((k) => k !== kind),
        topic: "JSON syntax", hint: "JSON allows only double-quoted strings and keys, no comments, no trailing commas, and no undefined.",
        verify: { lang: "js", src: `try { JSON.parse(${jq(text)}); console.log("valid"); } catch { console.log("invalid"); }`, expect: kind === "Valid JSON" ? "valid" : "invalid" } };
    },
  },
  {
    id: "json.path", tags: ["json", "js", "mongo"], levels: [2, 20],
    make(r, level) {
      const t = tier(level), users = Array.from({ length: r.int(2, 3 + t) }, () => ({ name: r.pick(NAMES), age: r.int(18, 70), tags: r.sample(WORDS, 3), address: { city: r.pick(WORDS), zip: r.int(1000, 9999) } }));
      const data = { [r.pick(NOUNS)]: "x", users, meta: { total: users.length, page: r.int(1, 9) } };
      const i = r.int(0, users.length - 1), j = r.int(0, 2);
      const forms: [string, string][] = [
        [`data.users[${i}].name`, users[i].name], [`data.users[${i}].tags[${j}]`, users[i].tags[j]], [`data.users[${i}].address.city`, users[i].address.city],
        [`data.users.length`, String(users.length)], [`data.meta.total + data.meta.page`, String(users.length + data.meta.page)], [`data.users[${i}].age + data.users[${(i + 1) % users.length}].age`, String(users[i].age + users[(i + 1) % users.length].age)],
        [`data.users.map(u => u.address.zip)[${i}]`, String(users[i].address.zip)], [`data.users.filter(u => u.age > 40).length`, String(users.filter((u) => u.age > 40).length)],
        [`data.users.find(u => u.tags.includes("${users[i].tags[j]}")).name`, users.find((u) => u.tags.includes(users[i].tags[j]))!.name], [`Object.keys(data.users[${i}]).length`, "4"],
        [`data.users[${users.length}]?.name ?? "none"`, "none"], [`JSON.stringify(data.users[${i}].tags)`, jq(users[i].tags)],
      ];
      const [e, v] = r.pick(level < 6 ? forms.slice(0, 5) : forms);
      const n = Number(v);
      const pool = Number.isFinite(n) ? nearNums(r, n).map(String) : [...users.map((u) => u.name), ...users[i].tags, users[i].address.city, "undefined", "none"];
      return { prompt: `Given the object below (users: ${users.map((u) => `${u.name} ${u.age}`).join(", ")}; page ${data.meta.page}), what does \`${e}\` evaluate to?`, code: `const data = ${JSON.stringify(data, null, 2)};`, correct: v, wrong: pool.filter((x) => x !== v), topic: "JSON navigation",
        verify: { lang: "js", src: `const data = ${JSON.stringify(data)};\nconst x = ${e};\nconsole.log(typeof x === "string" ? x : String(x));`, expect: v } };
    },
  },
  {
    id: "json.stringify", tags: ["json", "js"], levels: [5, 20],
    make(r, level) {
      const a = r.pick(IDENTS), b = r.pick(NOUNS), v1 = r.int(1, 9), w = r.pick(WORDS);
      const forms: [string, string][] = [
        [`{ ${a}: ${v1}, ${b}: undefined }`, `{"${a}":${v1}}`], [`[${v1}, undefined, ${v1 + 1}]`, `[${v1},null,${v1 + 1}]`], [`{ ${a}: () => ${v1}, ${b}: "${w}" }`, `{"${b}":"${w}"}`],
        [`{ ${a}: NaN, ${b}: Infinity }`, `{"${a}":null,"${b}":null}`], [`{ ${a}: new Date(0) }`, `{"${a}":"1970-01-01T00:00:00.000Z"}`], [`{ ${a}: [${v1}, { ${b}: null }] }`, `{"${a}":[${v1},{"${b}":null}]}`],
        [`{ ${a}: "${w}", ${b}: ${v1} }, ["${b}"]`, `{"${b}":${v1}}`], [`{ ${a}: ${v1}, toJSON() { return ${v1 + 1}; } }`, String(v1 + 1)], [`"${w}"`, `"${w}"`], [`{ ${v1}: "${w}", ${v1 + 1}: ${v1} }`, `{"${v1}":"${w}","${v1 + 1}":${v1}}`],
        [`new Set([${v1}])`, "{}"], [`{ ${a}: Symbol("s") }`, "{}"],
      ];
      const [e, v] = r.pick(level < 8 ? forms.slice(0, 5) : forms);
      const wr = [v.replace(/null/g, "undefined"), v.replace(/"/g, "'"), "{}", "null", `{"${a}":${v1},"${b}":null}`, `[${v1}]`, `{"${a}":${v1}}`, v + ","];
      return { prompt: `What does \`console.log(JSON.stringify(${e}))\` print?`, correct: v, wrong: wr.filter((x) => x !== v), topic: "JSON.stringify",
        hint: "undefined, functions and symbols are dropped from objects and become null in arrays; NaN and Infinity become null.",
        verify: { lang: "js", src: `console.log(JSON.stringify(${e}))`, expect: v } };
    },
  },
  {
    id: "xml.wellformed", tags: ["xml"], levels: [1, 20],
    make(r, level) {
      const root = r.pick(NOUNS), kid = r.pick(IDENTS), n = r.int(2, 3 + tier(level));
      const items = Array.from({ length: n }, (_, i) => `  <${kid} id="${i + 1}">${r.pick(WORDS)}</${kid}>`);
      const kinds = ["Well-formed", "Unclosed tag", "Mismatched tags", "Unquoted attribute", "Unescaped ampersand", "Two root elements", "Duplicate attribute", "Wrong case in end tag"] as const;
      const kind = r.pick(level < 5 ? kinds.slice(0, 5) : kinds);
      const at = r.int(0, n - 1);
      let doc = "";
      if (kind === "Unclosed tag") items[at] = `  <${kid} id="${at + 1}">${r.pick(WORDS)}`;
      if (kind === "Mismatched tags") items[at] = items[at].replace(`</${kid}>`, `</${root}>`);
      if (kind === "Unquoted attribute") items[at] = items[at].replace(/id="(\d+)"/, "id=$1");
      if (kind === "Unescaped ampersand") items[at] = items[at].replace(/>(\w+)</, ">$1 & co<");
      if (kind === "Duplicate attribute") items[at] = items[at].replace(`id="${at + 1}"`, `id="${at + 1}" id="9"`);
      if (kind === "Wrong case in end tag") items[at] = items[at].replace(`</${kid}>`, `</${kid.toUpperCase()}>`);
      doc = `<${root}>\n${items.join("\n")}\n</${root}>` + (kind === "Two root elements" ? `\n<${root}/>` : "");
      const py = `import xml.etree.ElementTree as E\ntry:\n    E.fromstring(${JSON.stringify(doc)})\n    print("ok")\nexcept Exception:\n    print("bad")`;
      return { prompt: `What is wrong with this XML document (root <${root}>, ${n} <${kid}> children)? Choose the best description.`, code: doc, correct: kind, wrong: kinds.filter((k) => k !== kind), topic: "XML well-formedness",
        hint: "Well-formed XML needs one root, matching case-sensitive end tags, quoted unique attributes and escaped & and <.", verify: { lang: "py", src: py, expect: kind === "Well-formed" ? "ok" : "bad" } };
    },
  },
  {
    id: "xml.query", tags: ["xml"], levels: [4, 20],
    make(r, level) {
      const root = r.pick(NOUNS) + "s", kid = r.pick(NOUNS), n = r.int(4, 6 + tier(level));
      const rows = Array.from({ length: n }, (_, i) => ({ id: i + 1, type: r.pick(["a", "b", "c"]), price: r.int(1, 9) * 10, tag: r.pick(WORDS) }));
      const xml = `<${root}>\n${rows.map((x) => `  <${kid} id="${x.id}" type="${x.type}"><price>${x.price}</price><tag>${x.tag}</tag></${kid}>`).join("\n")}\n</${root}>`;
      const t = r.pick(["a", "b", "c"]), k = r.int(1, n);
      const forms: [string, string, string][] = [
        [`count(//${kid}[@type='${t}'])`, String(rows.filter((x) => x.type === t).length), `.//${kid}[@type='${t}']|count`],
        [`//${kid}[@id='${k}']/price/text()`, String(rows[k - 1].price), `.//${kid}[@id='${k}']/price|text`],
        [`//${kid}[${k}]/tag/text()`, rows[k - 1].tag, `.//${kid}[${k}]/tag|text`],
        [`count(/${root}/${kid})`, String(n), `./${kid}|count`],
        [`//${kid}[last()]/@id`, String(n), `.//${kid}[last()]|attr:id`],
        [`count(//${kid}[price > ${k * 10}])`, String(rows.filter((x) => x.price > k * 10).length), "custom"],
      ];
      const [xp, v, ep] = r.pick(level < 8 ? forms.slice(0, 4) : forms.slice(0, 5));
      const [path, mode] = ep.split("|");
      const py = `import xml.etree.ElementTree as E\nroot = E.fromstring(${JSON.stringify(xml)})\nm = root.findall(${JSON.stringify(path)})\n` +
        (mode === "count" ? "print(len(m))" : mode === "text" ? "print(m[0].text)" : `print(m[0].get("id"))`);
      const n2 = Number(v);
      const wr = Number.isFinite(n2) ? nearNums(r, n2).map(String).filter((x) => Number(x) >= 0) : [...new Set(rows.map((x) => x.tag))];
      return { prompt: `What does the XPath \`${xp}\` return for this document (${n} <${kid}> elements)?`, code: xml, correct: v, wrong: wr.filter((x) => x !== v), topic: "XPath", hint: "XPath positions start at 1, not 0.",
        verify: { lang: "py", src: py, expect: v } };
    },
  },
];
