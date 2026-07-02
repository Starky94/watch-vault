#!/bin/sh

set -u

interval_seconds="${IMPORT_INTERVAL_SECONDS:-600}"

handle_shutdown() {
  echo "Importer received shutdown signal, exiting."
  exit 0
}

trap handle_shutdown INT TERM

while true
do
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting TMDB import."

  if npm run import:movies; then
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] TMDB import completed."
  else
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] TMDB import failed; retrying after sleep."
  fi

  sleep "$interval_seconds" &
  wait $!
done
