import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import type { Pack } from "@/lib/star/data";
import { unitName } from "@/lib/star/framework";

/**
 * An application pack as a PDF: A4, one column, real selectable text, an embedded font, like the CV (lib/cv/pdf.ts). Two layouts: the written
 * statements, one behaviour after another with the word count, and a one-page-per-few-behaviours interview cue sheet of short S, T, A, R lines.
 * With `cv`, the person's CV pages (already rendered) come first, so one file can go with the application.
 */
const A4 = { w: 595.28, h: 841.89 };
const font = (file: string) => readFileSync(path.join(process.cwd(), "assets", "fonts", file));
const INK = rgb(0.1, 0.11, 0.14), MUTED = rgb(0.38, 0.41, 0.46), RULE = rgb(0.82, 0.84, 0.87), WARN = rgb(0.72, 0.2, 0.1);

export async function renderPack(pack: Pack, mode: "statements" | "cue", opts: { name?: string; cv?: Uint8Array }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(font("NotoSans-Regular.woff"), { subset: true });
  const bold = await pdf.embedFont(font("NotoSans-Bold.woff"), { subset: true });
  const has = new Map<PDFFont, Set<number>>([[regular, new Set(regular.getCharacterSet())], [bold, new Set(bold.getCharacterSet())]]);
  const safe = (s: string, f: PDFFont) => {
    const set = has.get(f)!;
    return [...s.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ")].map((ch) => {
      if (set.has(ch.codePointAt(0)!)) return ch;
      const base = ch.normalize("NFD").replace(/\p{M}/gu, "");
      return base && [...base].every((c) => set.has(c.codePointAt(0)!)) ? base : "?";
    }).join("");
  };

  if (opts.cv) { // the CV first, page for page as it was drawn
    const cv = await PDFDocument.load(opts.cv);
    for (const p of await pdf.copyPages(cv, cv.getPageIndices())) pdf.addPage(p);
  }
  const first = pdf.getPageCount();
  const M = { l: 50, r: 50, t: 54, b: 56 }, W = A4.w - M.l - M.r;
  let page!: PDFPage, y = 0;
  const pages: PDFPage[] = [];
  const newPage = () => { page = pdf.addPage([A4.w, A4.h]); pages.push(page); y = A4.h - M.t; };
  const need = (h: number) => { if (y - h < M.b) newPage(); };
  newPage();

  const wrap = (t: string, f: PDFFont, size: number, max: number): string[] => {
    const out: string[] = [];
    for (const para of safe(t, f).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        let w = word;
        while (f.widthOfTextAtSize(w, size) > max) {
          let n = w.length; while (n > 1 && f.widthOfTextAtSize(w.slice(0, n), size) > max) n--;
          if (line) { out.push(line); line = ""; }
          out.push(w.slice(0, n)); w = w.slice(n);
        }
        const trial = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(trial, size) <= max) line = trial; else { out.push(line); line = w; }
      }
      out.push(line);
    }
    return out.filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== ""));
  };
  const block = (t: string, f: PDFFont, size: number, color = INK, indent = 0, lead = 1.35) => {
    for (const line of wrap(t, f, size, W - indent)) { need(size * lead); y -= size * lead; page.drawText(line, { x: M.l + indent, y, size, font: f, color }); }
  };

  y -= 20; block(pack.job, bold, 18);
  block([pack.department, pack.grade, pack.closesOn && `Closes ${pack.closesOn}`].filter(Boolean).join("  ·  "), regular, 10.5, MUTED);
  y -= 2; block(mode === "statements" ? `Behaviour statements${opts.name ? `: ${opts.name}` : ""}` : `Interview cue sheet${opts.name ? `: ${opts.name}` : ""}`, bold, 12, MUTED);
  y -= 6; page.drawLine({ start: { x: M.l, y }, end: { x: A4.w - M.r, y }, thickness: 0.7, color: RULE });

  for (const e of pack.entries) {
    need(60); y -= 14;
    block(e.title, bold, 12.5);
    if (mode === "statements") {
      block(`${e.size} ${unitName(pack.limitUnit, e.size)}${e.over ? `  ·  ${e.over} over the limit of ${pack.wordLimit}` : `  ·  limit ${pack.wordLimit}`}`, regular, 8.5, e.over ? WARN : MUTED);
      y -= 3;
      for (const para of e.answer.split("\n").filter(Boolean)) { block(para, regular, 10.2, INK, 0, 1.45); y -= 4; }
    } else {
      if (e.storyTitle) block(`${e.storyTitle}${e.context ? `  (${e.context})` : ""}`, regular, 9.5, MUTED);
      y -= 2;
      if (e.parts) {
        for (const [l, k] of [["S", "situation"], ["T", "task"], ["A", "action"], ["R", "result"]] as const) {
          const t = e.parts[k].replace(/\s+/g, " ").trim() || "(add)";
          const lines = wrap(t, regular, 9.8, W - 18);
          lines.forEach((line, i) => { need(9.8 * 1.35); y -= 9.8 * 1.35; if (i === 0) page.drawText(l, { x: M.l, y, size: 9.8, font: bold, color: MUTED }); page.drawText(line, { x: M.l + 18, y, size: 9.8, font: regular, color: INK }); });
        }
      } else block(e.answer, regular, 9.8);
    }
    y -= 6; need(8); page.drawLine({ start: { x: M.l, y }, end: { x: A4.w - M.r, y }, thickness: 0.4, color: RULE });
  }
  if (pack.missing.length) { y -= 10; block(`Still to cover: ${pack.missing.join(", ")}`, regular, 9.5, WARN); }

  pages.forEach((p, i) => p.drawText(safe(`${pack.job}  ·  prepared on gglearn  ·  ${i + 1}/${pages.length}`, regular), { x: M.l, y: 28, size: 7.5, font: regular, color: MUTED }));
  void first;
  pdf.setTitle(`${pack.job}: ${mode === "statements" ? "behaviour statements" : "interview cue sheet"}`); pdf.setProducer("gglearn"); pdf.setCreator("gglearn");
  return pdf.save();
}
