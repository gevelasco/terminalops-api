FROM node:20-alpine AS builder
WORKDIR /app

ENV NODE_OPTIONS="--max_old_space_size=2048"

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app

ENV NODE_OPTIONS="--max_old_space_size=1024"

RUN apk add --no-cache netcat-openbsd

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY config ./config
COPY db ./db

COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENV NODE_ENV=production
EXPOSE 4000
CMD ["./entrypoint.sh"]
