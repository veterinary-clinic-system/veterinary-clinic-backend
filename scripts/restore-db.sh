#!/usr/bin/env bash

set -euo pipefail

CONTAINER="${DB_CONTAINER:-veterinary-clinic-postgres}"
DB_USER="${DB_USERNAME:-vetclinic}"
DB_NAME="${DB_DATABASE:-veterinary_clinic}"
DUMP_FILE="${1:-}"

if [ -z "${DUMP_FILE}" ] || [ ! -f "${DUMP_FILE}" ]; then
  echo "Cách dùng: $0 <đường-dẫn-file.dump>" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
  echo "LỖI: container '${CONTAINER}' không chạy." >&2
  exit 1
fi

echo "Sắp khôi phục '${DB_NAME}' từ ${DUMP_FILE}."
echo "TOÀN BỘ dữ liệu hiện tại của '${DB_NAME}' sẽ bị xóa."
printf "Gõ đúng tên cơ sở dữ liệu để xác nhận: "
read -r CONFIRM
if [ "${CONFIRM}" != "${DB_NAME}" ]; then
  echo "Đã hủy."
  exit 1
fi

echo "Đang ngắt các kết nối hiện có..."
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" > /dev/null

echo "Đang tạo lại cơ sở dữ liệu rỗng..."
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";"
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d postgres -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\";"

echo "Đang nạp dữ liệu..."

docker exec -i "${CONTAINER}" pg_restore -U "${DB_USER}" -d "${DB_NAME}" --no-owner < "${DUMP_FILE}"

echo "Đang kiểm tra..."
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c \
  "SELECT count(*) AS so_bang FROM information_schema.tables WHERE table_schema = 'public';"
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c \
  "SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1;"

echo "Khôi phục xong. Khởi động lại backend để nó mở lại pool kết nối."
