# Multi-stage build for the veterinary-clinic-backend NestJS app.
# Not required for day-to-day development (prefer `npm run start:dev` on the host),
# but lets the whole stack run via `docker compose --profile full up`.

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["node", "dist/main.js"]
