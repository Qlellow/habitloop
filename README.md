# 루프 커뮤니티

토스처럼 군더더기 없는 디자인의 커뮤니티 서비스입니다.

- **채널**: DC 갤러리나 아카라이브 채널처럼 누구나 주제별 공간(`/c/{주소}`)을 만들 수 있습니다. 만든 사람은 이름과 소개를 관리할 수 있습니다. 채널은 **가입제**라 가입한 사람만 글을 쓸 수 있고(글 보기·공감·댓글·댓글 좋아요는 누구나), 글은 **채널 안에서만** 쓸 수 있으며(채널 페이지의 글쓰기 버튼), 글쓰기 화면에서는 채널이 고정된 채 카테고리를 드롭다운으로 고릅니다.
- **채널 프로필·소개**: 채널을 만들 때 프로필 사진을 올릴 수 있습니다(브라우저에서 정사각형 256px 로 줄여 올리고, 주소에 버전을 붙여 1년 캐시). 채널의 짧은 영문 이름은 **고리**라고 부르며 주소(`/c/{고리}`)에 쓰입니다. 소개는 마크다운(최대 2000자)이고, 채널 헤더가 200px 을 넘으면 그라데이션과 함께 '더 보기'로 접힙니다.
- **채널 운영진**: 소유자가 멤버를 **관리자**(채널 정보·프로필·카테고리 관리) 또는 **매니저**(글·댓글 정리)로 지정합니다. 닉네임 오른쪽에 소유자 ★(노랑) · 관리자 ⚙(초록) · 매니저 🔧(파랑) 배지가 붙고, 운영진은 자기보다 아래 역할의 글·댓글만 지울 수 있습니다.
- **채널 카테고리**: 채널 소유자가 채널 안에 공지사항·소설·일러스트 같은 카테고리를 최대 20개까지 만들고, 이름 변경·삭제·순서 변경을 할 수 있습니다. **운영진만 글쓰기**로 설정한 카테고리(공지사항 등)는 운영진(소유자·관리자·매니저)만 글을 올릴 수 있습니다. 카테고리를 지워도 글은 남고 '카테고리 없음'이 됩니다.
- **마크다운 글쓰기**: 서식 툴바와 미리보기를 제공합니다. 렌더링 결과는 sanitize 해서 XSS 를 막습니다.
- **좋아요**: 글과 댓글 모두 누를 수 있습니다. 좋아요 2개 이상 받은 댓글 중 상위 3개는 **베스트 댓글**로 맨 위에 올라갑니다.
- **마이페이지**(`/me`): 왼쪽 메뉴에서 내가 쓴 글 · 가입/북마크한 채널 · 내 정보 수정(닉네임, 비밀번호) · 설정(테마, 글 목록 미리보기, 편집기 기본 보기)을 볼 수 있습니다. 채널은 가입과 별개로 ☆ 북마크할 수 있습니다.
- **채널 검색**: 상단 검색창에 입력하는 동안 채널 이름에 그 글자·단어가 들어간 채널이 드롭다운(최대 높이 360px, 안에서 스크롤)으로 바로 나옵니다. 이름이 검색어로 시작하는 채널이 먼저, 그다음 글이 많은 순입니다. ↑↓·Enter·Esc 로도 쓸 수 있습니다.
- **이메일 인증 · 2단계 인증**: 회원가입할 때 이메일로 받은 6자리 인증번호를 확인합니다. 설정에서 2단계 인증을 켜면(내 이메일로 받은 번호로 확인) 로그인할 때마다 비밀번호 다음에 메일로 받은 번호를 한 번 더 입력하고, 켜고 끌 때 알림 메일이 갑니다.
- 인기글(전체/채널별), 무한 스크롤, 라이트/다크 모드(시스템 설정 또는 직접 선택)를 지원합니다.

웹은 **넓은 화면용 웹사이트**로, 휴대폰은 **네이티브 앱(React Native)** 으로 따로 만들었습니다.
데이터를 다루는 코드(API 호출, 타입, 캐시·좋아요 같은 데이터 훅, 로그인 상태)는 `packages/shared` 에 한 번만 작성하고 웹과 앱이 함께 씁니다.

| 영역     | 기술                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| API      | **NestJS 11** · TypeScript · JWT · node-postgres (SQL 직접 작성)               |
| DB       | **Postgres** (운영: Neon · 로컬 개발/테스트: 메모리 Postgres PGlite, 설치 없이 실행) |
| Web      | React 19.2 · TypeScript · Vite 8 · TanStack Query · React Router 7 · **Tailwind CSS 3.4** |
| Mobile   | React Native 0.86 · **Expo SDK 57** · Expo Router · TanStack Query · **NativeWind 4** |
| Shared   | `@loop/shared` — API 클라이언트 · 타입 · 데이터 훅 · 인증 상태 (웹/앱 공용)    |
| Infra    | **Vercel** (웹 + API 서비스) · Docker Compose (Postgres + API + Nginx) · GitHub Actions CI/CD |

```
api/              NestJS API (포트 3000, 모든 경로가 /api 로 시작)
web/              React 웹사이트 (포트 3001, 운영은 Nginx 가 정적 파일 + /api 프록시)
mobile/           React Native 앱 (Expo SDK 57, Expo Router)
packages/shared/  웹·앱 공용 코드
```

### 스타일 (Tailwind / NativeWind)

웹은 **Tailwind CSS**, 앱은 같은 클래스 문법을 네이티브 스타일로 바꿔 주는 **NativeWind** 로 스타일을 입힙니다.

- 색 이름(`bg`, `surface`, `fg-strong`, `fg-sub`, `primary`, `danger` …)은 `packages/shared/tailwind-preset.cjs` 에 한 번 정의하고 웹·앱 설정이 함께 씁니다.
  색 값은 CSS 변수(`var(--surface)` 등)라서, `bg-surface text-fg-strong` 처럼 쓰면 라이트/다크 모드에 맞게 자동으로 바뀝니다.
  - 웹: 변수 값은 `web/src/styles/global.css` (설정의 테마 선택 + 시스템 설정)
  - 앱: 변수 값은 `mobile/src/theme.ts` 의 팔레트를 루트 레이아웃에서 NativeWind `vars()` 로 내려 줍니다.
- 클래스를 조건부로 합칠 때는 `cn()` (tailwind-merge) 을 씁니다. 같은 속성이면 뒤에 온 클래스가 이깁니다. 예) `cn(ui.button, ui.primary, ui.small)`
- 웹의 공통 UI 조각은 `web/src/components/ui.ts`, 화면별 클래스 묶음은 `*.styles.ts` 에 있습니다. 글 본문(마크다운)은 `@tailwindcss/typography` 의 `prose` 를 토큰 색에 맞춰 씁니다.
- 앱은 `Pressable` 에 `active:` 를 붙여 눌림 효과를 줍니다 (예: `active:bg-pressed`, `active:scale-95`). 아이콘 색처럼 스타일이 아닌 prop 은 `useColors()` 로 받습니다.
- Tailwind 는 두 곳 모두 3.4(LTS)를 씁니다. NativeWind 4 가 Tailwind 3 을 필요로 하고, 한 워크스페이스에 3 과 4 를 섞으면 설치가 꼬이기 때문입니다.

> 웹과 앱은 같은 React 버전(19.2.3)을 써야 공용 패키지가 React 를 하나만 불러옵니다.
> Expo SDK 를 올릴 때는 `web/package.json` 의 `react`, `react-dom` 도 같은 버전으로 맞춰 주세요.

## 실행

| 무엇 | 포트 | 주소 |
| ---- | ---- | ---- |
| API (NestJS) | **3000** | http://localhost:3000/api/... |
| 웹 (React) | **3001** | http://localhost:3001 |
| 모바일 (Expo 개발 서버) | 8081 (Expo 기본값) | 터미널에 나오는 QR 코드로 접속 |
| Postgres (Docker) | 5432 | 컨테이너 내부 |

포트를 바꾸려면 API 는 `PORT=4000 npm run api`, 웹은 `web/vite.config.ts` 의 `port` 를 고치면 됩니다.

### 1) API

```bash
npm install          # 저장소 루트에서 한 번 (API·웹·앱·공용 패키지를 함께 설치)
npm run api          # http://localhost:3000/api — 메모리 Postgres(PGlite) + 샘플 데이터로 바로 실행
```

- `DATABASE_URL` 이 없으면 **메모리 안에서 도는 Postgres(PGlite)** 를 씁니다. DB 설치가 필요 없고, 끄면 데이터가 사라집니다.
- 진짜 Postgres 를 쓰려면 `DATABASE_URL=postgres://user:pass@host:5432/db npm run api`. 테이블은 API 가 처음 뜰 때 자동으로 만들어집니다 (`api/src/db/migrations.ts`).
- 체험 계정은 `demo@loop.dev` / `password1234` 입니다 (메모리 DB 로 켰을 때, 또는 `SEED=true`).

#### 인증번호 메일 (회원가입 · 2단계 인증)

회원가입할 때와 2단계 인증을 켤 때·쓸 때 이메일로 6자리 인증번호를 보냅니다. 보내는 계정(Gmail SMTP)의 주소와 비밀번호는 **코드나 저장소에 두지 않고 환경 변수로만** 넘깁니다 (`MAIL_USERNAME`, `MAIL_PASSWORD`).

```bash
# Google 계정 비밀번호가 아니라 '앱 비밀번호'(16자리)를 넣으세요
MAIL_USERNAME='보내는주소@gmail.com' MAIL_PASSWORD='앱 비밀번호' npm run api
# Windows PowerShell: $env:MAIL_USERNAME='보내는주소@gmail.com'; $env:MAIL_PASSWORD='앱 비밀번호'; npm run api
```

- `MAIL_USERNAME`·`MAIL_PASSWORD` 가 없으면 메일 대신 **API 콘솔 로그에 인증번호가 찍힙니다** (`[메일 미설정] … 인증번호: 123456`). 로컬 개발은 이대로 쓰면 됩니다.
- 보내는 이름을 다르게 하려면 `MAIL_FROM` 도 설정하세요. Docker 는 저장소 루트의 `.env` 에 적습니다 (`.env.example` 참고).
- 인증번호는 10분 동안 유효하고, 5번 틀리면 폐기되며, 같은 이메일로는 60초에 한 번 · 한 시간에 10번까지 보낼 수 있습니다. 번호는 SHA-256 해시로만 저장합니다.

### 2) 웹

```bash
npm run web          # http://localhost:3001 (/api 는 API 3000 으로 프록시)
```

### 3) 모바일 앱 (Expo Go)

휴대폰에 **Expo Go (SDK 57)** 를 설치하고, PC 와 휴대폰을 **같은 Wi-Fi** 에 연결한 뒤:

```bash
npm run mobile       # = cd mobile && npx expo start
```

터미널에 나오는 QR 코드를 Expo Go(Android) 또는 카메라(iOS)로 찍으면 앱이 열립니다.

- 앱은 Expo 개발 서버가 떠 있는 PC 의 IP 로 API(`http://<PC IP>:3000`)를 자동으로 찾아갑니다.
  휴대폰에서 연결이 안 되면 PC 방화벽에서 3000 포트를 열어 주세요.
- Android 에뮬레이터는 `a`, iOS 시뮬레이터는 `i` 를 누르면 됩니다.
- 다른 서버를 쓰려면 `EXPO_PUBLIC_API_URL=https://api.example.com npm run mobile`.
- 스토어 배포용 빌드는 EAS Build(`npx eas build`)를 쓰고, 이때는 HTTPS API 주소를 `EXPO_PUBLIC_API_URL` 로 넣어 주세요.

### Docker (Postgres + API + 웹)

```bash
cp .env.example .env   # DB_PASSWORD 를 꼭 채우세요 (비어 있으면 compose 가 시작하지 않아요)
JWT_SECRET=$(openssl rand -base64 48) docker compose up --build
```

http://localhost:3001 로 접속합니다. 도메인으로 배포할 때는 `PUBLIC_ORIGIN=https://your.domain` 을 설정해 주세요. 이 값은 CORS 허용 목록으로 쓰입니다. (네이티브 앱은 브라우저가 아니라서 CORS 와 무관합니다.)

| 환경 변수        | 설명                                   | 기본값             |
| ---------------- | -------------------------------------- | ------------------ |
| `JWT_SECRET`     | JWT 서명 키 (32바이트 이상)            | 개발용 값          |
| `PUBLIC_ORIGIN`  | 브라우저가 접속하는 주소 (CORS)        | `http://localhost:3001` |
| `DB_PASSWORD`    | Postgres 비밀번호 (Docker)             | 없음 (**필수**)     |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | 인증번호 메일을 보낼 Gmail 주소 / 앱 비밀번호 | 없음 (없으면 로그에 번호 출력) |

### 배포 (Vercel + GitHub Actions)

```
브라우저 ──► Vercel ─┬─ /api/*  ──► api 서비스 (NestJS, 서버리스 함수) ──► Neon Postgres
                     └─ 그 밖    ──► web 서비스 (React 정적 파일)
```

**1) Vercel (`vercel.json`)**: 한 프로젝트에 두 서비스를 올리고 한 도메인으로 묶습니다.

| 서비스 | 폴더 | 프레임워크 | 공개 경로 |
| ------ | ---- | ---------- | --------- |
| `api` | `api/` | NestJS | `/api/*` |
| `web` | `web/` | Vite (React) | 그 밖의 모든 경로 |

웹은 브라우저에서 같은 도메인의 `/api` 로 요청하므로 서비스끼리 직접 부르는 일이 없어 binding 은 필요 없습니다.

Vercel 프로젝트에서 할 일:
1. **Storage → Neon Postgres** 를 연결합니다. `DATABASE_URL` 이 자동으로 들어옵니다. 테이블은 API 가 처음 요청을 받을 때 자동으로 만듭니다.
2. **Settings → Environment Variables** 에 넣습니다.

| 이름 | 값 |
| ---- | -- |
| `JWT_SECRET` | 32바이트 이상 무작위 문자열 (**필수**, 없으면 API 가 시작하지 않아요) |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | 인증번호 메일을 보낼 Gmail 주소 / 앱 비밀번호 |
| `CORS_ORIGINS` | (선택) 다른 도메인에서 API 를 부를 때만. 같은 도메인이면 필요 없어요 |
| `SITE_URL` | 사이트 바깥 주소 (예: `https://habitloop-eight.vercel.app`). 소셜 로그인 Redirect URI · 로그인 뒤 돌아갈 주소 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` · `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` · `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 소셜 로그인 키 (비우면 그 버튼은 "준비 중") |
| `KAKAO_JS_KEY` | 카카오톡 공유용 JavaScript 키 (서버가 웹에 넘겨줌, Secret 으로 저장해도 됨). 카카오 콘솔에 사이트 도메인 등록 필요. 비우면 공유 창에서 카카오톡만 빠짐 |
| `ADMIN_KEY` | 관리자 페이지 비밀 주소 키 (영문·숫자·`-`·`_` 32자 이상, **Secret 으로**). 사이트 주소/`ADMIN_KEY` 에서만 열림 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 관리자 계정 (회원 계정과 따로, 회원가입 필요 없음). 비밀번호는 12자 이상, **Secret 으로**. 로그인마다 이 이메일로 인증번호. 셋 중 하나라도 비우면 관리자 기능 꺼짐 |

**2) CI/CD (`.github/workflows/ci.yml`)**

| 언제 | 하는 일 |
| ---- | ------- |
| PR · main 푸시 | API 타입 체크 + 통합 테스트(진짜 Postgres), 웹 빌드, 앱 타입 체크·번들, Docker 이미지 빌드 확인 |
| main 푸시 | Docker 이미지를 GHCR 에 올림: `ghcr.io/<owner>/habitloop-api`, `…-web` (태그 `latest`, `sha-xxxxxxx`) |
| main 푸시 + 서버 설정 | (선택) Vercel 대신 직접 서버에도 올릴 때: SSH 로 접속해 새 이미지를 받아 재시작 |

Vercel 배포는 Vercel 의 GitHub 연동이 알아서 합니다. 직접 운영하는 서버에도 올리고 싶다면 GitHub 저장소
**Settings → Secrets and variables → Actions** 에 아래를 넣으세요 (없으면 서버 배포 단계는 건너뜁니다).

| 종류 | 이름 | 값 |
| ---- | ---- | -- |
| Variable | `DEPLOY_HOST` | 서버 주소 (IP 또는 도메인) |
| Variable | `DEPLOY_USER` | SSH 사용자 |
| Variable | `DEPLOY_PATH` | 서버에서 compose 파일을 둘 폴더 (기본 `~/habitloop`) |
| Secret | `DEPLOY_SSH_KEY` | 서버에 접속할 SSH 개인 키 |

서버에는 Docker 와 `DEPLOY_PATH/.env` 만 준비해 두면 됩니다 (`.env.example` 참고).
배포는 `docker-compose.yml` + `docker-compose.prod.yml`(빌드 대신 GHCR 이미지 사용)로 실행됩니다.

### 테스트

```bash
npm test                             # API 통합 테스트 (메모리 Postgres. TEST_DATABASE_URL 을 주면 진짜 Postgres)
npm run build:web                    # 웹 타입 체크 + 프로덕션 빌드
npm run typecheck                    # API + 웹 + 앱 타입 체크
cd mobile && npx expo export --platform android --platform ios   # 앱 번들 확인
```

## API

| Method | Path                                   | 인증 | 설명                                   |
| ------ | -------------------------------------- | ---- | -------------------------------------- |
| POST   | `/api/auth/signup/code`                |      | 회원가입 인증번호 메일 보내기 `{ email }` |
| POST   | `/api/auth/signup`                     |      | 가입 `{ email, password, nickname, code }` → `{ token, user }` |
| POST   | `/api/auth/login`                      |      | 로그인 → `{ token, user }`, 2단계 인증이 켜져 있으면 `{ twoFactorRequired, challenge, maskedEmail }` |
| POST   | `/api/auth/login/verify`, `…/login/resend` |  | 2단계 인증 번호 확인 `{ challenge, code }` → `{ token, user }` / 번호 다시 받기 |
| POST   | `/api/me/2fa/code`, `/api/me/2fa/enable`, `/api/me/2fa/disable` | ✓ | 2단계 인증 번호 받기 / 켜기 `{ code }` / 끄기 `{ password }` (켜고 끌 때 알림 메일) |
| GET    | `/api/me`                              | ✓    | 내 정보                                |
| GET    | `/api/channels?q=`                     |      | 인기 채널 (q 가 있으면 채널 이름 검색)   |
| GET    | `/api/channels/previews?q=&size=`      |      | 채널 목록 + 채널별 최근 글 미리보기(최대 8개) |
| GET    | `/api/channels/{slug}`                 |      | 채널 정보 (`joined`: 가입 여부)         |
| POST / DELETE | `/api/channels/{slug}/members`, `…/members/me` | ✓ | 채널 가입 / 탈퇴 (만든 사람은 탈퇴 불가) |
| GET    | `/api/me/channels`                     | ✓    | 내가 가입한 채널 (`owner`: 내가 만든 채널) |
| PUT / DELETE | `/api/channels/{slug}/bookmark`  | ✓    | 채널 북마크 / 해제                      |
| GET    | `/api/me/bookmarks/channels`           | ✓    | 내가 북마크한 채널                      |
| PUT    | `/api/me/profile`                      | ✓    | 닉네임 변경 (새 토큰을 돌려줌)          |
| PUT    | `/api/me/password`                     | ✓    | 비밀번호 변경 (지금 비밀번호 확인)      |
| POST / PUT | `/api/channels`, `/api/channels/{slug}` | ✓ | 채널 만들기 / 수정 (소유자·관리자)    |
| GET / PUT / DELETE | `/api/channels/{slug}/icon[?v=]` | PUT·DELETE ✓ | 프로필 이미지 (PUT 은 이미지 바이트 그대로, 512KB 이하) |
| GET    | `/api/channels/{slug}/staff`           |      | 운영진 목록                             |
| GET    | `/api/channels/{slug}/members?q=`      | ✓    | 운영진으로 지정할 멤버 찾기 (소유자만)   |
| PUT    | `/api/channels/{slug}/members/{userId}/role` | ✓ | 역할 지정 `{ role: ADMIN \| MANAGER \| MEMBER }` (소유자만) |
| POST / PUT / DELETE | `/api/channels/{slug}/categories[/{id}]` | ✓ | 카테고리 추가 / 수정 / 삭제 (소유자·관리자) |
| PUT    | `/api/channels/{slug}/categories/order` | ✓   | 카테고리 순서 변경 `{ ids: [...] }`     |
| GET    | `/api/posts?channel=&category=&q=&authorId=&cursor=&size=` | | 목록 (커서 페이지네이션)  |
| GET    | `/api/posts/popular?channel=`          |      | 최근 7일 인기글 5개 (전체 또는 채널별)  |
| GET    | `/api/posts/{id}`                      |      | 상세                                   |
| POST / PUT / DELETE | `/api/posts`, `/api/posts/{id}` | ✓ | 작성 / 수정 / 삭제 (본인만)            |
| POST / DELETE | `/api/posts/{id}/like`          | ✓    | 좋아요 / 취소 (여러 번 호출해도 결과가 같음) |
| GET    | `/api/posts/{id}/comments?cursor=`     |      | 댓글 목록                              |
| GET    | `/api/posts/{id}/comments/best`        |      | 베스트 댓글                             |
| POST / DELETE | `/api/posts/{id}/comments/{commentId}/like` | ✓ | 댓글 좋아요 / 취소               |
| POST / DELETE | `/api/posts/{id}/comments[/{commentId}]` | ✓ | 댓글 작성 / 삭제                  |

## 최적화 포인트

### API

- **커서(키셋) 페이지네이션**: `OFFSET` 대신 `id < :cursor` 로 조회해 페이지가 깊어져도 비용이 같습니다.
- **필요한 컬럼만**: 목록은 본문(TEXT) 대신 저장할 때 마크다운 기호를 걷어 잘라 둔 `excerpt` 를 읽습니다. SQL 을 직접 써서 필요한 컬럼만 가져옵니다.
- **동적 WHERE**: `(:p is null or ...)` 패턴을 쓰지 않고, 조건이 있을 때만 WHERE 절을 붙여 인덱스를 제대로 타게 합니다.
- **복합 인덱스**: `(channel_id, id)`, 카테고리 탭용 `(category_id, id)`, 카테고리 순서용 `(channel_id, position)`, `(author_id, id)`, `(post_id, id)`, 베스트 댓글용 `(post_id, like_count)`, `created_at`, 좋아요·가입 unique 인덱스를 둡니다.
- **채널 목록 미리보기를 한 번에**: `unnest(채널 id 목록) CROSS JOIN LATERAL (… ORDER BY id DESC LIMIT 8)` 로 채널마다 `(channel_id, id)` 인덱스에서 8행만 읽습니다. 채널에 글이 아무리 많아도 비용이 같습니다.
- **N+1 없음**: 댓글의 "내가 눌렀는지", 작성자 운영진 배지, 가입 여부를 `= ANY(배열)` 쿼리 한 번으로 가져옵니다.
- **카운터 비정규화 + 원자적 UPDATE**: 좋아요·댓글·글·멤버 수는 `count(*)` 없이 `SET like_count = like_count + 1` 로 갱신하고, 중복 요청은 `ON CONFLICT DO NOTHING` 으로 막습니다.
- **서버리스에 맞춘 설계**: 조회수는 메모리에 모으지 않고 원자적 UPDATE 로 바로 반영합니다. DB 연결은 첫 요청 때 맺고 마이그레이션도 그때 한 번 적용합니다(여러 인스턴스가 동시에 떠도 advisory lock 으로 한 곳에서만).
- **인기글·인기 채널 캐시**: 인스턴스마다 60초 캐시합니다. 글을 쓰거나 지우고 채널이 바뀌면 캐시를 비웁니다.
- **Stateless JWT**: 토큰에 닉네임을 담고, 사용자 존재 여부는 60초 캐시해 요청마다 DB 를 보지 않습니다.
- **Docker 이미지**: 실행용 의존성과 빌드 결과만 담은 3단계 빌드입니다.

### 모바일 앱

- **네이티브 화면**: 탭 바(홈·채널·내 정보), 네이티브 스택 전환, 모달(글쓰기·로그인), 당겨서 새로고침을 씁니다.
- **FlatList 가상화**: 화면 밖 항목은 그리지 않고(`windowSize`, `removeClippedSubviews`) 끝에 가까워지면 다음 페이지를 미리 불러옵니다.
- **네이티브 마크다운 렌더러**: HTML·WebView 없이 marked 토큰을 `Text`/`View` 로 직접 그립니다. 가볍고 스크립트 삽입(XSS) 위험이 없으며, 링크는 http/https/mailto 만 엽니다.
- **보안 저장소**: 로그인 토큰은 iOS Keychain / Android Keystore(`expo-secure-store`)에 저장합니다.
- **캐시 공유**: 목록에서 이미 받은 제목·작성자로 상세 화면을 먼저 그리고 본문만 이어서 받습니다 (웹과 같은 공용 훅).

### 웹 (프론트엔드)

- **라우트 단위 코드 스플리팅**: 첫 화면(홈)만 메인 번들에 넣고 나머지 화면은 `React.lazy` 로 필요할 때 받습니다. react / router / query 는 별도 vendor 청크로 분리해 배포 후에도 캐시가 유지됩니다.
- **마크다운 파서 지연 로딩**: `marked` + `DOMPurify`(gzip 25KB)는 별도 청크로 분리했습니다. 글 상세를 열거나 미리보기를 누를 때만 받습니다. 같은 본문은 다시 파싱하지 않도록 memo 로 감쌉니다.
- **호버 프리로드**: 링크에 마우스를 올리거나 포커스하면 다음 화면의 JS 청크를 미리 받아, 클릭하면 바로 전환됩니다.
- **목록 데이터로 상세 먼저 그리기**: 목록에서 이미 알고 있는 제목·작성자 정보로 상세 화면을 즉시 그리고, 본문만 이어서 로드합니다.
- **TanStack Query 캐싱**: 30초 동안 캐시를 재사용합니다. 무한 스크롤은 끝에 닿기 800px 전에 다음 페이지를 미리 요청합니다.
- **낙관적 업데이트**: 글·댓글 좋아요는 누르는 즉시 반영하고 실패하면 되돌립니다. 댓글 좋아요는 목록과 베스트 댓글 캐시를 함께 고칩니다. 댓글 작성·삭제와 글 삭제는 다시 요청하지 않고 캐시만 수정합니다.
- **렌더링 비용 절감**: 긴 목록에 `content-visibility: auto` 를 적용하고, 목록 항목은 `memo` 로 감쌉니다. 인증 상태는 Context 대신 `useSyncExternalStore` 로 구독해 필요한 컴포넌트만 다시 렌더링합니다.
- **폰트**: Pretendard dynamic subset을 직접 호스팅해 화면에 쓰인 글자 조각만 받습니다. 외부 CDN 연결이 없고 `font-display: swap` 을 적용했습니다.
- **가벼운 의존성**: axios, 날짜 라이브러리, UI 킷을 쓰지 않습니다. `fetch` 와 `Intl` 포매터(한 번만 생성)를 쓰고, 스타일은 Tailwind CSS(빌드할 때 쓰인 클래스만 남김)로 런타임 비용이 없습니다.
- **Nginx**: 빌드할 때 gzip을 미리 압축해 두고(`gzip_static`), 해시가 붙은 자산에는 `immutable` 1년 캐시를, `index.html` 에는 `no-cache` 를 적용합니다. API 업스트림은 keepalive 로 연결합니다.
- 채널 검색은 입력이 멈춘 뒤 150ms 후에 요청하고(디바운스, 한 단어를 치는 동안 요청 1번), 같은 검색어는 캐시에서 바로 보여 줍니다. 화면을 벗어나면 진행 중인 요청을 `AbortSignal` 로 취소합니다.
