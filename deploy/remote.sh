#!/usr/bin/env bash
# Runs ON THE SERVER (deploy.sh pipes it in). Usage: bash -s -- <live dir>
#
# The new version is installed and built in <live dir>/.build while the old one keeps serving. Only when that has worked are the built files switched into
# the live folder and the app restarted, so people see the site pause for the few seconds of a restart instead of failing for the whole build. A failed
# install or build leaves the running site untouched; a new version that does not answer after the restart is swapped back for the old one.
#
# PM2, APP_URL, MIN_FREE_KB, LOCK and TRIES can be overridden, which is how the script is rehearsed away from the server.
set -euo pipefail

DIR=${1:?usage: remote.sh <live dir>}
NEW="$DIR/.build"
PM2=${PM2:-pm2}
APP_URL=${APP_URL:-http://127.0.0.1:3400/}
MIN_FREE_KB=${MIN_FREE_KB:-2097152} # 2 GB: a second copy of the dependencies (about 700 MB), the build and its cache (about 500 MB) beside the live ones
LOCK=${LOCK:-/tmp/gglearn-deploy.lock}
TRIES=${TRIES:-10}

exec 9>"$LOCK"
flock -n 9 || { echo "another deploy is already running on the server" >&2; exit 1; }

[ -f "$NEW/package.json" ] || { echo "nothing to deploy: $NEW has no package.json" >&2; exit 1; }
free=$(df -Pk "$DIR" | awk 'NR==2 {print $4}')
if [ "$free" -lt "$MIN_FREE_KB" ]; then
  echo "not enough disk space to build beside the running site: ${free} KB free, ${MIN_FREE_KB} KB wanted. Nothing was changed." >&2
  exit 1
fi

cd "$NEW"
# the build uses the live settings and the live database, exactly as the running app does
for f in "$DIR"/.env*; do [ -f "$f" ] && cp -p "$f" .; done
# The database is named by its full path rather than linked into this folder: the build refuses a link that leads outside it. A DATABASE_FILE set in the
# settings still wins, and a relative one means relative to the live folder.
db=${DATABASE_FILE:-}
if [ -z "$db" ] && [ -f "$DIR/.env.local" ]; then
  db=$(sed -n 's/^DATABASE_FILE=//p' "$DIR/.env.local" | tail -1)
  db=${db%\"}; db=${db#\"}
fi
db=${db:-data/gglearn.db}
case $db in /*) ;; *) db="$DIR/$db" ;; esac
mkdir -p "$(dirname "$db")"
export DATABASE_FILE="$db"
echo "database: $DATABASE_FILE"

npm ci

# drizzle-kit exits 0 even when it refuses to apply a change (a data-loss warning, or no terminal to ask its question in), so read what it said.
# A push that did not apply must stop the deploy here, before the build and the switch: new code running on an old database takes pages down.
# There is deliberately no `--force`: when a schema change would delete rows (for example a NOT NULL column added to a table that has data) it must stop
# and fail the deploy instead of running `delete from <table>`.
out=$(npx drizzle-kit push 2>&1) || { echo "$out" >&2; exit 1; }
echo "$out"
if echo "$out" | grep -qE "Found data-loss|Interactive prompts require|^Error|SqliteError|SQLITE_"; then
  echo "drizzle-kit push did not apply the schema change: stopping before the build and the switch (the running app is untouched)" >&2
  exit 1
fi

# the build cache is kept between deploys, so each build starts where the last one finished
rm -rf .next
if [ -d .next-cache ]; then mkdir .next && mv .next-cache .next/cache; fi
npm run build
[ -f .next/BUILD_ID ] || { echo "the build left no .next/BUILD_ID: the running app is untouched" >&2; exit 1; }
if [ -d .next/cache ]; then mv .next/cache .next-cache; fi

# ---- switch: from here the live folder changes
cd "$DIR"
rm -rf "$DIR/.next-old" "$DIR/node_modules-old" "$DIR/.next-failed" "$DIR/node_modules-failed"
# the source the app reads while running (content, fonts) and the files the other jobs and Apache use
rsync -a --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude '.env*' \
  --exclude /data --exclude /.build --exclude '/.next-*' --exclude '/node_modules-*' \
  "$NEW/" "$DIR/"

# the app reads its own settings: nothing set here for the build is passed on to it
restart() { env -u DATABASE_FILE "$PM2" startOrRestart ecosystem.config.cjs; }
answers() {
  local code=""
  for _ in $(seq 1 "$TRIES"); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$APP_URL" || true)
    [ "$code" = "200" ] && return 0
    sleep 3
  done
  echo "no HTTP 200 from $APP_URL (last code: $code)" >&2
  return 1
}

# renames within one folder are instant: the old files stay beside the new ones until the new ones have answered
for part in node_modules .next; do
  if [ -d "$DIR/$part" ]; then mv "$DIR/$part" "$DIR/$part-old"; fi
  mv "$NEW/$part" "$DIR/$part"
done

if restart && answers; then
  "$PM2" save
  rm -rf "$DIR/.next-old" "$DIR/node_modules-old"
  echo "app is up (HTTP 200)"
  exit 0
fi

echo "the new version did not come up" >&2
"$PM2" logs gglearn-web --lines 20 --nostream --err >&2 || true
if [ -d "$DIR/.next-old" ] && [ -d "$DIR/node_modules-old" ]; then
  echo "putting the previous version back" >&2
  for part in node_modules .next; do
    mv "$DIR/$part" "$DIR/$part-failed"
    mv "$DIR/$part-old" "$DIR/$part"
  done
  if restart && answers; then echo "the previous version is running again; this deploy FAILED" >&2
  else echo "the previous version did not come up either: look at the server now" >&2; fi
else
  echo "there is no previous version to put back: look at the server now" >&2
fi
exit 1
