#!/usr/bin/env sh
set -e
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

export NODE_ENV=production
echo "[prod] NODE_ENV=$NODE_ENV"
echo "[prod] Starting server.js ..."
exec node server.js
