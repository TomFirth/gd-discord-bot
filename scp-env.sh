#!/usr/bin/env bash

set -euo pipefail

LOCAL_ENV_FILE=".env"
REMOTE_USER="barber"
REMOTE_HOST="192.168.1.81"
REMOTE_PATH="/home/barber/gd-discord-bot/.env"

if [[ ! -f "$LOCAL_ENV_FILE" ]]; then
  echo "Error: $LOCAL_ENV_FILE not found in $(pwd)"
  exit 1
fi

echo "Uploading $LOCAL_ENV_FILE to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
scp "$LOCAL_ENV_FILE" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"

echo "Upload complete."
