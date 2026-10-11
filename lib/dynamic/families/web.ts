import type { Family } from "../types";
import { IDENTS, NAMES, NOUNS, WORDS, nearNums, tier } from "../kit";

const STATUS: [string, number][] = [
  ["creates a new {n} successfully and returns it", 201], ["reads an existing {n}", 200], ["deletes the {n} and returns no body", 204], ["asks for a {n} that does not exist", 404],
  ["sends a {n} body that fails validation", 422], ["sends malformed JSON for a {n}", 400], ["calls the {n} endpoint without credentials", 401], ["is signed in but not allowed to change this {n}", 403],
  ["tries to create a {n} that already exists with the same unique key", 409], ["uses a method the {n} endpoint does not support", 405], ["has exceeded its rate limit while listing {n}s", 429],
  ["asks for a {n} that moved permanently to a new URL", 301], ["sends a conditional GET and the {n} has not changed (ETag matches)", 304], ["triggers a server crash while reading a {n}", 500],
  ["asks an upstream-dependent {n} endpoint while the gateway gets an invalid reply", 502], ["calls the {n} endpoint while the service is down for maintenance", 503],
  ["submits a {n} for background processing that is not finished yet", 202], ["sends a {n} larger than the server allows", 413], ["asks for a {n} in a format the server cannot produce (Accept header)", 406],
  ["has a gone-for-good {n} that was deleted and will never return", 410],
];
const REASON: Record<number, string> = { 200: "OK", 201: "Created", 202: "Accepted", 204: "No Content", 301: "Moved Permanently", 304: "Not Modified", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 406: "Not Acceptable", 409: "Conflict", 410: "Gone", 413: "Content Too Large", 422: "Unprocessable Content", 429: "Too Many Requests", 500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable" };

export const webFamilies: Family[] = [
  {
    id: "rest.status", tags: ["rest"], levels: [1, 20],
    make(r, level) {
      const [text, code] = r.pick(STATUS), n = r.pick(NOUNS), who = r.pick(["A client", "A mobile app", "A script", "A browser"]);
      const near = Object.keys(REASON).map(Number).filter((c) => c !== code && Math.floor(c / 100) === Math.floor(code / 100)).concat([200, 400, 404, 500, 401]);
      const wrong = [...new Set(near)].filter((c) => c !== code);
      const withReason = level > 8;
      const f = (c: number) => (withReason ? `${c} ${REASON[c]}` : String(c));
      return { prompt: `${who} ${text.replace(/\{n\}/g, n)}. Which HTTP status ${withReason ? "line" : "code"} should the ${n} API respond with?`, correct: f(code), wrong: r.shuffle(wrong).map(f), topic: "HTTP status codes" };
    },
  },
  {
    id: "rest.paginate", tags: ["rest"], levels: [3, 20],
    make(r, level) {
      const total = r.int(20, 500), per = r.pick([10, 20, 25, 50]), page = r.int(1, Math.ceil(total / per)), ask = r.pick(["offset", "pages", "last", "remaining"] as const);
      const pages = Math.ceil(total / per), last = total - (pages - 1) * per, offset = (page - 1) * per, remaining = Math.max(0, total - page * per);
      const v = ask === "offset" ? offset : ask === "pages" ? pages : ask === "last" ? last : remaining;
      const q = { offset: `the SQL OFFSET for GET /items?page=${page}&per_page=${per} (pages start at 1)`, pages: `the total number of pages for ${total} items at ${per} per page`, last: `the number of items on the last page for ${total} items at ${per} per page`, remaining: `the number of items still after page ${page} when there are ${total} items at ${per} per page` }[ask];
      return { prompt: `What is ${q}?`, correct: String(v), wrong: nearNums(r, v, 3, ask === "offset" || ask === "remaining" ? per : 1).map(String).concat([String(Math.floor(total / per)), String(page * per)]).filter((x) => x !== String(v) && Number(x) >= 0), topic: "pagination" };
    },
  },
  {
    id: "rest.url", tags: ["rest", "js"], levels: [2, 20],
    make(r, level) {
      const host = `${r.pick(WORDS)}.example.com`, id = r.int(1, 9999), res = r.pick(NOUNS) + "s", q1 = r.pick(IDENTS), q2 = r.pick(IDENTS.filter((x) => x !== q1)), v1 = r.pick(WORDS), v2 = r.int(1, 50);
      const url = `https://${host}:${r.pick([8443, 3000, 8080])}/v${r.int(1, 3)}/${res}/${id}/${r.pick(["items", "comments", "history"])}?${q1}=${v1}&${q2}=${v2}#top`;
      const u = new URL(url), seg = u.pathname.split("/").filter(Boolean);
      const forms: [string, string, string][] = [
        [`its query parameter "${q2}"`, String(v2), `u.searchParams.get(${JSON.stringify(q2)})`], [`its path segment number 3 (counting from 1)`, seg[2], `u.pathname.split("/").filter(Boolean)[2]`],
        [`its port`, u.port, `u.port`], [`its hash`, "#top", `u.hash`], [`its hostname`, host, `u.hostname`], [`the number of path segments`, String(seg.length), `u.pathname.split("/").filter(Boolean).length`],
        [`the number of query parameters`, "2", `[...u.searchParams].length`], [`its protocol`, "https:", `u.protocol`], [`its last path segment`, seg[seg.length - 1], `seg`],
      ];
      const [what, v, ex] = r.pick(level < 8 ? forms.slice(0, 5) : forms.slice(0, 8));
      const wr = /^\d+$/.test(v) ? (what.includes("port") ? ["80", "443", "8080", "3000", "8443", "5000"] : nearNums(r, Number(v)).map(String)) : [seg[0], seg[1], seg[2], seg[3], String(v1), host, "#", "https", "https:", "http:", "#top", "top"];
      return { prompt: `For the URL ${url}, what is ${what}?`, correct: v, wrong: wr.filter((x) => x !== v), topic: "URL anatomy", verify: { lang: "js", src: `const u=new URL(${JSON.stringify(url)});const seg=u.pathname.split("/").filter(Boolean);console.log(${ex})`, expect: v } };
    },
  },
  {
    id: "rest.cache", tags: ["rest"], levels: [6, 20],
    make(r, level) {
      const maxAge = r.pick([60, 120, 300, 600, 3600]), age = r.int(0, maxAge - 10), later = r.int(5, maxAge), ask = r.pick(["remaining", "fresh"] as const), stale = r.pick([0, 30, 60]);
      if (ask === "remaining") { const v = maxAge - age; return { prompt: `A cached response arrived with Cache-Control: max-age=${maxAge} and Age: ${age}. For how many more seconds may a shared cache serve it without revalidating?`, correct: String(v), wrong: nearNums(r, v, 3, 10).map(String).concat([String(maxAge), String(age)]).filter((x) => x !== String(v) && Number(x) >= 0), topic: "HTTP caching" }; }
      const total = age + later, fresh = total < maxAge;
      const labels = ["Fresh: served from cache without contacting the origin", "Stale: must be revalidated or refetched", "Stale but may be served while revalidating in the background"] as const;
      const withSwr = stale > 0 && !fresh;
      const ok = fresh ? labels[0] : withSwr && total < maxAge + stale ? labels[2] : labels[1];
      return { prompt: `A response has Cache-Control: max-age=${maxAge}${stale ? `, stale-while-revalidate=${stale}` : ""} and was ${age}s old when stored. A client asks ${later}s later. What happens?`, correct: ok, wrong: [...labels.filter((x) => x !== ok), "Never cacheable: max-age is ignored for shared caches", "Fresh, but only inside the browser's private cache"], topic: "HTTP caching" };
    },
  },
  {
    id: "rest.method", tags: ["rest"], levels: [2, 20],
    make(r, level) {
      const n = r.pick(NOUNS), calls = r.int(2, 4);
      const rows: [string, string][] = [
        [`PUT /${n}s/7 with the same body ${calls} times`, `One ${n} (id 7) with that state: PUT is idempotent`], [`POST /${n}s with the same body ${calls} times`, `${calls} separate ${n}s may be created: POST is not idempotent`],
        [`DELETE /${n}s/7 ${calls} times`, `The first call removes it; the state afterwards is the same (idempotent), later calls typically return 404`], [`GET /${n}s/7 ${calls} times`, `No change on the server: GET is safe and idempotent`],
        [`PATCH /${n}s/7 with {"count": {"$inc": 1}} semantics ${calls} times`, `The count may increase ${calls} times: this PATCH is not idempotent`], [`HEAD /${n}s/7 ${calls} times`, `No change and no body returned: HEAD is safe and idempotent`],
      ];
      const [what, ok] = r.pick(rows);
      return { prompt: `What is the effect of ${what}?`, correct: ok, wrong: rows.map((x) => x[1]).filter((x) => x !== ok).slice(0, 5), topic: "HTTP methods", hint: "Safe methods don't change state; idempotent methods give the same end state when repeated." };
    },
  },
  {
    id: "apache.rewrite", tags: ["apache"], levels: [4, 20],
    make(r, level) {
      const a = r.pick(WORDS), b = r.pick(WORDS.filter((w) => w !== a)), id = r.int(1, 999), slug = r.pick(WORDS);
      const rules: [string, string, string][] = [
        [`RewriteRule ^${a}/(\\d+)$ /${b}.php?id=$1 [L]`, `/${a}/${id}`, `/${b}.php?id=${id}`], [`RewriteRule ^${a}/([a-z]+)/?$ /${b}/$1 [R=301,L]`, `/${a}/${slug}/`, `/${b}/${slug} (301 redirect)`],
        [`RewriteRule ^${a}$ /${b} [R=302,L]`, `/${a}`, `/${b} (302 redirect)`], [`RewriteRule ^${a}/(.*)$ /${b}/$1`, `/${a}/${slug}/${id}`, `/${b}/${slug}/${id}`],
        [`RewriteRule ^(.*)\\.html$ /$1.php [L]`, `/${a}/${slug}.html`, `/${a}/${slug}.php`], [`RewriteRule ^${a}/(\\d+)/(\\w+)$ /${b}/$2/$1`, `/${a}/${id}/${slug}`, `/${b}/${slug}/${id}`],
      ];
      const [rule, req, out] = r.pick(rules);
      const wr = [`/${b}.php?id=${id}`, `/${b}/${slug}`, `/${a}/${slug}`, `/${b}/${id}`, `${req} (unchanged, no match)`, `/${a}.php`, `/${b}/${slug}/${id}`, `/${b}/${id}/${slug}`];
      return { prompt: `An .htaccess contains \`${rule}\` (RewriteEngine On). What happens to a request for ${req}?`, correct: out, wrong: wr.filter((x) => x !== out), topic: "mod_rewrite", hint: "$1, $2 are the captured groups; R flags send a redirect to the browser." };
    },
  },
  {
    id: "apache.log", tags: ["apache"], levels: [2, 20],
    make(r, level) {
      const ip = `${r.int(11, 200)}.${r.int(0, 255)}.${r.int(0, 255)}.${r.int(1, 254)}`, user = r.pick(["-", r.pick(NAMES).toLowerCase()]), path = `/${r.pick(WORDS)}/${r.pick(WORDS)}.html`, status = r.pick([200, 301, 304, 403, 404, 500]), bytes = status === 304 ? "-" : String(r.int(120, 99999));
      const method = r.pick(["GET", "POST", "HEAD"]);
      const line = `${ip} - ${user} [10/Oct/2026:13:55:36 +0000] "${method} ${path} HTTP/1.1" ${status} ${bytes}`;
      const forms: [string, string][] = [["client IP address (%h)", ip], ["authenticated user (%u)", user], ["request path", path], ["status code (%>s)", String(status)], ["response size in bytes (%b)", bytes], ["HTTP method", method]];
      const [what, v] = r.pick(forms);
      const wr = [ip, user, path, String(status), bytes, method, "HTTP/1.1", "+0000", "10/Oct/2026", "-"];
      return { prompt: `In the Common Log Format line ${line} what is the ${what}?`, correct: v, wrong: wr.filter((x) => x !== v), topic: "access logs" };
    },
  },
  {
    id: "express.route", tags: ["express"], levels: [3, 20],
    make(r, level) {
      const a = r.pick(WORDS), b = r.pick(WORDS.filter((w) => w !== a)), id = r.int(1, 99);
      const routes = r.shuffle([`app.get("/${a}/:id", h1)`, `app.get("/${a}/new", h2)`, `app.get("/${a}/*", h3)`, `app.get("/${b}", h4)`, `app.all("/${a}/:id", h5)`, `app.use("/${a}", h6)`]).slice(0, 4);
      const handlers: Record<string, string> = {};
      routes.forEach((x, i) => (handlers[x] = `h${i + 1}`));
      const labelled = routes.map((x, i) => x.replace(/, h\d+\)/, `, h${i + 1})`));
      const req = r.pick([{ m: "GET", p: `/${a}/${id}` }, { m: "GET", p: `/${a}/new` }, { m: "POST", p: `/${a}/${id}` }, { m: "GET", p: `/${b}` }, { m: "GET", p: `/${a}/${id}/extra` }]);
      const matches = labelled.map((x, i) => {
        const m = /app\.(get|all|use)\("([^"]+)"/.exec(x)!, verb = m[1], pat = m[2];
        if (verb === "get" && req.m !== "GET") return null;
        const re = verb === "use" ? new RegExp(`^${pat}(/.*)?$`) : new RegExp("^" + pat.replace(/:id/, "[^/]+").replace(/\*/, ".*") + "$");
        return re.test(req.p) ? `h${i + 1}` : null;
      }).filter((x): x is string => !!x);
      const v = matches.length ? matches[0] : "404 Not Found";
      const wr = [...labelled.map((_, i) => `h${i + 1}`), "404 Not Found"];
      return { prompt: `Handlers never call next(). Express 4 checks routes in the order written. Which handler answers ${req.m} ${req.p}?`, code: labelled.join("\n"), correct: v, wrong: wr.filter((x) => x !== v), topic: "routing order", hint: "The first matching route that does not call next() wins; app.use matches by prefix, app.get only exact paths." };
    },
  },
];
