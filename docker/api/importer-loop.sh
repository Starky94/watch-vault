#!/bin/sh

set -u

interval_seconds="${IMPORT_INTERVAL_SECONDS:-600}"
import_command="${IMPORT_COMMAND:-npm run import:movies}"
admin_job_key="${ADMIN_JOB_KEY:-}"

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
    if [ -n "$admin_job_key" ]; then
      node server/recordAdminJobExecutionCli.js "$admin_job_key"
    fi
  else
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Import failed; retrying after sleep."
  fi

  sleep "$interval_seconds" &
  wait $!
done
