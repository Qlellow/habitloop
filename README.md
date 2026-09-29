# 루프 커뮤니티

토스처럼 군더더기 없는 디자인의 커뮤니티 서비스입니다.

- **채널**: DC 갤러리나 아카라이브 채널처럼 누구나 주제별 공간(`/c/{주소}`)을 만들 수 있습니다. 만든 사람은 이름과 소개를 관리할 수 있습니다. 채널은 **가입제**라 가입한 사람만 글을 쓸 수 있고(글 보기·공감·댓글·댓글 좋아요는 누구나), 글은 **채널 안에서만** 쓸 수 있으며(채널 페이지의 글쓰기 버튼), 글쓰기 화면에서는 채널이 고정된 채 카테고리를 드롭다운으로 고릅니다.
- **채널 카테고리**: 채널 소유자가 채널 안에 공지사항·소설·일러스트 같은 카테고리를 최대 20개까지 만들고, 이름 변경·삭제·순서 변경을 할 수 있습니다. **관리자만 글쓰기**로 설정한 카테고리(공지사항 등)는 소유자만 글을 올릴 수 있습니다. 카테고리를 지워도 글은 남고 '카테고리 없음'이 됩니다.
- **마크다운 글쓰기**: 서식 툴바와 미리보기를 제공합니다. 렌더링 결과는 sanitize 해서 XSS 를 막습니다.
- **좋아요**: 글과 댓글 모두 누를 수 있습니다. 좋아요 2개 이상 받은 댓글 중 상위 3개는 **베스트 댓글**로 맨 위에 올라갑니다.
- **마이페이지**(`/me`): 왼쪽 메뉴에서 내가 쓴 글 · 가입/북마크한 채널 · 내 정보 수정(닉네임, 비밀번호) · 설정(테마, 글 목록 미리보기, 편집기 기본 보기)을 볼 수 있습니다. 채널은 가입과 별개로 ☆ 북마크할 수 있습니다.
- **채널 검색**: 상단 검색창에 입력하는 동안 채널 이름에 그 글자·단어가 들어간 채널이 드롭다운(최대 높이 360px, 안에서 스크롤)으로 바로 나옵니다. 이름이 검색어로 시작하는 채널이 먼저, 그다음 글이 많은 순입니다. ↑↓·Enter·Esc 로도 쓸 수 있습니다.
- 인기글(전체/채널별), 무한 스크롤, 라이트/다크 모드(시스템 설정 또는 직접 선택)를 지원합니다.

웹은 **넓은 화면용 웹사이트**로, 휴대폰은 **네이티브 앱(React Native)** 으로 따로 만들었습니다.
데이터를 다루는 코드(API 호출, 타입, 캐시·좋아요 같은 데이터 훅, 로그인 상태)는 `packages/shared` 에 한 번만 작성하고 웹과 앱이 함께 씁니다.

| 영역     | 기술                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| Backend  | Spring Boot 3.5 · Java 21 · Spring Security(JWT) · JPA · Flyway               |
| DB       | MySQL 8.4 (로컬 개발은 H2 MySQL 모드, 설치 없이 실행)                         |
| Web      | React 19.2 · TypeScript · Vite 8 · TanStack Query · React Router 7 · **Tailwind CSS 3.4** |
| Mobile   | React Native 0.86 · **Expo SDK 57** · Expo Router · TanStack Query · **NativeWind 4** |
| Shared   | `@loop/shared` — API 클라이언트 · 타입 · 데이터 훅 · 인증 상태 (웹/앱 공용)    |
| Infra    | Docker Compose (MySQL + Spring Boot + Nginx) · GitHub Actions CI              |

```
backend/          Spring Boot API (포트 3000)
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
| 백엔드 (Spring Boot API) | **3000** | http://localhost:3000/api/... |
| 웹 (React) | **3001** | http://localhost:3001 |
| 모바일 (Expo 개발 서버) | 8081 (Expo 기본값) | 터미널에 나오는 QR 코드로 접속 |
| MySQL (Docker) | 3306 | 컨테이너 내부 |

포트를 바꾸려면 백엔드는 `PORT=4000 ./mvnw spring-boot:run`, 웹은 `web/vite.config.ts` 의 `port` 를 고치면 됩니다.

### 1) 백엔드

```bash
# H2 인메모리 DB + 샘플 데이터로 바로 실행 (Maven 설치 불필요, Java 21 만 있으면 됨)
cd backend && ./mvnw spring-boot:run      # Windows: mvnw.cmd spring-boot:run
```

체험 계정은 `demo@loop.dev` / `password1234` 입니다.

### 2) 웹

```bash
npm install          # 저장소 루트에서 한 번 (웹·앱·공용 패키지를 함께 설치)
npm run web          # http://localhost:3001 (/api 는 백엔드 3000 으로 프록시)
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

### Docker (운영 구성: DB + API + 웹)

```bash
JWT_SECRET=$(openssl rand -base64 48) docker compose up --build
```

http://localhost:3001 로 접속합니다. 도메인으로 배포할 때는 `PUBLIC_ORIGIN=https://your.domain` 을 설정해 주세요. 이 값은 CORS 허용 목록으로 쓰입니다. (네이티브 앱은 브라우저가 아니라서 CORS 와 무관합니다.)

| 환경 변수        | 설명                                   | 기본값             |
| ---------------- | -------------------------------------- | ------------------ |
| `JWT_SECRET`     | JWT 서명 키 (32바이트 이상)            | 개발용 값          |
| `PUBLIC_ORIGIN`  | 브라우저가 접속하는 주소 (CORS)        | `http://localhost:3001` |
| `DB_PASSWORD`    | MySQL 비밀번호                         | `community`        |

### 테스트

```bash
cd backend && ./mvnw verify          # 통합 테스트 (회원가입 → 글 → 채널·카테고리 → 좋아요 → 댓글 → 권한)
npm run build:web                    # 웹 타입 체크 + 프로덕션 빌드
npm run typecheck                    # 웹 + 앱 타입 체크
cd mobile && npx expo export --platform android --platform ios   # 앱 번들 확인
```

## API

| Method | Path                                   | 인증 | 설명                                   |
| ------ | -------------------------------------- | ---- | -------------------------------------- |
| POST   | `/api/auth/signup`, `/api/auth/login`  |      | 가입 / 로그인 → `{ token, user }`      |
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
| POST / PUT | `/api/channels`, `/api/channels/{slug}` | ✓ | 채널 만들기 / 수정 (만든 사람만)      |
| POST / PUT / DELETE | `/api/channels/{slug}/categories[/{id}]` | ✓ | 카테고리 추가 / 수정 / 삭제 (소유자만) |
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

### 백엔드

- **커서(키셋) 페이지네이션**: `OFFSET` 대신 `id < :cursor` 로 조회합니다. 5만 건 기준으로 첫 페이지와 깊은 페이지 모두 약 12ms입니다.
- **DTO 프로젝션 + 미리보기 컬럼**: 목록은 엔티티 대신 필요한 컬럼만 DTO로 읽습니다. 본문(TEXT) 대신 저장 시 잘라 둔 `excerpt` 를 사용합니다.
- **동적 JPQL**: `(:p is null or ...)` 패턴을 쓰지 않고, 조건이 있을 때만 WHERE 절을 붙여 인덱스를 제대로 타게 합니다.
- **복합 인덱스**: `(channel_id, id)`, 카테고리 탭용 `(category_id, id)`, 카테고리 순서용 `(channel_id, position)`, `(author_id, id)`, `(post_id, id)`, 베스트 댓글용 `(post_id, like_count)`, `created_at`, 좋아요 `(post_id, user_id)`·`(comment_id, user_id)` unique 인덱스를 둡니다.
- **채널 목록 미리보기를 한 번에**: 채널마다 최근 글 8개를 `(SELECT … WHERE channel_id=? ORDER BY id DESC LIMIT 8) UNION ALL …` 로 묶어 한 번에 조회합니다. 채널별 `(channel_id, id)` 인덱스만 읽고 8행에서 멈추므로 채널에 글이 아무리 많아도 비용이 같습니다. (채널 30개여도 API 요청 1번, DB 쿼리 3번)
- **채널 정보 한 번에 조회**: 채널 정보를 불러올 때 카테고리 목록도 함께 받아서, 탭을 그리려고 요청을 한 번 더 보내지 않습니다. 카테고리를 수정하면 서버가 바뀐 전체 목록을 돌려주고, 프론트는 그 목록으로 캐시를 바로 덮어씁니다.
- **댓글 좋아요 여부 한 번에 조회**: 한 페이지 댓글의 "내가 눌렀는지" 여부를 `IN` 쿼리 한 번으로 가져옵니다 (N+1 없음).
- **마크다운 미리보기 텍스트**: 목록에 쓸 미리보기를 저장할 때 마크다운 기호를 미리 걷어 두어, 목록 조회 시 파싱 비용이 들지 않습니다.
- **카운터 비정규화 + 원자적 UPDATE**: 글·댓글 좋아요 수, 댓글 수, 채널 글 수는 `count(*)` 없이 `SET like_count = like_count + 1` 로 갱신합니다. 엔티티에서는 `updatable=false` 로 두어 덮어쓰기를 막습니다.
- **조회수 write-behind**: 조회마다 UPDATE 하지 않습니다. 메모리(`LongAdder`)에 모아 5초마다 반영하므로 인기글에 락 경합이 생기지 않습니다. 종료 시에도 flush 합니다.
- **N+1 방지**: fetch join, `default_batch_fetch_size`, `open-in-view: false` 를 적용했습니다.
- **인기글·인기 채널 캐시**: Caffeine에 60초 동안 캐시합니다(인기글은 채널별로 따로 캐시). 글을 삭제하거나 채널을 만들고 수정하면 캐시를 비웁니다.
- **Stateless JWT**: 토큰에 닉네임을 담아 요청마다 사용자를 DB에서 조회하지 않습니다. JWT 파서는 한 번만 만들어 재사용합니다.
- **런타임**: Java 21 가상 스레드, gzip 응답 압축(20개 목록 4.8KB → 0.5KB), HTTP/2, HikariCP 튜닝, MySQL `rewriteBatchedStatements` 와 prepared statement 캐시를 사용합니다.
- **레이어드 Docker 이미지**: 의존성 레이어와 앱 레이어를 분리해, 코드만 바뀌면 작은 레이어만 다시 배포합니다.

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
