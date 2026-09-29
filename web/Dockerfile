# syntax=docker/dockerfile:1
# 빌드 컨텍스트는 저장소 루트 (공용 패키지 packages/shared 가 필요하다)
FROM node:22-alpine AS build
WORKDIR /app
# 의존성 정의만 먼저 복사해서, 코드만 바뀌었을 때는 npm ci 레이어를 재사용한다
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY api/package.json api/
COPY web/package.json web/
COPY mobile/package.json mobile/
RUN --mount=type=cache,target=/root/.npm npm ci -w web --include-workspace-root
COPY packages/shared packages/shared
COPY web web
RUN npm run build -w web \
    # 미리 압축해 두면 nginx 가 요청마다 압축하지 않고 gzip_static 으로 바로 내려준다
    && find web/dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' \) -exec gzip -9 -k {} \;

FROM nginx:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
