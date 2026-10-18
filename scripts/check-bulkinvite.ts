/** Checks reading a bulk invite list: npm run check:bulkinvite (pure; touches no data). */
import { MAX_BULK, parseBulk } from "../lib/bulkInvite";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const r = (t: string, d = "developer") => parseBulk(t, d);

check("one address per line, all given the default role", JSON.stringify(r("a@x.com\nb@x.com").rows) === JSON.stringify([{ email: "a@x.com", jobRole: "developer" }, { email: "b@x.com", jobRole: "developer" }]));
check("a role after the address is used", r("a@x.com, designer").rows[0].jobRole === "designer");
check("semicolons and tabs work as separators", r("a@x.com;sales\nb@x.com\ttester").rows.map((x) => x.jobRole).join() === "sales,tester");
check("a header line is skipped without complaint", r("Email,Role\na@x.com,sales").rejected.length === 0 && r("Email,Role\na@x.com,sales").rows.length === 1);
check("a name column before the address is ignored", r("Ana Smith,ana@x.com,sales").rows[0].email === "ana@x.com" && r("Ana Smith,ana@x.com,sales").rows[0].jobRole === "sales");
check("a spreadsheet export with quotes works", r('"Ana","ana@x.com","Sales"').rows[0].jobRole === "sales");
check("addresses are lower-cased", r("ANA@X.COM").rows[0].email === "ana@x.com");
check("windows line endings and a byte order mark are fine", r("﻿a@x.com\r\nb@x.com\r\n").rows.length === 2);
check("blank lines are ignored", r("\n\na@x.com\n\n").rows.length === 1);
check("a line with no address is reported with its number", r("a@x.com\nnot an email").rejected[0] === "Line 2: no email address found");
check("a repeated address is reported once and kept once", r("a@x.com\nA@x.com").rows.length === 1 && r("a@x.com\nA@x.com").rejected.length === 1);
check("a bad line never stops the rest", r("bad\na@x.com\nworse\nb@x.com").rows.length === 2);
check("a role that is another address is not taken as a role", r("a@x.com,b@x.com").rows.length === 1 && r("a@x.com,b@x.com").rows[0].jobRole === "developer");
check("a silly role falls back to the default", r("a@x.com,<script>").rows[0].jobRole === "developer");
const many = Array.from({ length: MAX_BULK + 5 }, (_, i) => `u${i}@x.com`).join("\n");
check("more than the limit is cut and flagged", r(many).rows.length === MAX_BULK && r(many).tooMany);
check("exactly the limit is fine", !r(Array.from({ length: MAX_BULK }, (_, i) => `u${i}@x.com`).join("\n")).tooMany);
check("empty input gives nothing and no error", r("").rows.length === 0 && r("").rejected.length === 0);

console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
