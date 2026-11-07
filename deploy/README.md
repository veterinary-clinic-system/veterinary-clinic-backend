# Deploy (CI/CD)

| Repo | CI (mỗi push/PR) | CD (push lên `master` hoặc Run workflow) |
|---|---|---|
| veterinary-clinic-backend | typecheck, eslint, unit test, build, migration, e2e | image `ghcr.io/veterinary-clinic-system/veterinary-clinic-backend` → `deploy.sh api` |
| worker | typecheck, test, build | image `ghcr.io/veterinary-clinic-system/worker` → `deploy.sh worker` |
| veterinary-clinic-ai | pip install, compileall, import thử | image `ghcr.io/veterinary-clinic-system/veterinary-clinic-ai` → `deploy.sh ai` |
| veterinary-clinic-web | typecheck, test, build | Cloudflare Pages tự build nhánh `master` |
| veterinary-clinic-mobile | tsc, expo lint | `eas update` lên channel `preview` (production: Run workflow) |

Máy chủ **không build nữa**: GitHub Actions build image, đẩy lên GHCR, rồi SSH vào Lightsail
chạy `git pull` repo backend + `bash deploy/deploy.sh <service>`. Script kéo image mới, thay
đúng một container (`--no-deps`), chờ healthcheck; lỗi thì in log và làm job đỏ. Migration
vẫn tự chạy khi container api khởi động (`npm run start:prod`).

## Cài đặt một lần

1. **Khoá SSH**: Lightsail → Account → SSH keys → tải khoá mặc định của region (file `.pem`),
   hoặc tạo cặp khoá riêng rồi thêm public key vào `~/.ssh/authorized_keys` trên máy chủ.
2. **Secret/biến trên GitHub** — đặt ở cấp organization `veterinary-clinic-system`
   (Settings → Secrets and variables → Actions) để cả ba repo dùng chung:
   - Secret `LIGHTSAIL_SSH_KEY`: toàn bộ nội dung file `.pem`.
   - Variable `LIGHTSAIL_HOST`: `56.10.17.12`.
   - Variable `LIGHTSAIL_USER` (tuỳ chọn, mặc định `ubuntu`).
   - Variable `VCMS_DIR` (tuỳ chọn, mặc định `~/vcms/veterinary-clinic-backend`): thư mục
     chứa `docker-compose.prod.yml` trên máy chủ.

   Chưa đặt `LIGHTSAIL_SSH_KEY`/`LIGHTSAIL_HOST` thì job deploy chỉ ghi chú "bỏ qua", không đỏ.
3. **Máy chủ** phải `git pull` được repo backend không cần nhập mật khẩu (deploy key hoặc
   credential đã lưu), và repo ở nhánh `master` không có sửa đổi cục bộ.
4. **Mobile**: tạo token ở expo.dev → Access tokens, lưu thành secret `EXPO_TOKEN` của repo
   mobile.
5. (Tuỳ chọn) GitHub → repo → Settings → Environments → `production`: bật *Required
   reviewers* nếu muốn duyệt tay trước mỗi lần deploy.

Lần deploy đầu tiên nên chạy backend trước: nó kéo `docker-compose.prod.yml` mới (có dòng
`image: ghcr.io/...`). `deploy.sh` từ chối chạy nếu service chưa trỏ vào GHCR.

## Rollback

Mỗi image có hai tag: `latest` và SHA của commit. Ghim bản cũ trong `prod.env`, ví dụ
`API_IMAGE=ghcr.io/veterinary-clinic-system/veterinary-clinic-backend:<sha>`, rồi chạy
`bash deploy/deploy.sh api` trên máy chủ (cần `docker login ghcr.io` bằng token
`read:packages` nếu không chạy qua Actions). Xoá dòng đó để quay về `latest`.
