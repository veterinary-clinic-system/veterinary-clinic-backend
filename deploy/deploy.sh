#!/usr/bin/env bash
# Deploy mot service (api | worker | ai) bang image da build san tren GHCR.
# GitHub Actions goi qua SSH sau khi `git pull` repo backend; cung chay tay duoc:
#   GHCR_USER=<github user> GHCR_TOKEN=<token read:packages> bash deploy/deploy.sh api
# Khong co GHCR_TOKEN thi dung thong tin `docker login ghcr.io` da luu tren may chu.
set -euo pipefail

service="${1:?Usage: deploy.sh <api|worker|ai>}"
case "$service" in
  api) repo=veterinary-clinic-backend ;;
  worker) repo=worker ;;
  ai) repo=veterinary-clinic-ai ;;
  *)
    echo "Unknown service: $service" >&2
    exit 2
    ;;
esac

cd "$(dirname "$0")/.."
compose=(docker compose --env-file prod.env -f docker-compose.prod.yml)

# `config --images` liet ke ca cac service phu thuoc, nen loc dung image cua repo nay.
image="$("${compose[@]}" config --images "$service" | grep -m1 -E "^ghcr\.io/[^/]+/${repo}[:@]" || true)"
if [[ -z "$image" ]]; then
  echo "Service $service is not mapped to a GHCR image yet (pull the new docker-compose.prod.yml)." >&2
  exit 1
fi

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:?GHCR_USER is required}" --password-stdin
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
fi

echo "==> Pulling $image"
"${compose[@]}" pull "$service"

echo "==> Restarting $service"
# --no-deps: Postgres/Redis va cac service khac giu nguyen, chi thay container nay.
"${compose[@]}" up -d --no-build --no-deps "$service"

container="$("${compose[@]}" ps -q "$service")"
has_health="$(docker inspect -f '{{if .State.Health}}yes{{end}}' "$container")"
if [[ "$has_health" == yes ]]; then
  echo "==> Waiting for $service to become healthy"
  for _ in $(seq 1 30); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$container")"
    if [[ "$status" == healthy ]]; then break; fi
    if [[ "$status" == unhealthy ]]; then break; fi
    sleep 10
  done
  if [[ "$status" != healthy ]]; then
    echo "$service is $status after deploy:" >&2
    "${compose[@]}" logs --tail 100 "$service" >&2
    exit 1
  fi
else
  sleep 15
  if [[ "$(docker inspect -f '{{.State.Running}}' "$container")" != true ]]; then
    echo "$service is not running after deploy:" >&2
    "${compose[@]}" logs --tail 100 "$service" >&2
    exit 1
  fi
fi

docker image prune -f >/dev/null
echo "==> $service deployed: $image"
