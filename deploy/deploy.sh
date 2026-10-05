#!/usr/bin/env bash
# Usage: deploy/deploy.sh   (from repo root; uses ssh host alias gglink-live)
set -euo pipefail
HOST=gglink-live
DIR=/var/www/gglearn.gglink.co.uk

rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude 'data/*.db*' --exclude '.env*' \
  ./ "$HOST:$DIR/"

ssh "$HOST" "cd $DIR && npm ci && npx drizzle-kit push --force && npm run build && \
  (pm2 describe gglearn-web >/dev/null 2>&1 && pm2 reload gglearn-web || pm2 start ecosystem.config.cjs) && pm2 save"
