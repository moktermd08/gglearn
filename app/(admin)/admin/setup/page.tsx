import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Building2, Settings2 } from "lucide-react";
import { brands, companies, db, questions, tracks } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { isGlobal, scopeInReach, trackInReach } from "@/lib/tenancy";
import { adminScopeOf } from "@/lib/adminScope";
import { BrandForm, BrandingForm, CompanyForm, LearningOrderForm, TrackForm } from "./forms";
import { lookOfCompany } from "@/lib/brand";

export const metadata = { title: "Set up — gglearn" };

export default async function Setup() {
  const me = await requireManager();
  if (me.role !== "admin") redirect("/admin/compliance");
  const reach = (await adminScopeOf(me)).reach, platform = isGlobal(reach);
  const myCompanies = db.select().from(companies).orderBy(companies.name).all().filter((c) => scopeInReach(reach, { kind: "company", id: c.id }));
  const companyName = new Map(myCompanies.map((c) => [c.id, c.name]));
  const myBrands = db.select().from(brands).orderBy(brands.name).all()
    .filter((b) => b.kind === "company" && b.companyId != null && companyName.has(b.companyId));
  const counts = new Map(db.select({ id: questions.trackId, n: sql<number>`count(*)` }).from(questions).where(eq(questions.status, "active")).groupBy(questions.trackId).all().map((r) => [r.id, r.n]));
  const myTracks = db.select().from(tracks).orderBy(tracks.name).all().filter((t) => trackInReach(reach, t));
  const brandById = new Map(myBrands.map((b) => [b.id, b]));
  const h2 = "mb-2 text-lg font-semibold";

  return (
    <div className="space-y-8">
      <PageHero Icon={Settings2} title="Set up" sub="Companies, their brands and the tracks each brand teaches. People are added on People once the company exists.">
        <Link href="/admin/paths" className="btn btn-ghost !py-1 text-sm">Set what is required</Link>
      </PageHero>

      {platform && (
        <section>
          <h2 className={h2}>Add a company</h2>
          <CompanyForm />
        </section>
      )}

      <section>
        <h2 className={h2}>Add a brand</h2>
        <BrandForm companies={myCompanies.map((c) => ({ id: c.id, name: c.name }))} />
      </section>

      <section>
        <h2 className={h2}>Add a track</h2>
        <p className="mb-2 text-sm text-slate-400">A new track is empty. Nobody is required to take it until it has enough questions to reach its pass level; add them with <code>npm run import:knowledge</code> and approve them at /admin/review.</p>
        <TrackForm brands={myBrands.map((b) => ({ id: b.id, name: b.name, company: companyName.get(b.companyId!) ?? "" }))} />
      </section>

      <section>
        <h2 className={h2}>Branding</h2>
        <p className="mb-2 text-sm text-slate-400">What the academy looks like for people who belong to one company: its name, colour, logo and the issuer on certificates. People in several companies see the standard look.</p>
        <div className="space-y-3">
          {myCompanies.length === 0 && <p className="text-sm text-slate-400">Add a company first.</p>}
          {myCompanies.map((c) => (
            <BrandingForm key={c.id} company={{ id: c.id, name: c.name, academyName: c.academyName, accent: c.accent, certIssuer: c.certIssuer, certValidMonths: c.certValidMonths ?? 0, certSigner: c.certSigner, certSignerTitle: c.certSignerTitle, logoUrl: lookOfCompany(c.id).logo }} />
          ))}
        </div>
      </section>

      <section>
        <h2 className={h2}>Learning order</h2>
        <p className="mb-2 text-sm text-slate-400">Each job role has a learning journey in a sensible order (foundations first, security later, and so on). Choose how strictly your people must follow it. A learner who already knows a stage can always test out of it with a placement check, and managers and admins are never locked.</p>
        <div className="space-y-3">
          {myCompanies.length === 0 && <p className="text-sm text-slate-400">Add a company first.</p>}
          {myCompanies.map((c) => <LearningOrderForm key={c.id} company={{ id: c.id, name: c.name, journeyLock: c.journeyLock }} />)}
        </div>
      </section>

      <section>
        <h2 className={h2}>What exists</h2>
        {myCompanies.length === 0 && <p className="text-sm text-slate-400">Nothing in your reach yet.</p>}
        <div className="space-y-4">
          {myCompanies.map((c) => (
            <div key={c.id} className="card p-4">
              <h3 className="flex items-center gap-2 font-semibold"><Building2 size={16} className="text-sky-300" />{c.name}{c.tagline && <span className="text-sm font-normal text-slate-400"> — {c.tagline}</span>}</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {myBrands.filter((b) => b.companyId === c.id).map((b) => (
                  <li key={b.id}>
                    <b>{b.name}</b>
                    <ul className="ml-4 mt-1 list-disc text-slate-400">
                      {myTracks.filter((t) => t.brandId === b.id).map((t) => (
                        <li key={t.id}>
                          {t.name} · {t.tier} · {counts.get(t.id) ?? 0} questions
                          {!counts.get(t.id) && <> · <Link href={`/admin/review/${t.slug}`} className="underline">review</Link></>}
                        </li>
                      ))}
                      {!myTracks.some((t) => t.brandId === b.id && brandById.has(b.id)) && <li className="list-none">No tracks yet</li>}
                    </ul>
                  </li>
                ))}
                {!myBrands.some((b) => b.companyId === c.id) && <li className="text-slate-400">No brands yet</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
