#!/usr/bin/env bash
# Usage: deploy/deploy.sh   (from repo root; uses ssh host alias gglink-live)
set -euo pipefail
HOST=gglink-live
DIR=/var/www/gglearn.gglink.co.uk

rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude 'data/*.db*' --exclude '.env*' \
  ./ "$HOST:$DIR/"

# The server's login shell is fish, which cannot parse bash grouping or &&/|| chains, so the remote
# steps are piped into bash. There is deliberately no `--force` on drizzle-kit push: when a schema
# change would delete rows (for example a NOT NULL column added to a table that has data) it must stop
# and fail the deploy instead of running `delete from <table>`.
ssh "$HOST" "bash -s" <<REMOTE
set -euo pipefail
exec 9>/tmp/gglearn-deploy.lock
flock -n 9 || { echo "another deploy is already running on the server" >&2; exit 1; }
cd $DIR
npm ci
# drizzle-kit exits 0 even when it refuses to apply a change (a data-loss warning, or no terminal to ask its question in), so read what it said.
# A push that did not apply must stop the deploy here, before the build and the restart: new code running on an old database takes pages down.
out=\$(npx drizzle-kit push 2>&1) || { echo "\$out" >&2; exit 1; }
echo "\$out"
if echo "\$out" | grep -qE "Found data-loss|Interactive prompts require|^Error"; then
  echo "drizzle-kit push did not apply the schema change: stopping before the build and the restart (the running app is untouched)" >&2
  exit 1
fi
npm run build
pm2 startOrRestart ecosystem.config.cjs
pm2 save
# fail the deploy if the app does not come back
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3400/ || true)
  [ "\$code" = "200" ] && { echo "app is up (HTTP 200)"; exit 0; }
  sleep 3
done
echo "app did not return HTTP 200 after deploy (last code: \$code)" >&2
pm2 logs gglearn-web --lines 20 --nostream --err >&2 || true
exit 1
REMOTE
