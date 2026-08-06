#!/usr/bin/env bash
#
# Sao lưu cơ sở dữ liệu VCMS — NFR-03 (P10-T7).
#
# Chạy `pg_dump` BÊN TRONG container Postgres chứ không từ host: như vậy phiên bản
# `pg_dump` luôn khớp phiên bản máy chủ, và máy chạy lệnh không cần cài client
# PostgreSQL. Trên máy dev này việc đó còn quan trọng hơn bình thường — host có sẵn
# một PostgreSQL 18 cài trực tiếp, còn container là 16; `pg_dump` 16 không đọc được
# server 18 nhưng bản 18 lại tạo ra file dump mà server 16 từ chối nạp.
#
# Định dạng `custom` (-Fc) chứ không phải SQL thuần: nén sẵn, và `pg_restore` khôi
# phục song song được cũng như chọn lọc được từng bảng khi cần.
#
# Cách dùng:
#   ./scripts/backup-db.sh [thư-mục-đích]
#
# Khôi phục: xem HUONG-DAN-CHAY.md, mục "Sao lưu và khôi phục".

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
# Ghi ra stdout rồi chuyển hướng vào file trên host — không để lại file tạm bên trong
# container, nên không cần dọn và cũng không làm đầy ổ đĩa của container.
docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc > "${TARGET}"

SIZE="$(du -h "${TARGET}" | cut -f1)"
echo "Xong: ${TARGET} (${SIZE})"

# Một bản sao lưu chưa bao giờ được kiểm tra thì chưa phải là bản sao lưu. `pg_restore
# --list` đọc mục lục của file — nó phát hiện ngay file rỗng hoặc bị cắt cụt, thứ mà
# `pg_dump` trả về mã 0 vẫn có thể để lại nếu ổ đĩa đầy giữa chừng.
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
