# HabitLoop 🔁

습관 트래커 + 소셜. 매일 습관 체크인하고, 스트릭 쌓고, 팔로우한 친구들 체크인 피드 보고 응원(좋아요).

## Stack

| Layer    | Tech                                         |
| -------- | --------------------------------------------- |
| Web      | Next.js 14 (App Router, SSR) + React + TS     |
| Mobile   | React Native (Expo) — same API as web         |
| Backend  | NestJS + TypeORM + JWT auth                   |
| DB       | MySQL 8                                       |
| Infra    | Docker Compose (api + web + mysql)            |
| CI/CD    | GitHub Actions — lint/test/build → GHCR image |

## Monorepo layout

```
apps/
  api/     NestJS REST API (port 3001)
  web/     Next.js SSR web app (port 3000)
  mobile/  Expo React Native app
```

## Local dev

```bash
docker compose up -d mysql
cd apps/api && npm install && npm run start:dev
cd apps/web && npm install && npm run dev
cd apps/mobile && npm install && npx expo start
```

Or full stack via Docker:

```bash
docker compose up --build
```

Web: http://localhost:3000 · API: http://localhost:3001 · Swagger: http://localhost:3001/docs

## Core features (MVP)

- JWT 회원가입/로그인
- 습관 생성/조회, 매일 체크인, 연속일(streak) 계산
- 팔로우, 팔로우한 유저들의 체크인 피드, 좋아요

## CI/CD

- `ci.yml`: PR/push 시 api·web 빌드 + lint 실행
- `cd.yml`: main 브랜치 push 시 api·web Docker 이미지를 GHCR(ghcr.io)에 빌드/푸시. 실서버 배포 스텝은 대상 서버·시크릿이 정해지면 `deploy` job에 SSH/ECS 등 추가하면 됨 (현재는 이미지 publish까지).

## Env

`apps/api/.env` (see `.env.example`), `apps/web/.env.local` (see `.env.local.example`).
