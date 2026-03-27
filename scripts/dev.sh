#!/usr/bin/env sh
set -e
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[dev] Directory: $ROOT_DIR"
echo "[dev] Installing dependencies..."
npm install

echo "[dev] OK. Tables are created on first server start (db.js)."
echo "[dev] Optional demo data: npm run seed"
echo "[dev] Start server: npm start"
echo "[dev] Run tests: npm test"
