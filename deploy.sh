#!/usr/bin/env bash
# Выкладка dist на сервер по rsync/SSH.
# Переменные (опционально): DEPLOY_USER, DEPLOY_HOST, DEPLOY_PATH
set -euo pipefail

ROOT="$(pwd)"
DIST="${ROOT}/dist"

DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_HOST="${DEPLOY_HOST:-ars-dev.ru}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/html/matrix-react/}"

if [[ ! -d "${DIST}" ]]; then
  echo "Нет каталога dist. Сначала выполните: npm run build" >&2
  exit 1
fi

echo "→ ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
rsync -avz --delete "${DIST}/" "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
echo "Готово."
