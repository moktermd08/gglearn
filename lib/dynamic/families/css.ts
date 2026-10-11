import type { Family } from "../types";
import { WORDS, nearNums, tier } from "../kit";

const COLORS = ["red", "blue", "green", "orange", "purple", "teal", "black", "gold", "pink", "navy"];

type Sel = { text: string; spec: [number, number, number]; matches: (el: { tag: string; id: string; cls: string[]; parentTag: string }) => boolean };

export const cssFamilies: Family[] = [
  {
    id: "css.specificity", tags: ["css"], levels: [1, 20],
    make(r, level) {
      const [c1, c2, c3] = r.sample(["card", "note", "item", "lead", "tag", "box", "hero", "cell"], 3), id = r.pick(WORDS);
      const el = { tag: r.pick(["p", "span", "div", "li"]), id, cls: [c1, c2], parentTag: "section" };
      const pool: Sel[] = [
        { text: el.tag, spec: [0, 0, 1], matches: () => true }, { text: `.${c1}`, spec: [0, 1, 0], matches: () => true }, { text: `.${c2}`, spec: [0, 1, 0], matches: () => true },
        { text: `${el.tag}.${c1}`, spec: [0, 1, 1], matches: () => true }, { text: `.${c1}.${c2}`, spec: [0, 2, 0], matches: () => true }, { text: `#${id}`, spec: [1, 0, 0], matches: () => true },
        { text: `section ${el.tag}`, spec: [0, 0, 2], matches: () => true }, { text: `section .${c1}`, spec: [0, 1, 1], matches: () => true }, { text: `${el.tag}#${id}`, spec: [1, 0, 1], matches: () => true },
        { text: `[class~="${c2}"]`, spec: [0, 1, 0], matches: () => true }, { text: `section > ${el.tag}.${c1}.${c2}`, spec: [0, 2, 2], matches: () => true }, { text: `:not(.${c3})`, spec: [0, 1, 0], matches: () => true },
        { text: `.${c3}`, spec: [0, 1, 0], matches: () => false }, { text: `${el.tag}:first-child`, spec: [0, 1, 1], matches: () => r.chance(0.5) },
        { text: `:is(.${c1}, #${id})`, spec: [1, 0, 0], matches: () => true }, { text: `:where(.${c1})`, spec: [0, 0, 0], matches: () => true },
      ];
      const n = 3 + (level > 10 ? 1 : 0), picks = r.sample(pool.filter((p) => !p.text.includes("first-child")), n);
      const colors = r.sample(COLORS, n);
      const imp = level > 6 && r.chance(0.5) ? r.int(0, n - 1) : -1;
      let best = -1;
      const cmp = (i: number, j: number) => {
        if ((i === imp) !== (j === imp)) return i === imp ? 1 : -1;
        for (let k = 0; k < 3; k++) if (picks[i].spec[k] !== picks[j].spec[k]) return picks[i].spec[k] - picks[j].spec[k];
        return i - j;
      };
      for (let i = 0; i < n; i++) if (picks[i].matches(el) && (best < 0 || cmp(i, best) > 0)) best = i;
      const code = `<section>\n  <${el.tag} id="${id}" class="${c1} ${c2}">Hi</${el.tag}>\n</section>\n\n` + picks.map((p, i) => `${p.text} { color: ${colors[i]}${i === imp ? " !important" : ""}; }`).join("\n");
      const winner = colors[best];
      return { prompt: `Which colour does the ${el.tag}#${id} element get?`, code, correct: winner, wrong: COLORS.filter((c) => c !== winner), topic: "specificity and cascade",
        hint: "!important beats everything here; then compare ids, then classes/attributes/pseudo-classes, then elements; ties go to the later rule." };
    },
  },
  {
    id: "css.box", tags: ["css", "bootstrap"], levels: [2, 20],
    make(r, level) {
      const w = r.int(10, 40) * 10, p = r.int(1, 5) * 5, b = r.int(1, 4) * 2, m = r.int(1, 4) * 5, sizing = r.pick(["content-box", "border-box"] as const);
      const total = sizing === "content-box" ? w + 2 * p + 2 * b : w, content = sizing === "content-box" ? w : w - 2 * p - 2 * b, outer = total + 2 * m;
      const ask = r.pick(["total", "content", "outer"] as const);
      const val = ask === "total" ? total : ask === "content" ? content : outer;
      const label = { total: "border-box width (padding + border included) the box takes up", content: "content width", outer: "horizontal space the box occupies including its margin" }[ask];
      return { prompt: `With box-sizing: ${sizing}, width: ${w}px, padding: ${p}px, border: ${b}px solid and margin: ${m}px, what is the ${label}?`, correct: `${val}px`,
        wrong: [...new Set([total, content, outer, w + p + b, w + 2 * p, total - m, w + 2 * m, w - p - b, outer + m])].filter((x) => x !== val && x > 0).map((x) => `${x}px`), topic: "box model" };
    },
  },
  {
    id: "css.units", tags: ["css"], levels: [3, 20],
    make(r, level) {
      const root = r.pick([10, 12, 14, 16, 18, 20]), a = r.pick([0.5, 0.75, 1.25, 1.5, 2, 2.5]), b = r.pick([0.5, 0.8, 1.2, 1.5, 2]), pw = r.int(2, 8) * 100, pct = r.pick([10, 20, 25, 40, 50, 75]);
      const forms: [string, number][] = [
        [`the root font-size is ${root}px. What is the computed size of \`font-size: ${a}rem\` in px?`, root * a],
        [`html { font-size: ${root}px } .box { font-size: ${a}rem } .box p { font-size: ${b}em }. What is the computed font-size of the p inside .box?`, root * a * b],
        [`a parent has font-size ${root}px. A child sets \`padding: ${a}em\` on itself with font-size ${b}em. How many px of padding does it get?`, root * b * a],
        [`a parent is ${pw}px wide. How wide in px is a child with \`width: ${pct}%\` and box-sizing border-box, no padding?`, (pw * pct) / 100],
        [`the viewport is ${pw * 2}px wide. What is the width in px of an element with \`width: ${pct}vw\`?`, (pw * 2 * pct) / 100],
        [`html { font-size: ${root}px } .a { font-size: ${b}em } .a .b { margin-left: ${a}em; font-size: ${a}rem }. What is the margin-left of .b in px?`, root * a * a],
      ];
      const [text, v] = r.pick(level < 8 ? forms.slice(0, 4) : forms);
      const f = (x: number) => `${Math.round(x * 100) / 100}px`;
      return { prompt: `Assume ${text}`, correct: f(v), wrong: [...new Set([v * 2, v / 2, v * root, v + root, v - a, v * a, (v * b) / a, v + 4, v / root])].map(f).filter((x) => x !== f(v)), topic: "length units",
        hint: "rem uses the root size; em uses the element's own font-size (or the parent's when used on font-size)." };
    },
  },
  {
    id: "css.flex", tags: ["css"], levels: [6, 20],
    make(r, level) {
      const n = r.int(2, 4), W = r.int(9, 18) * 100, gap = r.pick([0, 10, 20]), basis = Array.from({ length: n }, () => r.int(1, 4) * 50), grow: number[] = Array.from({ length: n }, () => r.int(0, 3));
      if (!grow.some(Boolean)) grow[0] = 1;
      const free = W - basis.reduce((a, b) => a + b, 0) - gap * (n - 1);
      if (free < 0) throw new Error("negative free space");
      const tg = grow.reduce((a, b) => a + b, 0), i = r.int(0, n - 1);
      const width = basis[i] + (free * grow[i]) / tg;
      const code = `.row { display: flex; width: ${W}px; gap: ${gap}px; }\n` + basis.map((b, k) => `.i${k + 1} { flex: ${grow[k]} 0 ${b}px; }`).join("\n");
      const f = (x: number) => `${Math.round(x * 100) / 100}px`;
      return { prompt: `${n} flex items (flex-grow ${grow.join("/")}, flex-basis ${basis.join("/")}px) sit in a ${W}px row with gap ${gap}px. What is the final width of .i${i + 1}?`, code, correct: f(width),
        wrong: [...new Set([basis[i], basis[i] + free / n, (W * grow[i]) / tg, basis[i] + (free * grow[i]) / tg + gap, free * (grow[i] / tg), basis[i] + free])].map(f).filter((x) => x !== f(width)), topic: "flexbox",
        hint: "Free space = container − Σ bases − gaps, shared in proportion to flex-grow." };
    },
  },
  {
    id: "css.grid", tags: ["css", "bootstrap"], levels: [8, 20],
    make(r, level) {
      const W = r.int(6, 12) * 100, gap = r.pick([0, 10, 20, 24]), fixed = r.int(1, 3) * 50, a = r.int(1, 3), b = r.int(1, 3), cols = `${fixed}px ${a}fr ${b}fr`;
      const free = W - fixed - 2 * gap, fr = free / (a + b);
      const pick = r.pick(["first", "second", "third"] as const);
      const v = pick === "first" ? fixed : pick === "second" ? fr * a : fr * b;
      const f = (x: number) => `${Math.round(x * 100) / 100}px`;
      return { prompt: `A grid is ${W}px wide with column-gap ${gap}px and \`grid-template-columns: ${cols}\`. How wide is the ${pick} column?`, correct: f(v),
        wrong: [...new Set([fixed, fr * a, fr * b, (W * a) / (a + b), (W - fixed) / 2, fr, (W - fixed) * a / (a + b), W / 3])].map(f).filter((x) => x !== f(v)), topic: "css grid", hint: "fr units share what is left after fixed tracks and gaps." };
    },
  },
];
