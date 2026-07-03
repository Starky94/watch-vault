#!/usr/bin/env bash

set -euo pipefail

readonly EXPECTED_REPO_NAME="watchvault"
readonly REMOTE_HOST="root@46.101.143.222"
readonly REMOTE_DIR="/var/www/watchvault-8181"
readonly REMOTE_TMP_ARCHIVE="/tmp/watchvault-8181.tar.gz"
readonly REMOTE_ENV_FILE=".env.production"
readonly COMPOSE_PROJECT="watchvault-8181"
readonly EXPECTED_PORT="8181"
readonly HEALTHCHECK_URL="http://127.0.0.1:${EXPECTED_PORT}/api/health"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE_PATH="$(mktemp /tmp/watchvault-8181.XXXXXX.tar.gz)"

cleanup() {
  rm -f "$ARCHIVE_PATH"
}

trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command ssh
require_command scp
require_command tar
require_command curl
require_command python3

cd "$ROOT_DIR"

repo_name="$(basename "$ROOT_DIR")"
if [[ "$repo_name" != "$EXPECTED_REPO_NAME" ]]; then
  echo "This script only deploys the ${EXPECTED_REPO_NAME} repository." >&2
  exit 1
fi

if ! python3 - <<'PY'
import json
from pathlib import Path

package = json.loads(Path("package.json").read_text())
if package.get("name") != "watchvault":
    raise SystemExit(1)
PY
then
  echo "package.json is not locked to the watchvault project." >&2
  exit 1
fi

if [[ ! -f "docker-compose.yml" ]]; then
  echo "docker-compose.yml is required." >&2
  exit 1
fi

echo "Creating release archive for ${EXPECTED_REPO_NAME}..."
tar -czf "$ARCHIVE_PATH" \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude .env \
  --exclude .env.production \
  --exclude '.codex-*.png' \
  -C "$ROOT_DIR" .

echo "Preparing ${REMOTE_HOST}:${REMOTE_DIR}..."
ssh "$REMOTE_HOST" "mkdir -p '$REMOTE_DIR'"

echo "Uploading release archive..."
scp "$ARCHIVE_PATH" "${REMOTE_HOST}:${REMOTE_TMP_ARCHIVE}"

echo "Deploying ${COMPOSE_PROJECT} on port ${EXPECTED_PORT}..."
ssh "$REMOTE_HOST" "
  set -euo pipefail
  cd '$REMOTE_DIR'

  if [[ ! -f '$REMOTE_ENV_FILE' ]]; then
    echo 'Missing ${REMOTE_ENV_FILE} in ${REMOTE_DIR}. Aborting.' >&2
    exit 1
  fi

  if ! grep -q '^WEB_PORT=${EXPECTED_PORT}\$' '$REMOTE_ENV_FILE'; then
    echo 'Expected WEB_PORT=${EXPECTED_PORT} in ${REMOTE_ENV_FILE}. Aborting.' >&2
    exit 1
  fi

  if ! grep -q '^APP_ENV_FILE=${REMOTE_ENV_FILE}\$' '$REMOTE_ENV_FILE'; then
    echo 'Expected APP_ENV_FILE=${REMOTE_ENV_FILE} in ${REMOTE_ENV_FILE}. Aborting.' >&2
    exit 1
  fi

  if ! grep -q '^DATABASE_URL=postgresql://postgres:postgres@db:5432/watchvault\$' '$REMOTE_ENV_FILE'; then
    echo 'Expected isolated Docker DATABASE_URL in ${REMOTE_ENV_FILE}. Aborting.' >&2
    exit 1
  fi

  tar -xzf '$REMOTE_TMP_ARCHIVE' -C '$REMOTE_DIR'
  docker compose --env-file '$REMOTE_ENV_FILE' -p '$COMPOSE_PROJECT' up -d --build
  rm -f '$REMOTE_TMP_ARCHIVE'
"

echo "Waiting for ${HEALTHCHECK_URL}..."
for attempt in {1..20}; do
  if ssh "$REMOTE_HOST" "curl -fsS '$HEALTHCHECK_URL'" >/dev/null 2>&1; then
    break
  fi

  if [[ "$attempt" -eq 20 ]]; then
    echo "Deployment finished, but the health check did not succeed." >&2
    exit 1
  fi

  sleep 3
done

echo "Deployment succeeded for ${EXPECTED_REPO_NAME} on ${REMOTE_HOST}:${EXPECTED_PORT}."
