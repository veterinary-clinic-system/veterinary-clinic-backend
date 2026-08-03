# Build context la THU MUC GOC cua monorepo (xem docker-compose.yml), khong phai apps/veterinary-clinic-backend,
# vi apps/veterinary-clinic-backend phu thuoc packages/contracts qua npm workspaces.
# Khong bat buoc cho phat trien hang ngay (uu tien `npm run dev:api` tren host),
# chi de `docker compose --profile full up` chay duoc tron bo.

FROM node:20-alpine AS build
WORKDIR /repo

# Copy rieng manifest truoc de tan dung cache layer cua Docker: doi source khong
# lam mat cache cua buoc npm install.
COPY package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/veterinary-clinic-backend/package.json apps/veterinary-clinic-backend/
RUN npm install --workspace @vetcare/api --workspace @vetcare/contracts --include-workspace-root

COPY packages/contracts packages/contracts
COPY apps/veterinary-clinic-backend apps/veterinary-clinic-backend
RUN npm run build --workspace @vetcare/contracts \
 && npm run build --workspace @vetcare/api

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/veterinary-clinic-backend/package.json apps/veterinary-clinic-backend/
RUN npm install --omit=dev --workspace @vetcare/api --workspace @vetcare/contracts --include-workspace-root

COPY --from=build /repo/packages/contracts/dist packages/contracts/dist
COPY --from=build /repo/apps/veterinary-clinic-backend/dist apps/veterinary-clinic-backend/dist

EXPOSE 3000
CMD ["node", "apps/veterinary-clinic-backend/dist/main.js"]
