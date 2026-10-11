// Test-time only: re-derives answers by really running the code. Imported by scripts, never by the app.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import type { Verify } from "./types";

function tsProgram(src: string) {
  const opts: ts.CompilerOptions = { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, lib: ["lib.es2022.d.ts"], types: [], skipLibCheck: true };
  const host = ts.createCompilerHost(opts), file = "/virtual.ts";
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (f, l, ...rest) => (f === file ? ts.createSourceFile(f, src, l) : getSourceFile(f, l, ...rest));
  host.fileExists = (f) => f === file || ts.sys.fileExists(f);
  host.readFile = (f) => (f === file ? src : ts.sys.readFile(f));
  return { program: ts.createProgram([file], opts, host), file };
}

const run = (cmd: string, args: string[], input?: string) => {
  const p = spawnSync(cmd, args, { input, encoding: "utf8", timeout: 8000 });
  return { out: (p.stdout ?? "").replace(/\r/g, "").trimEnd(), err: p.stderr ?? "", status: p.status };
};

/** Returns null when the stated answer matches real execution, otherwise a description of the mismatch. */
export function verify(v: Verify): string | null {
  if (v.lang === "check") return v.ok() ? null : "custom check failed";
  if (v.lang === "ts") {
    for (const p of v.programs) {
      const { program } = tsProgram(p.src), errs = ts.getPreEmitDiagnostics(program).length;
      if ((errs === 0) !== p.ok) return `expected ${p.ok ? "no errors" : "a compile error"} but got ${errs} for:\n${p.src}`;
    }
    return null;
  }
  if (v.lang === "tskeys" || v.lang === "tstype") {
    const { program, file } = tsProgram(v.lang === "tskeys" ? `${v.src}\nexport type __K = keyof (${v.type});` : v.src);
    const sf = program.getSourceFile(file)!, checker = program.getTypeChecker();
    let found: string | null = null;
    sf.forEachChild((n) => {
      if (v.lang === "tskeys" && ts.isTypeAliasDeclaration(n) && n.name.text === "__K") {
        const ty = checker.getTypeAtLocation(n.name);
        found = ((ty.isUnion() ? ty.types : [ty]).map((x) => (x.isStringLiteral() ? x.value : checker.typeToString(x))).sort()).join(",");
      }
      if (v.lang === "tstype" && ts.isVariableStatement(n))
        for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === v.name) found = checker.typeToString(checker.getTypeAtLocation(d.name), undefined, ts.TypeFormatFlags.NoTruncation);
    });
    const want = v.lang === "tskeys" ? [...v.expect].sort().join(",") : v.expect;
    return found === want ? null : `expected ${want} got ${found}`;
  }
  let r: ReturnType<typeof run>;
  const dir = mkdtempSync(join(tmpdir(), "dq-"));
  try {
    if (v.lang === "js") { const f = join(dir, "t.cjs"); writeFileSync(f, v.src); r = run(process.execPath, [f]); }
    else if (v.lang === "py") { const f = join(dir, "t.py"); writeFileSync(f, v.src); r = run("/usr/bin/python3", [f]); }
    else if (v.lang === "php") { const f = join(dir, "t.php"); writeFileSync(f, `<?php\n${v.src}`); r = run("php", [f]); }
    else if (v.lang === "sh") { const f = join(dir, "t.sh"); writeFileSync(f, v.src); r = run("bash", [f]); }
    else r = run("sqlite3", [":memory:"], v.src);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  if (r.status !== 0) return `exit ${r.status}: ${r.err.slice(0, 200)}`;
  return r.out === v.expect.trimEnd() ? null : `expected ${JSON.stringify(v.expect)} got ${JSON.stringify(r.out)}`;
}
