#!/usr/bin/env bash
# Loads the repo's content into a gglearn database, in dependency order. Every step is additive and safe to repeat.
#
#   Rehearse (live database untouched; runs on a consistent copy):
#     ssh gglink-live 'DRY=1 bash -s' < deploy/seed-content.sh
#   Run for real (takes a consistent backup first):
#     ssh gglink-live 'bash -s' < deploy/seed-content.sh
#
# Locally: DIR=$PWD DRY=1 bash deploy/seed-content.sh
#
# Order: curriculum (brands, tracks) -> AI tracks -> knowledge items and questions -> structure -> career ladders ->
# customer content. Customer questions are imported as "review"; nothing customer-facing goes live until an admin
# approves it at /admin/review/<track>. The legacy TrialTest and questions-repo imports are NOT part of this: they
# need folders that only exist on the author's machine.
set -euo pipefail
DIR="${DIR:-/var/www/gglearn.gglink.co.uk}"
cd "$DIR"
[ -f .env.local ] || { echo "no .env.local in $DIR (SESSION_SECRET is needed by the scripts)" >&2; exit 1; }
LIVE="${DATABASE_FILE:-$DIR/data/gglearn.db}"
STAMP=$(date +%Y%m%d%H%M%S)

# A consistent snapshot: the database runs in WAL mode, so copying the file alone would miss recent writes.
snapshot() {
  DB="$LIVE" OUT="$1" node -e '
    const D = require("better-sqlite3");
    const db = new D(process.env.DB, { readonly: true });
    db.backup(process.env.OUT).then(() => { console.log("snapshot written: " + process.env.OUT); db.close(); })
      .catch((e) => { console.error(e); process.exit(1); });'
}

counts() {
  DATABASE_FILE="$1" node - <<'JS'
const D = require("better-sqlite3");
const db = new D(process.env.DATABASE_FILE, { readonly: true });
const n = (t, w = "1") => { try { return db.prepare(`select count(*) c from ${t} where ${w}`).get().c; } catch { return "n/a"; } };
console.log(JSON.stringify({
  brands: n("brands"), tracks: n("tracks"), companies: n("companies"), projects: n("projects"), pillars: n("pillars"), topics: n("topics"),
  knowledge_items: n("knowledge_items"), questions_active: n("questions", "status = 'active'"), questions_review: n("questions", "status = 'review'"),
  career_levels: n("career_levels"), lessons: n("lessons"), users: n("users"),
}));
JS
}

if [ "${DRY:-0}" = "1" ]; then
  TARGET="$(mktemp -d)/rehearsal.db"
  snapshot "$TARGET"
  echo "REHEARSAL: running against a copy, $LIVE is not touched."
else
  TARGET="$LIVE"
  KEEP="$DIR/data/gglearn.db.bak-before-content-$STAMP"
  snapshot "$KEEP"
fi
export DATABASE_FILE="$TARGET"

echo "before: $(counts "$TARGET")"
run() { echo; echo "== $*"; npm run --silent "$@"; }

run seed:curriculum
run seed:ai
shopt -s nullglob
run import:knowledge -- content/lifecycle/*.json
run import:knowledge -- content/products/*.json
run import:knowledge -- content/tools/*.json
run seed:structure
run seed:careers
run import:knowledge -- content/customer/*.json

echo
echo "after:  $(counts "$TARGET")"
if [ "${DRY:-0}" = "1" ]; then echo "Rehearsal finished. Nothing was changed on the live database."; else echo "Done. Backup: $KEEP"; fi
