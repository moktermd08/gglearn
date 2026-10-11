import type { Family } from "../types";
import { IDENTS, NAMES, NOUNS, WORDS, nearNums, tier } from "../kit";

const BP = [["xs", 0], ["sm", 576], ["md", 768], ["lg", 992], ["xl", 1200], ["xxl", 1400]] as const;
const SPACE = [0, 0.25, 0.5, 1, 1.5, 3];

export const htmlFamilies: Family[] = [
  {
    id: "selector.count", tags: ["selector", "css", "html"], levels: [1, 20],
    make(r, level) {
      const n = r.int(5, 7 + tier(level) * 2), classes = ["a", "b", "c"], items = Array.from({ length: n }, () => ({ cls: classes.filter(() => r.chance(0.4)) }));
      const has = (i: number, c: string) => items[i]?.cls.includes(c) ?? false;
      const [x, y] = r.sample(classes, 2), k = r.int(2, 3), off = r.int(0, k - 1);
      const idx = [...Array(n).keys()];
      const forms: [string, number][] = [
        [`li.${x}`, idx.filter((i) => has(i, x)).length], [`li.${x}.${y}`, idx.filter((i) => has(i, x) && has(i, y)).length], [`li:not(.${x})`, idx.filter((i) => !has(i, x)).length],
        [`li:nth-child(${k}n+${off + 1 || 1})`, idx.filter((i) => (i + 1 - (off + 1 || 1)) % k === 0 && i + 1 >= (off + 1 || 1)).length], [`li:nth-child(odd)`, idx.filter((i) => i % 2 === 0).length],
        [`li.${x} + li`, idx.filter((i) => i > 0 && has(i - 1, x)).length], [`li.${x} ~ li`, idx.filter((i) => idx.slice(0, i).some((j) => has(j, x))).length],
        [`li:last-child.${x}, li:first-child.${x}`, [0, n - 1].filter((i, p, a) => a.indexOf(i) === p && has(i, x)).length], [`li:nth-last-child(2)`, 1],
        [`li.${x}:not(.${y})`, idx.filter((i) => has(i, x) && !has(i, y)).length], [`li:not(.${x}):not(.${y})`, idx.filter((i) => !has(i, x) && !has(i, y)).length],
        [`li:nth-child(-n+${k})`, Math.min(k, n)],
      ];
      const [sel, v] = r.pick(level < 6 ? forms.slice(0, 5) : forms);
      const code = `<ul>\n${items.map((it) => `  <li${it.cls.length ? ` class="${it.cls.join(" ")}"` : ""}>`).join("\n")}\n</ul>`;
      return { prompt: `How many elements does \`${sel}\` select in this list of ${n} items (classes: ${items.map((it) => it.cls.join("") || "-").join(" ")})?`, code, correct: String(v),
        wrong: nearNums(r, v).map(String).filter((s) => Number(s) >= 0), topic: "selectors", hint: "nth-child counts every sibling; + is the very next sibling, ~ is any later sibling." };
    },
  },
  {
    id: "html.table", tags: ["html"], levels: [4, 20],
    make(r, level) {
      const cols = r.int(3, 5), rows = r.int(3, 4 + tier(level)), cs = r.int(2, Math.min(3, cols)), rs = r.int(2, Math.min(3, rows));
      const cells = rows * cols;
      const code = `<table>\n  <tr><td colspan="${cs}">A</td>${"<td>·</td>".repeat(Math.max(0, cols - cs))}</tr>\n  <tr><td rowspan="${rs}">B</td>${"<td>·</td>".repeat(cols - 1)}</tr>\n  <!-- ${rs - 1} more row(s) follow, each with ${cols - 1} <td> -->\n</table>`;
      const ask = r.pick(["tdTags", "grid"] as const);
      const tdTags = 1 + (cols - cs) + 1 + (cols - 1) + (rs - 1) * (cols - 1);
      const v = ask === "tdTags" ? tdTags : cols;
      return { prompt: `The table above has ${cols} columns (colspan ${cs}, rowspan ${rs}). ${ask === "tdTags" ? "How many <td> elements are written in total?" : "How many grid columns does the table render with?"}`, code, correct: String(v),
        wrong: nearNums(r, v).map(String).concat([String(cells)]).filter((x) => x !== String(v)), topic: "tables" };
    },
  },
  {
    id: "html.form", tags: ["html"], levels: [3, 20],
    make(r, level) {
      const names = r.sample(IDENTS, 5), vals = names.map(() => r.pick(WORDS));
      type F = { html: string; sends: string | null };
      const fields: F[] = [
        { html: `<input name="${names[0]}" value="${vals[0]}">`, sends: `${names[0]}=${vals[0]}` },
        { html: `<input name="${names[1]}" value="${vals[1]}" disabled>`, sends: null },
        { html: `<input type="checkbox" name="${names[2]}" value="${vals[2]}"${r.chance(0.5) ? " checked" : ""}>`, sends: "?" },
        { html: `<input type="checkbox" name="${names[3]}" value="${vals[3]}" checked>`, sends: `${names[3]}=${vals[3]}` },
        { html: `<input value="${vals[4]}">`, sends: null },
        { html: `<input type="hidden" name="${names[4]}" value="${vals[4]}">`, sends: `${names[4]}=${vals[4]}` },
        { html: `<button name="go" value="1">Send</button>`, sends: null },
      ];
      fields[2].sends = fields[2].html.includes("checked") ? `${names[2]}=${vals[2]}` : null;
      const pick = r.sample(fields, r.int(4, 6));
      const body = pick.filter((f) => f.sends).map((f) => f.sends!).join("&");
      const v = String(pick.filter((f) => f.sends).length);
      const code = `<form method="get" action="/s">\n${pick.map((f) => `  ${f.html}`).join("\n")}\n</form>`;
      return { prompt: `The user clicks Submit (a button with no name). How many name=value pairs are in the query string? Fields: ${pick.map((f) => (f.html.match(/name="(\w+)"/) ?? [, "unnamed"])[1]).join(", ")}.`, code, correct: v,
        wrong: nearNums(r, Number(v)).map(String).filter((x) => Number(x) >= 0), topic: "forms", hint: "Disabled, unnamed and unchecked controls are not submitted.", verify: { lang: "check", ok: () => body.split("&").filter(Boolean).length === Number(v) } };
    },
  },
  {
    id: "html.list", tags: ["html"], levels: [2, 20],
    make(r, level) {
      const start = r.int(2, 20), n = r.int(4, 7), pos = r.int(2, n), rev = r.chance(0.4), type = r.pick(["1", "a", "A", "i", "I"] as const);
      const num = rev ? start - (pos - 1) : start + (pos - 1);
      const fmtRoman = (x: number) => ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx", "xxi", "xxii", "xxiii", "xxiv", "xxv", "xxvi"][x] ?? "";
      const show = (x: number) => (type === "1" ? String(x) : type === "a" ? String.fromCharCode(96 + x) : type === "A" ? String.fromCharCode(64 + x) : type === "i" ? fmtRoman(x) : fmtRoman(x).toUpperCase());
      if (num < 1 || num > 26) throw new Error("range");
      const code = `<ol type="${type}" start="${start}"${rev ? " reversed" : ""}>\n${Array.from({ length: n }, (_, i) => `  <li>${i + 1}</li>`).join("\n")}\n</ol>`;
      return { prompt: `Which marker does list item number ${pos} of ${n} get (start=${start}, type=${type}${rev ? ", reversed" : ""})?`, code, correct: show(num),
        wrong: [...new Set([num - 1, num + 1, num + 2, num - 2, start + pos, start - pos, pos].map((x) => (x >= 1 && x <= 26 ? show(x) : "")))].filter((x) => x && x !== show(num)), topic: "lists" };
    },
  },
  {
    id: "bootstrap.grid", tags: ["bootstrap"], levels: [3, 20],
    make(r, level) {
      const [bp, min] = r.pick(BP.slice(1, 5)), size = r.pick([3, 4, 6, 12]), vp = r.pick([480, 600, 800, 1000, 1250, 1500]);
      const base = r.pick([12, 6, 12]);
      const small = r.pick([12, 6]);
      const code = `<div class="row">\n  <div class="col-${small} col-${bp}-${size}">…</div>\n  ${"<div class=\"col-" + small + " col-" + bp + "-" + size + "\">…</div>\n  ".repeat(1)}</div>`;
      const eff = vp >= min ? size : small;
      const perRow = 12 / eff;
      return { prompt: `With Bootstrap 5's grid (breakpoints sm 576, md 768, lg 992, xl 1200, xxl 1400), how many of these \`col-${small} col-${bp}-${size}\` columns fit on one row at a ${vp}px-wide viewport?`, code,
        correct: String(perRow), wrong: nearNums(r, perRow).map(String).concat(["12", "6", "4", "3", "2", "1"]).filter((x) => x !== String(perRow) && Number(x) > 0), topic: "bootstrap grid", hint: "Breakpoint classes apply at that width and up (mobile first)." };
    },
  },
  {
    id: "bootstrap.spacing", tags: ["bootstrap"], levels: [1, 20],
    make(r, level) {
      const k = r.int(1, 5), side = r.pick([["p", "padding"], ["m", "margin"]] as const), dir = r.pick([["t", "top"], ["b", "bottom"], ["s", "left (start)"], ["e", "right (end)"], ["x", "left and right"], ["y", "top and bottom"]] as const);
      const px = SPACE[k] * 16, rem = SPACE[k];
      const root = r.pick([16, 16, 20]);
      const v = rem * root;
      return { prompt: `Bootstrap 5 spacing: with a ${root}px root font size, how many px does \`${side[0]}${dir[0]}-${k}\` add to the ${side[1]}-${dir[1]}? (Scale: 1=.25rem, 2=.5rem, 3=1rem, 4=1.5rem, 5=3rem)`, correct: `${v}px`,
        wrong: [...new Set([rem * 16 * 2, v / 2, (SPACE[k + 1] ?? 3.5) * root, SPACE[k - 1] * root, k * 4, k * 8])].map((x) => `${x}px`).filter((x) => x !== `${v}px`), topic: "bootstrap utilities" };
    },
  },
];
