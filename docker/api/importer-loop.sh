#!/bin/sh

set -u

interval_seconds="${IMPORT_INTERVAL_SECONDS:-600}"
import_command="${IMPORT_COMMAND:-npm run import:movies}"

handle_shutdown() {
  echo "Importer received shutdown signal, exiting."
  exit 0
}

trap handle_shutdown INT TERM

while true
do
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting import: ${import_command}."

  if sh -c "$import_command"; then
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Import completed."
  else
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Import failed; retrying after sleep."
  fi

  sleep "$interval_seconds" &
  wait $!
done
