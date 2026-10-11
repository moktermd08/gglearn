import type { Family } from "../types";
import { IDENTS, NAMES, NOUNS, WORDS, nearNums, tier, variants } from "../kit";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const frameworkFamilies: Family[] = [
  {
    id: "nextjs.route", tags: ["nextjs"], levels: [2, 20],
    make(r, level) {
      const a = r.pick(WORDS), b = r.pick(WORDS.filter((w) => w !== a)), c = r.pick(NOUNS), param = r.pick(IDENTS);
      const cases: [string, string][] = [
        [`app/${a}/page.tsx`, `/${a}`], [`app/${a}/[${param}]/page.tsx`, `/${a}/:${param}`], [`app/(${b})/${a}/page.tsx`, `/${a}`], [`app/${a}/[...${param}]/page.tsx`, `/${a}/* (catch-all)`],
        [`app/${a}/[[...${param}]]/page.tsx`, `/${a} and /${a}/* (optional catch-all)`], [`app/${a}/_${b}/page.tsx`, `Not routable (private folder)`], [`app/${a}/${b}/route.ts`, `/${a}/${b} (API route handler)`],
        [`app/${a}/${b}/layout.tsx`, `No URL: a layout alone creates no route`], [`app/${a}/@${b}/page.tsx`, `No URL segment: @${b} is a parallel route slot`], [`app/page.tsx`, `/`],
        [`pages/${a}/index.tsx`, `/${a} (Pages Router)`], [`pages/${a}/[${param}].tsx`, `/${a}/:${param} (Pages Router)`],
      ];
      const [file, v] = r.pick(level < 8 ? cases.slice(0, 5) : cases);
      return { prompt: `In Next.js, which URL does the file \`${file}\` serve?`, correct: v, wrong: cases.map((x) => x[1]).filter((x) => x !== v).slice(0, 6), topic: "file-based routing", hint: "Route groups (name) and slots @name add no URL segment; _folders are private." };
    },
  },
  {
    id: "react.state", tags: ["react"], levels: [3, 20],
    make(r, level) {
      const start = r.int(0, 9), step = r.int(1, 5), n = r.int(2, 4), fn = r.chance(0.5);
      const body = Array.from({ length: n }, () => (fn ? `setCount(c => c + ${step});` : `setCount(count + ${step});`)).join("\n  ");
      const v = fn ? start + n * step : start + step;
      const code = `const [count, setCount] = useState(${start});\n\nfunction onClick() {\n  ${body}\n}`;
      return { prompt: `The button calls onClick once. What is \`count\` on the next render? (${fn ? "functional updates" : "plain updates"}, ${n} calls, step ${step}, initial ${start})`, code, correct: String(v), wrong: nearNums(r, v, 3, step).map(String).concat([String(start)]).filter((x) => x !== String(v)),
        topic: "state updates", hint: "Plain setCount(count + 1) calls in one handler all read the same stale count; functional updates chain." };
    },
  },
  {
    id: "react.effect", tags: ["react"], levels: [6, 20],
    make(r, level) {
      const deps = r.pick(["none", "[]", "[a]", "[a, b]"] as const), seq = Array.from({ length: r.int(3, 5) }, () => r.pick(["a", "b", "c", "a", "b"]));
      let runs = 1; // mount
      for (const ch of seq) { if (deps === "none") runs++; else if (deps === "[a]" && ch === "a") runs++; else if (deps === "[a, b]" && (ch === "a" || ch === "b")) runs++; }
      const code = `useEffect(() => {\n  log();\n}${deps === "none" ? "" : `, ${deps}`});`;
      return { prompt: `The component mounts once, then re-renders ${seq.length} times. The state that changes on each re-render, in order: ${seq.join(", ")} (a, b and c are state values; only that one changes). How many times does log() run in total, counting the mount?`, code, correct: String(runs), wrong: nearNums(r, runs).map(String).filter((x) => Number(x) >= 1),
        topic: "useEffect", hint: "No array: every render. []: mount only. Listed deps: only when one of them changes." };
    },
  },
  {
    id: "vue.render", tags: ["vue"], levels: [3, 20],
    make(r, level) {
      const items = Array.from({ length: r.int(4, 7) }, () => ({ n: r.pick(WORDS), done: r.chance(0.5), qty: r.int(1, 5) }));
      const t = r.int(1, 3);
      const forms: [string, string, string][] = [
        [`<template v-for="i in items" :key="i.n">\n  <li v-if="i.done">{{ i.n }}</li>\n</template>`, "<li> elements in the DOM", String(items.filter((i) => i.done).length)],
        [`<li v-for="i in items" :key="i.n" v-show="!i.done">{{ i.n }}</li>`, "<li> elements in the DOM (including hidden ones)", String(items.length)],
        [`<li v-for="i in items" :key="i.n" v-show="!i.done">{{ i.n }}</li>`, "<li> elements visible on screen", String(items.filter((i) => !i.done).length)],
        [`<li v-for="i in items.filter(i => i.qty > ${t})" :key="i.n">{{ i.n }}</li>`, "<li> elements rendered", String(items.filter((i) => i.qty > t).length)],
        [`<template v-for="(i, idx) in items" :key="i.n">\n  <li v-if="idx % 2 === 0">{{ i.n }}</li>\n</template>`, "<li> elements rendered", String(Math.ceil(items.length / 2))],
      ];
      const [dir, what, v] = r.pick(level < 8 ? forms.slice(0, 4) : forms);
      const code = `const items = [\n${items.map((i) => `  { n: "${i.n}", done: ${i.done}, qty: ${i.qty} }`).join(",\n")}\n]\n\n${dir}`;
      return { prompt: `How many ${what}? (${items.length} items; ${items.filter((i) => i.done).length} done; quantities ${items.map((i) => i.qty).join(", ")}${dir.includes("qty >") ? `; threshold ${t}` : ""})`, code, correct: v, wrong: nearNums(r, Number(v)).map(String).concat([String(items.length)]).filter((x) => x !== v && Number(x) >= 0), topic: "template directives", hint: "v-show only toggles CSS display; v-if removes the element." };
    },
  },
  {
    id: "angular.pipe", tags: ["angular"], levels: [2, 20],
    make(r, level) {
      const w = r.pick(WORDS) + r.pick(WORDS), n = r.int(2, 5), price = r.int(1, 999) + 0.5, d = r.int(0, 3);
      const forms: [string, string][] = [
        [`{{ '${w}' | uppercase }}`, w.toUpperCase()], [`{{ '${w}' | slice:0:${n} }}`, w.slice(0, n)], [`{{ '${w}' | slice:${n} }}`, w.slice(n)], [`{{ '${w}' | titlecase }}`, cap(w)],
        [`{{ ${n} + ${d} * 2 }}`, String(n + d * 2)], [`{{ ${price} | number:'1.0-0' }}`, String(Math.round(price))], [`{{ [${[1, 2, 3, 4, 5].slice(0, n + 1).join(", ")}] | slice:1:3 }}`, [1, 2, 3, 4, 5].slice(0, n + 1).slice(1, 3).join(",")],
        [`{{ ${n} > ${d} ? '${w}' : 'no' }}`, n > d ? w : "no"], [`{{ '${w}'.length }}`, String(w.length)], [`{{ null ?? '${w.slice(0, 3)}' }}`, w.slice(0, 3)],
      ];
      const [t, v] = r.pick(level < 8 ? forms.slice(0, 5) : forms);
      const wr = /^-?\d+$/.test(v) ? nearNums(r, Number(v)).map(String) : v === "no" ? [w, w.slice(0, 3), "true", "false"] : [...variants(v), String(n)];
      return { prompt: `What text does the Angular template expression \`${t}\` render?`, correct: v, wrong: wr.filter((x) => x !== v && x !== ""), topic: "template expressions", hint: "slice end index is exclusive, like JavaScript's slice." };
    },
  },
  {
    id: "laravel.routes", tags: ["laravel"], levels: [4, 20],
    make(r, level) {
      const res = r.pick(NOUNS) + "s", only = r.shuffle(["index", "show", "store", "update", "destroy", "create", "edit"]).slice(0, r.int(2, 5)), all = ["index", "create", "store", "show", "edit", "update", "destroy"];
      const mode = r.pick(["only", "except", "api", "plain"] as const);
      let used = all, decl = `Route::resource('${res}', Ctl::class)`;
      if (mode === "only") { used = all.filter((x) => only.includes(x)); decl += `->only([${only.map((x) => `'${x}'`).join(", ")}])`; }
      if (mode === "except") { used = all.filter((x) => !only.includes(x)); decl += `->except([${only.map((x) => `'${x}'`).join(", ")}])`; }
      if (mode === "api") { used = all.filter((x) => x !== "create" && x !== "edit"); decl = `Route::apiResource('${res}', Ctl::class)`; }
      const ask = r.pick(["count", "name"] as const), act = r.pick(used);
      if (ask === "count") return { prompt: `How many routes does \`${decl};\` register?`, correct: String(used.length), wrong: nearNums(r, used.length).map(String).concat(["7", "5"]).filter((x) => x !== String(used.length) && Number(x) > 0), topic: "resource routes" };
      const verb: Record<string, string> = { index: "GET", create: "GET", store: "POST", show: "GET", edit: "GET", update: "PUT/PATCH", destroy: "DELETE" };
      const uri: Record<string, string> = { index: `/${res}`, create: `/${res}/create`, store: `/${res}`, show: `/${res}/{id}`, edit: `/${res}/{id}/edit`, update: `/${res}/{id}`, destroy: `/${res}/{id}` };
      const v = `${verb[act]} ${uri[act]}`;
      return { prompt: `\`${decl};\` is registered. Which verb and URI does the ${res}.${act} route use?`, correct: v, wrong: all.map((a) => `${verb[a]} ${uri[a]}`).filter((x) => x !== v), topic: "resource routes" };
    },
  },
  {
    id: "laravel.artisan", tags: ["laravel"], levels: [3, 20],
    make(r, level) {
      const m = cap(r.pick(NOUNS)), flags = r.shuffle(["-m", "-c", "-f", "-s", "-r", "-a"]).slice(0, r.int(0, 2));
      const files = new Set<string>([`app/Models/${m}.php`]);
      for (const f of flags) { if (f === "-m") files.add(`database/migrations/xxxx_create_${m.toLowerCase()}s_table.php`); if (f === "-c") files.add(`app/Http/Controllers/${m}Controller.php`); if (f === "-f") files.add(`database/factories/${m}Factory.php`); if (f === "-s") files.add(`database/seeders/${m}Seeder.php`); if (f === "-r") { files.add(`app/Http/Controllers/${m}Controller.php`); } if (f === "-a") { files.add(`database/migrations/xxxx_create_${m.toLowerCase()}s_table.php`); files.add(`database/factories/${m}Factory.php`); files.add(`database/seeders/${m}Seeder.php`); files.add(`app/Policies/${m}Policy.php`); files.add(`app/Http/Controllers/${m}Controller.php`); files.add(`app/Http/Requests/Store${m}Request.php`); files.add(`app/Http/Requests/Update${m}Request.php`); } }
      const v = files.size;
      return { prompt: `How many files does \`php artisan make:model ${m}${flags.length ? " " + flags.join(" ") : ""}\` create? (Flags: -m migration, -c controller, -f factory, -s seeder, -r resource controller, -a all of these plus policy and form requests; -c and -r share one controller file.)`, correct: String(v), wrong: nearNums(r, v).map(String).filter((x) => Number(x) > 0), topic: "artisan generators" };
    },
  },
  {
    id: "wordpress.hierarchy", tags: ["wordpress"], levels: [4, 20],
    make(r, level) {
      const slug = r.pick(WORDS), id = r.int(2, 300), type = r.pick(["post", "page", "category", "cpt"] as const), cpt = r.pick(["book", "event", "project"]);
      const chains: Record<string, string[]> = {
        post: [`single-post-${slug}.php`, "single-post.php", "single.php", "singular.php", "index.php"], page: [`page-${slug}.php`, `page-${id}.php`, "page.php", "singular.php", "index.php"],
        category: [`category-${slug}.php`, `category-${id}.php`, "category.php", "archive.php", "index.php"], cpt: [`single-${cpt}-${slug}.php`, `single-${cpt}.php`, "single.php", "singular.php", "index.php"],
      };
      const chain = chains[type], present = r.sample(chain.slice(0, -1), r.int(1, 3));
      const v = chain.find((c) => present.includes(c)) ?? "index.php";
      const what = { post: `a single blog post with slug "${slug}"`, page: `the page "${slug}" (ID ${id})`, category: `the category archive "${slug}" (ID ${id})`, cpt: `a single "${cpt}" custom post (slug "${slug}")` }[type];
      return { prompt: `A theme contains only these templates: index.php, ${present.join(", ")}. Which file renders ${what}?`, correct: v, wrong: chain.filter((c) => c !== v), topic: "template hierarchy", hint: "WordPress walks the hierarchy from most to least specific and uses the first file that exists." };
    },
  },
  {
    id: "docusaurus.url", tags: ["docusaurus"], levels: [3, 20],
    make(r, level) {
      const a = r.pick(WORDS), b = r.pick(WORDS.filter((w) => w !== a)), n = r.int(1, 12), pad = String(n).padStart(2, "0"), base = r.pick(["/", "/docs-site/"]), fm = r.pick(WORDS);
      const cases: [string, string][] = [
        [`docs/${pad}-${a}.md`, `${base}docs/${a}`], [`docs/${a}/${b}.md`, `${base}docs/${a}/${b}`], [`docs/${a}/index.md`, `${base}docs/${a}/`], [`docs/${a}/${a}.md`, `${base}docs/${a}/`], [`docs/${a}.md with front matter "slug: /${fm}"`, `${base}docs/${fm}`],
        [`docs/${a}.md with front matter "slug: /"`, `${base}docs/`], [`blog/2026-03-${pad}-${a}.md`, `${base}blog/2026/03/${pad}/${a}`], [`docs/${pad}-${a}/${pad}-${b}.mdx`, `${base}docs/${a}/${b}`], [`src/pages/${a}.js`, `${base}${a}`],
      ];
      const [file, v] = r.pick(level < 8 ? cases.slice(0, 5) : cases);
      return { prompt: `Docusaurus has baseUrl "${base}" and default settings. Which URL does \`${file}\` get?`, correct: v, wrong: cases.map((c) => c[1]).filter((x) => x !== v).slice(0, 6), topic: "routing and slugs", hint: "Number prefixes are stripped; index.md or a file named like its folder becomes the folder URL." };
    },
  },
  {
    id: "mongo.query", tags: ["mongo"], levels: [3, 20],
    make(r, level) {
      const docs = Array.from({ length: r.int(5, 7 + tier(level)) }, (_, i) => ({ _id: i + 1, name: r.pick(NAMES), age: r.int(18, 60), city: r.pick(["Leeds", "Hull", "York"]), tags: r.sample(["a", "b", "c", "d"], 2) }));
      const lo = r.int(25, 40), city = r.pick(["Leeds", "Hull", "York"]), tag = r.pick(["a", "b", "c"]);
      const forms: [string, number][] = [
        [`{ age: { $gt: ${lo} } }`, docs.filter((d) => d.age > lo).length], [`{ city: "${city}", age: { $lte: ${lo} } }`, docs.filter((d) => d.city === city && d.age <= lo).length],
        [`{ $or: [{ city: "${city}" }, { age: { $gte: ${lo + 10} } }] }`, docs.filter((d) => d.city === city || d.age >= lo + 10).length], [`{ tags: "${tag}" }`, docs.filter((d) => d.tags.includes(tag)).length],
        [`{ city: { $ne: "${city}" } }`, docs.filter((d) => d.city !== city).length], [`{ tags: { $all: ["a", "b"] } }`, docs.filter((d) => d.tags.includes("a") && d.tags.includes("b")).length],
        [`{ age: { $in: [${docs[0].age}, ${docs[1].age}] } }`, docs.filter((d) => d.age === docs[0].age || d.age === docs[1].age).length], [`{ $nor: [{ city: "${city}" }, { tags: "${tag}" }] }`, docs.filter((d) => d.city !== city && !d.tags.includes(tag)).length],
        [`{ age: { $gt: ${lo - 10}, $lt: ${lo + 10} } }`, docs.filter((d) => d.age > lo - 10 && d.age < lo + 10).length],
      ];
      const [f, v] = r.pick(level < 8 ? forms.slice(0, 4) : forms);
      const code = docs.map((d) => `{ _id: ${d._id}, name: "${d.name}", age: ${d.age}, city: "${d.city}", tags: [${d.tags.map((t) => `"${t}"`).join(", ")}] }`).join("\n");
      return { prompt: `The collection holds ${docs.length} documents (ages ${docs.map((d) => d.age).join(", ")}). How many does \`db.people.countDocuments(${f})\` return?`, code, correct: String(v), wrong: nearNums(r, v).map(String).concat([String(docs.length)]).filter((x) => x !== String(v) && Number(x) >= 0), topic: "query operators" };
    },
  },
];
