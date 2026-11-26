#!/usr/bin/env bash
# Usage: deploy/deploy.sh   (from repo root; uses ssh host alias gglink-live)
#
# Copies the code beside the running site (<live dir>/.build), then runs deploy/remote.sh there: install, schema push and build while the old version
# keeps serving, then a quick switch and restart. See that file for what happens when a step fails.
set -euo pipefail
HOST=gglink-live
DIR=/var/www/gglearn.gglink.co.uk

rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude '.env*' \
  --exclude /data --exclude '/.next-*' \
  ./ "$HOST:$DIR/.build/"

# The server's login shell is fish, which cannot parse bash grouping or &&/|| chains, so the remote steps are piped into bash.
ssh "$HOST" "bash -s -- $DIR" < deploy/remote.sh
