#!/usr/bin/env bash
#
# One-command production deploy of G2 Hub (VPS + PM2).
#
# Usage (on the VPS):   cd ~/g2-hub && git pull && ./scripts/deploy.sh
#
# Install deps, regenerate the Prisma client, APPLY MIGRATIONS (before building), build the
# console, then restart PM2. Safe to run on every deploy: each step is a no-op when nothing
# changed. It deliberately does NOT `git pull` (you pull first, so you can read the diff).
#
# Requires: node 24+, pnpm, pm2 (run as the deploy user, no sudo). The secrets live in the root
# .env, loaded by the console through `--env-file` (see the pm2 start command below).

set -euo pipefail

# Always operate from the repo root (this script lives in scripts/).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APP=g2-hub
PORT=3010

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }

# Guards: right folder, pm2 available, configuration present.
[ -f pnpm-workspace.yaml ] || { echo "✗ pnpm-workspace.yaml introuvable : mauvais dossier ?"; exit 1; }
command -v pm2 >/dev/null || { echo "✗ pm2 introuvable dans le PATH."; exit 1; }
[ -f .env ] || { echo "✗ .env introuvable dans $ROOT."; exit 1; }

echo "Déploiement de $(git rev-parse --short HEAD 2>/dev/null || echo '?') dans $ROOT"

step "1/5 · Dépendances (pnpm install)"
# pnpm skips the install ("Already up to date") when no package.json changed, WITHOUT reading
# the lockfile: a dependency bumped only in pnpm-lock.yaml would never be fetched. Dropping its
# state file forces a real check.
rm -f node_modules/.pnpm-workspace-state-v1.json
pnpm install --frozen-lockfile

step "2/5 · Client Prisma (db:generate)"
pnpm db:generate

step "3/5 · Migrations (migrate deploy)"
# Applies only committed migrations, never resets. Runs BEFORE the build: a schema failure
# aborts here and the running version stays untouched.
pnpm db:deploy

step "4/5 · Build de la console"
# adapter-node empties apps/console/build itself before writing the new output.
pnpm --filter console build

step "5/5 · Redémarrage PM2"
if pm2 describe "$APP" >/dev/null 2>&1; then
	pm2 restart "$APP"
else
	# First deploy: ONE instance (never -i max: the process also runs the single video worker).
	(cd apps/console && pm2 start build/index.js --name "$APP" --node-args="--env-file=$ROOT/.env")
fi
pm2 save

step "Vérifications"
pm2 list

# Liveness check: the console answers /login with 200 whatever the auth state; "000" (no reply)
# means it is not listening yet, so retry for a few seconds while it starts.
code=000
for _ in 1 2 3 4 5; do
	sleep 2
	code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT/login" 2>/dev/null || true)
	[ "$code" != "000" ] && break
done
if [ "$code" = "200" ]; then
	echo "· console : ✓ HTTP $code"
else
	echo "· console : ✗ HTTP $code. Voir : pm2 logs $APP --lines 50 --nostream"
	exit 1
fi

printf '\n\033[1;32m✓ Déploiement terminé.\033[0m Sur ton PC : pnpm api:prod\n'
