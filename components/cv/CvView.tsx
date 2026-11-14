import { BadgeCheck, Calendar, Link2, Mail, MapPin, Phone, ShieldCheck, TriangleAlert } from "lucide-react";
import type { CvDoc, CvItem, CvSection } from "@/lib/cv/build";

const ACCENT = { classic: "#1f2937", modern: "#2563eb", compact: "#1f2937" } as const;
const ICON = { email: Mail, phone: Phone, location: MapPin, link: Link2 } as const;
const day = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

function Verify({ v }: { v: NonNullable<CvItem["verify"]> }) {
  const bad = v.status === "expired";
  return (
    <a href={v.url} className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${bad ? "bg-[#fef3c7] text-[#92400e]" : "bg-[#ecfdf5] text-[#065f46]"}`} aria-label={`Verify this certificate, code ${v.code}`}>
      {bad ? <TriangleAlert size={13} aria-hidden /> : <BadgeCheck size={13} aria-hidden />}{bad ? "Expired · check" : v.status === "expiring" ? "Verified · expiring soon" : "Verified"} · {v.code}
    </a>
  );
}

function Item({ s, it }: { s: CvSection; it: CvItem }) {
  if (s.chips) return null;
  return (
    <li className="space-y-1 break-inside-avoid">
      <div className="flex flex-wrap items-baseline gap-x-3">
        {it.title && <h3 className={`font-bold ${s.key === "quotes" ? "font-semibold italic" : ""}`}>{it.title}</h3>}
        {(it.dates || it.level) && <span className="ml-auto text-sm text-[#64748b]">{it.dates ?? it.subtitle}</span>}
      </div>
      {it.subtitle && !it.level && <p className="text-sm text-[#475569]">{it.subtitle}</p>}
      {it.level && (
        <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[#e2e8f0]" role="img" aria-label={`Level ${it.level.n} of ${it.level.of}`}>
          <div className="h-full rounded-full" style={{ width: `${(it.level.n / it.level.of) * 100}%`, background: "var(--cv-accent)" }} />
        </div>
      )}
      {it.body && (it.body.length > 1 || ["experience", "projects", "education", "volunteer", "awards"].includes(s.key)
        ? <ul className="ml-4 list-disc space-y-0.5 text-sm marker:text-[#94a3b8]">{it.body.map((b, i) => <li key={i}>{b}</li>)}</ul>
        : it.body.map((b, i) => <p key={i} className="text-sm leading-relaxed">{b}</p>))}
      {it.verify && <Verify v={it.verify} />}
    </li>
  );
}

/**
 * The CV as a reader sees it. Drawn only from a CvDoc, so it can never show more than the view allowed. A short "at a glance" strip comes
 * first for the reader with thirty seconds: what is verified and what is strongest. Prints cleanly (the page's own buttons are left out).
 */
export function CvView({ doc, pdfHref, printable = true }: { doc: CvDoc; pdfHref?: string; printable?: boolean }) {
  const accent = doc.accent || ACCENT[doc.template], modern = doc.template === "modern", compact = doc.template === "compact";
  const certs = doc.sections.find((s) => s.key === "certificates")?.items.filter((i) => i.verify && i.verify.status !== "expired").length ?? 0;
  const strongest = doc.sections.find((s) => s.key === "assessed")?.items.slice(0, 3) ?? [];
  const glance = certs > 0 || strongest.length > 0;
  return (
    <article className={`cv mx-auto max-w-3xl bg-[#fff] text-[#0f172a] shadow-sm ring-1 ring-black/5 print:shadow-none print:ring-0 ${compact ? "p-6 text-[14px] sm:p-8" : "p-6 sm:p-10"}`} style={{ "--cv-accent": accent } as React.CSSProperties}>
      <header className={modern ? "-mx-6 -mt-6 mb-6 px-6 py-6 text-[#fff] sm:-mx-10 sm:-mt-10 sm:px-10 sm:py-8 print:text-[#0f172a]" : "mb-5 border-b border-[#e2e8f0] pb-4"} style={modern ? { background: accent } : undefined}>
        <h1 className="text-3xl font-extrabold tracking-tight">{doc.name}</h1>
        {doc.headline && <p className={`mt-1 text-lg ${modern ? "text-[#ffffffe6] print:text-[#475569]" : "text-[#475569]"}`}>{doc.headline}</p>}
        {doc.contact.length > 0 && (
          <ul className={`mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm ${modern ? "text-[#ffffffe6] print:text-[#475569]" : "text-[#475569]"}`}>
            {doc.contact.map((c, i) => { const I = ICON[c.kind]; return <li key={i} className="inline-flex items-center gap-1.5"><I size={14} aria-hidden />{c.href ? <a href={c.href} rel={c.kind === "link" ? "noopener noreferrer nofollow ugc" : undefined} target={c.kind === "link" ? "_blank" : undefined} className="underline-offset-2 hover:underline">{c.kind === "link" && c.label ? `${c.label}: ${c.value}` : c.value}</a> : c.value}</li>; })}
          </ul>
        )}
      </header>

      {glance && (
        <section aria-label="At a glance" className="mb-6 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm print:hidden">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold">
            <ShieldCheck size={16} className="text-[#059669]" aria-hidden />At a glance
            {certs > 0 && <span className="font-normal text-[#334155]">{certs} verified {certs === 1 ? "certificate" : "certificates"}, each one checkable</span>}
          </p>
          {strongest.length > 0 && <p className="mt-1 text-[#475569]">Strongest: {strongest.map((s) => `${s.title} (level ${s.level?.n} of ${s.level?.of})`).join(" · ")}</p>}
        </section>
      )}

      <div className={compact ? "space-y-4" : "space-y-6"}>
        {doc.sections.map((s) => (
          <section key={s.key} aria-labelledby={`cv-${s.key}`} className="break-inside-avoid-page">
            <h2 id={`cv-${s.key}`} className="mb-2 border-b pb-1 text-xs font-extrabold uppercase tracking-widest" style={{ color: modern ? accent : "#0f172a", borderColor: modern ? accent : "#e2e8f0" }}>{s.title}</h2>
            {s.chips ? <ul className="flex flex-wrap gap-1.5">{s.items.map((i, k) => <li key={k} className="rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-sm">{i.title}</li>)}</ul>
              : <ul className="space-y-3">{s.items.map((it, k) => <Item key={it.key ?? k} s={s} it={it} />)}</ul>}
            {s.note && <p className="mt-2 text-xs text-[#64748b]">{s.note}</p>}
          </section>
        ))}
        {doc.sections.length === 0 && <p className="text-sm text-[#64748b]">There is nothing to show on this CV yet.</p>}
      </div>

      <footer className="mt-8 flex flex-wrap items-center gap-3 border-t border-[#e2e8f0] pt-3 text-xs text-[#64748b]">
        <span className="inline-flex items-center gap-1"><Calendar size={12} aria-hidden />Updated {day(doc.generatedAt)}</span>
        <span>Evidence checked by gglearn</span>
        {printable && <span className="ml-auto flex gap-2 print:hidden">
          {pdfHref && <a href={pdfHref} className="rounded-md border border-[#cbd5e1] px-3 py-1 font-semibold text-[#334155] hover:bg-[#f8fafc]">Download PDF</a>}
        </span>}
      </footer>
    </article>
  );
}
