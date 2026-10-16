/** Signs certificates issued before signatures existed: npm run sign:certs (uses DATABASE_FILE or data/gglearn.db). Safe to repeat; only certificates with no signature are touched, and their dates and signatory are left as they were (no expiry). */
import { eq } from "drizzle-orm";
import { certificates, db } from "../lib/db";
import { signatureOf } from "../lib/certs";

const unsigned = db.select().from(certificates).where(eq(certificates.signature, "")).all();
for (const c of unsigned) db.update(certificates).set({ signature: signatureOf(c) }).where(eq(certificates.id, c.id)).run();
console.log(`signed ${unsigned.length} certificate${unsigned.length === 1 ? "" : "s"}`);
