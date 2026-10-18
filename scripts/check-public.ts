/** Checks what strangers and search engines may see: npm run check:public (read-only; uses DATABASE_FILE or data/gglearn.db). */
import { db, brands, tracks } from "../lib/db";
import { eq } from "drizzle-orm";
import { guestAudience } from "../lib/guestLink";
import { isPublicTrack, publicTracks } from "../lib/publicCatalog";
import sitemap from "../app/sitemap";
import robots from "../app/robots";
import { hiddenTrackIds } from "../lib/tracks";
import { byTopicName, topicLabel } from "../lib/topicName";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

const pub = publicTracks();
const all = db.select({ t: tracks, b: brands }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).all();
const companyStaff = all.filter((r) => r.t.audience === "staff" && r.b.kind !== "shared");

check("there are public topics", pub.length > 0);
check("no company staff topic is public", companyStaff.every((r) => !isPublicTrack(r.t.id)));
check("every public topic is one a guest could be invited to", pub.every((r) => guestAudience(r.track.id) !== null));
check("every public topic has live questions", pub.every((r) => r.n > 0));

process.env.SITE_URL = "https://example.test";
const urls = sitemap().map((u) => u.url);
check("the sitemap uses the site address", urls.every((u) => u.startsWith("https://example.test/")));
check("the sitemap lists no company staff topic", companyStaff.every((r) => !urls.some((u) => u.endsWith(`/tracks/${r.t.slug}`))));
check("the sitemap lists no page behind sign-in", !urls.some((u) => /\/(admin|dashboard|profile|run|cert|join|start)\b/.test(u)));
check("the sitemap has no duplicates", new Set(urls).size === urls.length);

const r = robots();
const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
const dis = ([] as string[]).concat(rules.disallow ?? []);
check("robots keeps crawlers out of admin, certificates and share cards", ["/admin", "/cert/", "/s/", "/join/"].every((p) => dis.includes(p)));
check("robots points at the sitemap", r.sitemap === "https://example.test/sitemap.xml");

check("topic labels drop the stage number", topicLabel("5. Backend development") === "Backend development");
check("topic labels drop the Novice to Titan suffix", topicLabel("Python: Novice to Titan") === "Python");
check("topic labels keep other colons", topicLabel("Technologies: Drupal") === "Technologies: Drupal");
check("a topic named only by the suffix keeps its name", topicLabel(": Novice to Titan") === ": Novice to Titan");
check("stage 2 sorts before stage 10", ["10. Launch", "2. Requirements", "1. Discovery"].sort(byTopicName).join("|") === "1. Discovery|2. Requirements|10. Launch");
check("sorting ignores case", ["python", "Angular"].sort(byTopicName)[0] === "Angular");
// jQuery and npm are written that way; retired tracks are hidden from everyone, so their names do not matter
const hiddenIds = hiddenTrackIds();
const names = db.select({ id: tracks.id, n: tracks.name }).from(tracks).all().filter((r) => !hiddenIds.has(r.id) && !["jQuery", "npm"].includes(r.n)).map((r) => r.n);
check("no shown topic name starts in lower case", names.every((n) => !/^[a-z]/.test(n)));

console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
