#!/usr/bin/env bash

set -euo pipefail

LOCAL_ENV_FILE=".env"
LOCAL_CREDENTIALS_FILE="credentials.json"
REMOTE_USER="barber"
REMOTE_HOST="192.168.1.81"
REMOTE_PATH="/home/barber/gd-discord-bot"
REMOTE_ENV_PATH="${REMOTE_PATH}/.env"
REMOTE_CREDENTIALS_PATH="${REMOTE_PATH}/credentials.json"

if [[ ! -f "$LOCAL_ENV_FILE" ]]; then
  echo "Error: $LOCAL_ENV_FILE not found in $(pwd)"
  exit 1
fi

if [[ ! -f "$LOCAL_CREDENTIALS_FILE" ]]; then
  echo "Error: $LOCAL_CREDENTIALS_FILE not found in $(pwd)"
  exit 1
fi

echo "Uploading $LOCAL_ENV_FILE to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_ENV_PATH}"
scp "$LOCAL_ENV_FILE" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_ENV_PATH}"

echo "Uploading $LOCAL_CREDENTIALS_FILE to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_CREDENTIALS_PATH}"
scp "$LOCAL_CREDENTIALS_FILE" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_CREDENTIALS_PATH}"

echo "Upload complete."
