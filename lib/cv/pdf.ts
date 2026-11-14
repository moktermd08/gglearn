import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFArray, PDFDocument, PDFFont, PDFName, PDFPage, PDFString, rgb, type RGB } from "pdf-lib";
import type { CvDoc, CvItem } from "@/lib/cv/build";
import { isHexColour } from "@/lib/cv/text";

/**
 * The CV as a PDF a recruiting system can read: A4, one column, real selectable text, standard section names, an embedded font, no pictures
 * of text. Drawn from the same CvDoc as the web page, so it shows exactly what that view allows and nothing else. Verification addresses are
 * printed in full and are also clickable.
 */
const A4 = { w: 595.28, h: 841.89 };
const font = (file: string) => readFileSync(path.join(process.cwd(), "assets", "fonts", file));

const hex = (h: string, fallback: RGB): RGB => (isHexColour(h) ? rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255) : fallback);
const INK = rgb(0.1, 0.11, 0.14), MUTED = rgb(0.38, 0.41, 0.46), RULE = rgb(0.82, 0.84, 0.87);

export async function renderPdf(doc: CvDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(font("NotoSans-Regular.woff"), { subset: true });
  const bold = await pdf.embedFont(font("NotoSans-Bold.woff"), { subset: true });
  const has = new Map<PDFFont, Set<number>>([[regular, new Set(regular.getCharacterSet())], [bold, new Set(bold.getCharacterSet())]]);

  // the font covers Latin; anything it cannot draw is simplified (é -> e) or replaced, never allowed to break the file
  const safe = (s: string, f: PDFFont) => {
    const set = has.get(f)!;
    return [...s.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ")].map((ch) => {
      if (set.has(ch.codePointAt(0)!)) return ch;
      const base = ch.normalize("NFD").replace(/\p{M}/gu, "");
      return base && [...base].every((c) => set.has(c.codePointAt(0)!)) ? base : "?";
    }).join("");
  };

  const compact = doc.template === "compact", modern = doc.template === "modern";
  const k = compact ? 0.92 : 1;
  const accent = hex(doc.accent, modern ? rgb(0.15, 0.39, 0.92) : INK);
  const M = { l: 50, r: 50, t: 54, b: 56 }, W = A4.w - M.l - M.r;
  let page!: PDFPage, y = 0;
  const pages: PDFPage[] = [];
  const newPage = () => { page = pdf.addPage([A4.w, A4.h]); pages.push(page); y = A4.h - M.t; };
  const need = (h: number) => { if (y - h < M.b) newPage(); };
  newPage();

  const width = (s: string, f: PDFFont, size: number) => f.widthOfTextAtSize(s, size);
  const wrap = (text: string, f: PDFFont, size: number, max: number): string[] => {
    const out: string[] = [];
    for (const para of safe(text, f).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        let w = word;
        while (width(w, f, size) > max) { // a word wider than the line (a long address): break it
          let n = w.length; while (n > 1 && width(w.slice(0, n), f, size) > max) n--;
          if (line) { out.push(line); line = ""; }
          out.push(w.slice(0, n)); w = w.slice(n);
        }
        const trial = line ? `${line} ${w}` : w;
        if (width(trial, f, size) <= max) line = trial; else { out.push(line); line = w; }
      }
      out.push(line);
    }
    return out.filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== ""));
  };
  const text = (s: string, x: number, f: PDFFont, size: number, color: RGB) => { page.drawText(safe(s, f), { x, y, size, font: f, color }); };
  const link = (url: string, x: number, w: number, size: number) => {
    const ref = pdf.context.register(pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [x, y - 2, x + w, y + size], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(url) } }));
    const have = page.node.lookup(PDFName.of("Annots"));
    if (have instanceof PDFArray) have.push(ref); else page.node.set(PDFName.of("Annots"), pdf.context.obj([ref]));
  };
  const block = (s: string, f: PDFFont, size: number, color: RGB, indent = 0, lead = 1.28) => {
    for (const line of wrap(s, f, size * k, W - indent)) { need(size * k * lead); y -= size * k * lead; text(line, M.l + indent, f, size * k, color); }
  };

  // ---- header
  y -= 22 * k; text(doc.name, M.l, bold, 22 * k, accent); 
  if (doc.headline) block(doc.headline, regular, 12, MUTED, 0, 1.45);
  const contacts = doc.contact.map((c) => (c.kind === "link" && c.label ? `${c.label}: ${c.value}` : c.value)).join("   ·   ");
  if (contacts) { y -= 4 * k; block(contacts, regular, 9.5, MUTED, 0, 1.4); }
  y -= 10 * k; page.drawLine({ start: { x: M.l, y }, end: { x: A4.w - M.r, y }, thickness: modern ? 1.5 : 0.7, color: modern ? accent : RULE });

  // ---- sections
  const drawItem = (s: { key: string; chips?: boolean }, it: CvItem) => {
    if (s.chips) return;
    const dates = (it.level ? it.subtitle : it.dates) ?? "", dw = dates ? width(safe(dates, regular), regular, 9.5 * k) : 0;
    const head = it.title;
    if (head) {
      const lines = wrap(head, bold, 10.5 * k, W - dw - 12);
      need(10.5 * k * 1.3 * lines.length + 4);
      lines.forEach((line, i) => { y -= 10.5 * k * 1.3; text(line, M.l, bold, 10.5 * k, INK); if (i === 0 && dates) text(dates, A4.w - M.r - dw, regular, 9.5 * k, MUTED); });
    } else if (dates) { y -= 10 * k * 1.3; text(dates, M.l, regular, 9.5 * k, MUTED); }
    if (it.subtitle && !it.level) block(it.subtitle, regular, 9.5, MUTED);
    for (const b of it.body ?? []) {
      const bulleted = (s.key === "experience" || s.key === "projects" || s.key === "volunteer" || s.key === "education" || s.key === "awards") && (it.body!.length > 1 || b.length > 0);
      const lines = wrap(b, regular, 9.8 * k, W - (bulleted ? 12 : 0));
      lines.forEach((line, i) => { need(9.8 * k * 1.3); y -= 9.8 * k * 1.3; if (bulleted && i === 0) text("•", M.l + 2, regular, 9.8 * k, MUTED); text(line, M.l + (bulleted ? 12 : 0), regular, 9.8 * k, INK); });
    }
    if (it.verify) {
      const label = `Verify: ${it.verify.url}${it.verify.status === "expired" ? "  (expired)" : ""}`;
      need(8.5 * k * 1.4); y -= 8.5 * k * 1.4; const s2 = safe(label, regular); text(label, M.l, regular, 8.5 * k, accent); link(it.verify.url, M.l, width(s2, regular, 8.5 * k), 8.5 * k);
    }
    y -= 5 * k;
  };
  for (const s of doc.sections) {
    need(40 * k); y -= 16 * k;
    text(s.title.toUpperCase(), M.l, bold, 9.8 * k, modern ? accent : INK);
    y -= 4 * k; page.drawLine({ start: { x: M.l, y }, end: { x: A4.w - M.r, y }, thickness: 0.5, color: RULE });
    if (s.chips) block(s.items.map((i) => i.title).join("  ·  "), regular, 9.8, INK);
    else for (const it of s.items) drawItem(s, it);
    if (s.note) { y -= 2 * k; block(s.note, regular, 8, MUTED, 0, 1.4); }
    y -= 4 * k;
  }

  // ---- footer on every page
  const when = new Date(doc.generatedAt * 1000).toISOString().slice(0, 10);
  pages.forEach((p, i) => {
    const t = safe(`${doc.name}  ·  CV generated ${when} on gglearn  ·  ${i + 1}/${pages.length}`, regular);
    p.drawText(t, { x: M.l, y: 28, size: 7.5, font: regular, color: MUTED });
  });
  pdf.setTitle(`${doc.name}: CV`); pdf.setAuthor(doc.name); pdf.setProducer("gglearn"); pdf.setCreator("gglearn");
  pdf.setCreationDate(new Date(doc.generatedAt * 1000)); pdf.setModificationDate(new Date(doc.generatedAt * 1000));
  return pdf.save();
}
