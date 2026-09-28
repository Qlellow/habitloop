# 루프 커뮤니티

토스처럼 군더더기 없는 디자인의 커뮤니티 서비스입니다.
글쓰기 · 카테고리 · 검색 · 좋아요 · 댓글 · 인기글 · 내 글 모아보기를 지원하고, 라이트/다크 모드를 모두 지원합니다.

| 영역     | 기술                                                                 |
| -------- | -------------------------------------------------------------------- |
| Backend  | Spring Boot 3.5 · Java 21 · Spring Security(JWT) · JPA · Flyway      |
| DB       | MySQL 8.4 (로컬 개발은 H2 MySQL 모드, 설치 없이 실행)                |
| Frontend | React 19 · TypeScript · Vite 8 · TanStack Query · React Router 7     |
| Infra    | Docker Compose (MySQL + Spring Boot + Nginx) · GitHub Actions CI     |

```
backend/    Spring Boot API (port 8080)
frontend/   React SPA (dev 5173, 운영은 Nginx 가 정적 파일 + /api 프록시)
```

## 실행

### 로컬 개발

```bash
# 1) 백엔드: H2 인메모리 DB + 샘플 데이터로 바로 실행 (Maven 설치 불필요, Java 21 만 있으면 됨)
cd backend && ./mvnw spring-boot:run      # Windows: mvnw.cmd spring-boot:run

# 2) 프론트: /api 요청은 8080 으로 프록시
cd frontend && npm install && npm run dev
```

http://localhost:5173 에서 확인할 수 있습니다. 체험 계정은 `demo@loop.dev` / `password1234` 입니다.

### Docker (운영 구성)

```bash
JWT_SECRET=$(openssl rand -base64 48) docker compose up --build
```

http://localhost 로 접속합니다. 도메인으로 배포할 때는 `PUBLIC_ORIGIN=https://your.domain` 을 설정해 주세요. 이 값은 CORS 허용 목록으로 쓰입니다.

| 환경 변수        | 설명                                   | 기본값             |
| ---------------- | -------------------------------------- | ------------------ |
| `JWT_SECRET`     | JWT 서명 키 (32바이트 이상)            | 개발용 값          |
| `PUBLIC_ORIGIN`  | 브라우저가 접속하는 주소 (CORS)        | `http://localhost` |
| `DB_PASSWORD`    | MySQL 비밀번호                         | `community`        |

### 테스트

```bash
cd backend && ./mvnw verify     # 통합 테스트 (회원가입 → 글 → 페이지네이션 → 좋아요 → 댓글 → 권한)
cd frontend && npm run build  # 타입 체크 + 프로덕션 빌드
```

## API

| Method | Path                                   | 인증 | 설명                                   |
| ------ | -------------------------------------- | ---- | -------------------------------------- |
| POST   | `/api/auth/signup`, `/api/auth/login`  |      | 가입 / 로그인 → `{ token, user }`      |
| GET    | `/api/me`                              | ✓    | 내 정보                                |
| GET    | `/api/posts?category=&q=&authorId=&cursor=&size=` | | 목록 (커서 페이지네이션)           |
| GET    | `/api/posts/popular`                   |      | 최근 7일 인기글 5개                     |
| GET    | `/api/posts/{id}`                      |      | 상세                                   |
| POST / PUT / DELETE | `/api/posts`, `/api/posts/{id}` | ✓ | 작성 / 수정 / 삭제 (본인만)            |
| POST / DELETE | `/api/posts/{id}/like`          | ✓    | 좋아요 / 취소 (여러 번 호출해도 결과가 같음) |
| GET    | `/api/posts/{id}/comments?cursor=`     |      | 댓글 목록                              |
| POST / DELETE | `/api/posts/{id}/comments[/{commentId}]` | ✓ | 댓글 작성 / 삭제                  |

## 최적화 포인트

### 백엔드

- **커서(키셋) 페이지네이션**: `OFFSET` 대신 `id < :cursor` 로 조회합니다. 5만 건 기준으로 첫 페이지와 깊은 페이지 모두 약 12ms입니다.
- **DTO 프로젝션 + 미리보기 컬럼**: 목록은 엔티티 대신 필요한 컬럼만 DTO로 읽습니다. 본문(TEXT) 대신 저장 시 잘라 둔 `excerpt` 를 사용합니다.
- **동적 JPQL**: `(:p is null or ...)` 패턴을 쓰지 않고, 조건이 있을 때만 WHERE 절을 붙여 인덱스를 제대로 타게 합니다.
- **복합 인덱스**: `(category, id)`, `(author_id, id)`, `(post_id, id)`, `created_at`, 좋아요 `(post_id, user_id)` unique 인덱스를 둡니다.
- **카운터 비정규화 + 원자적 UPDATE**: 좋아요/댓글 수는 `count(*)` 없이 `SET like_count = like_count + 1` 로 갱신합니다. 엔티티에서는 `updatable=false` 로 두어 덮어쓰기를 막습니다.
- **조회수 write-behind**: 조회마다 UPDATE 하지 않습니다. 메모리(`LongAdder`)에 모아 5초마다 반영하므로 인기글에 락 경합이 생기지 않습니다. 종료 시에도 flush 합니다.
- **N+1 방지**: fetch join, `default_batch_fetch_size`, `open-in-view: false` 를 적용했습니다.
- **인기글 캐시**: Caffeine에 60초 동안 캐시하고, 글을 삭제하면 캐시를 비웁니다. `Cache-Control` 헤더도 함께 보냅니다.
- **Stateless JWT**: 토큰에 닉네임을 담아 요청마다 사용자를 DB에서 조회하지 않습니다. JWT 파서는 한 번만 만들어 재사용합니다.
- **런타임**: Java 21 가상 스레드, gzip 응답 압축(20개 목록 4.8KB → 0.5KB), HTTP/2, HikariCP 튜닝, MySQL `rewriteBatchedStatements` 와 prepared statement 캐시를 사용합니다.
- **레이어드 Docker 이미지**: 의존성 레이어와 앱 레이어를 분리해, 코드만 바뀌면 작은 레이어만 다시 배포합니다.

### 프론트엔드

- **라우트 단위 코드 스플리팅**: 첫 화면(홈)만 메인 번들에 넣고 나머지 화면은 `React.lazy` 로 필요할 때 받습니다. react / router / query 는 별도 vendor 청크로 분리해 배포 후에도 캐시가 유지됩니다.
- **호버 프리로드**: 링크에 마우스를 올리거나 포커스하면 다음 화면의 JS 청크를 미리 받아, 클릭하면 바로 전환됩니다.
- **목록 데이터로 상세 먼저 그리기**: 목록에서 이미 알고 있는 제목·작성자 정보로 상세 화면을 즉시 그리고, 본문만 이어서 로드합니다.
- **TanStack Query 캐싱**: 30초 동안 캐시를 재사용합니다. 무한 스크롤은 끝에 닿기 800px 전에 다음 페이지를 미리 요청합니다.
- **낙관적 업데이트**: 좋아요는 누르는 즉시 반영하고 실패하면 되돌립니다. 댓글 작성·삭제와 글 삭제는 다시 요청하지 않고 캐시만 수정합니다.
- **렌더링 비용 절감**: 긴 목록에 `content-visibility: auto` 를 적용하고, 목록 항목은 `memo` 로 감쌉니다. 인증 상태는 Context 대신 `useSyncExternalStore` 로 구독해 필요한 컴포넌트만 다시 렌더링합니다.
- **폰트**: Pretendard dynamic subset을 직접 호스팅해 화면에 쓰인 글자 조각만 받습니다. 외부 CDN 연결이 없고 `font-display: swap` 을 적용했습니다.
- **가벼운 의존성**: axios, 날짜 라이브러리, UI 킷을 쓰지 않습니다. `fetch` 와 `Intl` 포매터(한 번만 생성)를 쓰고, 스타일은 CSS Modules로 런타임 비용이 없습니다.
- **Nginx**: 빌드할 때 gzip을 미리 압축해 두고(`gzip_static`), 해시가 붙은 자산에는 `immutable` 1년 캐시를, `index.html` 에는 `no-cache` 를 적용합니다. API 업스트림은 keepalive 로 연결합니다.
- 검색은 입력이 멈춘 뒤 300ms 후에 요청하고(디바운스), 화면을 벗어나면 진행 중인 요청을 `AbortSignal` 로 취소합니다.
