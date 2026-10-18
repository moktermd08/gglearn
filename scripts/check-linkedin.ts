/** Checks the LinkedIn "Add to profile" link: npm run check:linkedin (pure; touches no data). */
import { LINKEDIN_NAME_MAX, linkedInAddUrl, type LinkedInCert } from "../lib/linkedin";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const base: LinkedInCert = { name: "Python: Practitioner", issuer: "Moksy Academy", issuedAt: Date.UTC(2026, 9, 18, 12) / 1000, expiresAt: null, code: "ABC-123-XYZ", url: "https://learn.example.test/cert/ABC-123-XYZ" };
const parse = (c: LinkedInCert) => new URL(linkedInAddUrl(c));

const u = parse(base);
check("it opens LinkedIn's add-a-certification form", u.origin === "https://www.linkedin.com" && u.pathname === "/profile/add" && u.searchParams.get("startTask") === "CERTIFICATION_NAME");
check("it carries the name, issuer and credential id", u.searchParams.get("name") === "Python: Practitioner" && u.searchParams.get("organizationName") === "Moksy Academy" && u.searchParams.get("certId") === "ABC-123-XYZ");
check("it links to the public page that verifies the certificate", u.searchParams.get("certUrl") === base.url);
check("the issue date is the month and year, not zero-based", u.searchParams.get("issueYear") === "2026" && u.searchParams.get("issueMonth") === "10");
check("a certificate that never expires sends no expiry", !u.searchParams.has("expirationYear") && !u.searchParams.has("expirationMonth"));
const e = parse({ ...base, expiresAt: Date.UTC(2028, 0, 31, 23, 59) / 1000 });
check("an expiry is sent as month and year", e.searchParams.get("expirationYear") === "2028" && e.searchParams.get("expirationMonth") === "1");
check("the month near a year end is right in UTC", parse({ ...base, issuedAt: Date.UTC(2026, 11, 31, 23, 59) / 1000 }).searchParams.get("issueMonth") === "12" && parse({ ...base, issuedAt: Date.UTC(2027, 0, 1, 0, 1) / 1000 }).searchParams.get("issueYear") === "2027");

const long = parse({ ...base, name: "A".repeat(300) }).searchParams.get("name")!;
check("a long name is cut to LinkedIn's limit", long.length === LINKEDIN_NAME_MAX && long.endsWith("…"));
check("a name at exactly the limit is left alone", parse({ ...base, name: "B".repeat(LINKEDIN_NAME_MAX) }).searchParams.get("name") === "B".repeat(LINKEDIN_NAME_MAX));
check("extra spaces and line breaks are tidied", parse({ ...base, name: "  Python \n  Practitioner " }).searchParams.get("name") === "Python Practitioner");

const odd = parse({ ...base, name: "R&D: C# & \"quotes\" é 日本", issuer: "Guru & Sons <Ltd>", url: "https://x.test/cert/A?b=1&c=2#frag" });
check("symbols and non-Latin text survive the round trip", odd.searchParams.get("name") === "R&D: C# & \"quotes\" é 日本" && odd.searchParams.get("organizationName") === "Guru & Sons <Ltd>");
check("a link containing its own query string stays one value", odd.searchParams.get("certUrl") === "https://x.test/cert/A?b=1&c=2#frag");
check("an injected parameter cannot appear", !parse({ ...base, name: "x&startTask=EVIL&name=y" }).searchParams.getAll("startTask").includes("EVIL") && parse({ ...base, name: "x&startTask=EVIL" }).searchParams.getAll("startTask").length === 1);

console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
