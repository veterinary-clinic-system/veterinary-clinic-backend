#!/usr/bin/env bash

set -euo pipefail

CONTAINER="${DB_CONTAINER:-veterinary-clinic-postgres}"
DB_USER="${DB_USERNAME:-vetclinic}"
DB_NAME="${DB_DATABASE:-veterinary_clinic}"
BACKUP_DIR="${1:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/${DB_NAME}-${STAMP}.dump"

if ! docker ps --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
  echo "LỖI: container '${CONTAINER}' không chạy. Chạy hạ tầng trước:" >&2
  echo "  cd ../veterinary-clinic-environment && docker compose up -d" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

echo "Đang sao lưu ${DB_NAME} từ container ${CONTAINER}..."

docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc > "${TARGET}"

SIZE="$(du -h "${TARGET}" | cut -f1)"
echo "Xong: ${TARGET} (${SIZE})"

if ! pg_restore --list "${TARGET}" > /dev/null 2>&1; then
  if ! docker exec -i "${CONTAINER}" pg_restore --list < "${TARGET}" > /dev/null 2>&1; then
    echo "CẢNH BÁO: không đọc được mục lục của file vừa tạo — bản sao lưu có thể hỏng." >&2
    exit 2
  fi
fi
echo "Đã kiểm tra: file đọc được."

if [ "${RETENTION_DAYS}" -gt 0 ]; then
  DELETED="$(find "${BACKUP_DIR}" -name "${DB_NAME}-*.dump" -type f -mtime "+${RETENTION_DAYS}" -print -delete | wc -l)"
  if [ "${DELETED}" -gt 0 ]; then
    echo "Đã xóa ${DELETED} bản sao lưu cũ hơn ${RETENTION_DAYS} ngày."
  fi
fi
