# =============================================================
# 開発用ステージ（docker compose up で使うのはこちら）
#   ホストのソースをバインドマウントし、変更を検知して自動再起動する。
#   Windows/macOS のバインドマウントでは inotify イベントがコンテナ内に
#   伝わらないため、nodemon のポーリング監視（--legacy-watch）を使う。
# =============================================================
FROM node:22-alpine AS development

WORKDIR /app

# package.json だけ先にコピーして npm ci を実行することで、
# ソースを書き換えただけの再ビルドでは依存関係の再インストールが走らない
# （Docker のレイヤーキャッシュが効く）。
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3001
CMD ["npm", "run", "dev:docker"]


# =============================================================
# 本番用ビルドステージ（VPS デプロイ時に使う）
# =============================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build


# =============================================================
# 本番実行ステージ
#   ビルド成果物と本番依存だけを載せた軽量イメージ。
#   root ではなく node ユーザーで動かす（セキュリティ）。
# =============================================================
FROM node:22-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 3001
CMD ["node", "dist/server.js"]
