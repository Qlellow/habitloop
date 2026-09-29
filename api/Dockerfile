# syntax=docker/dockerfile:1
# 빌드 컨텍스트는 저장소 루트 (npm 워크스페이스의 package-lock.json 을 같이 쓴다)
#   docker build -f api/Dockerfile .

# 1) 실행에 필요한 의존성만
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY api/package.json api/
COPY web/package.json web/
COPY mobile/package.json mobile/
RUN --mount=type=cache,target=/root/.npm mkdir -p api/node_modules \
    && npm ci -w api --include-workspace-root --omit=dev --ignore-scripts

# 2) 빌드 (TypeScript → dist)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY api/package.json api/
COPY web/package.json web/
COPY mobile/package.json mobile/
RUN --mount=type=cache,target=/root/.npm npm ci -w api --include-workspace-root --ignore-scripts
COPY api api
RUN npm run build -w api

# 3) 실행
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/api/node_modules ./api/node_modules
COPY --from=build /app/api/dist ./api/dist
COPY api/package.json ./api/
USER node
EXPOSE 3000
CMD ["node", "api/dist/main.js"]
