import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { makeExcerpt } from '../posts/excerpt';
import { Database } from './database';

const MARKDOWN_SAMPLE = `리액트를 처음 공부할 때 **이 순서**로 하니까 덜 헤맸어요.

## 1. 기초 문법
- JSX 와 컴포넌트
- \`props\` 와 \`state\`
- 조건부 렌더링, 리스트

## 2. 훅
1. \`useState\`, \`useEffect\`
2. 커스텀 훅 만들어 보기

> 처음부터 상태 관리 라이브러리를 붙이지 말고, 꼭 필요할 때 도입하세요.

\`\`\`tsx
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
\`\`\`

자세한 건 [공식 문서](https://react.dev)를 참고하세요!
`;

/** channel slug, title, content */
const SAMPLES: [string, string, string][] = [
  ['free', '요즘 제일 잘 산 물건 하나씩 공유해요', '저는 무선 청소기요. 청소가 이렇게 즐거울 수 있다니…\n여러분은 뭐가 있나요?'],
  ['money', '첫 월급 관리 어떻게 하셨어요?', '다음 달에 첫 월급을 받는데, **통장 쪼개기**부터 해야 할지 모르겠어요. 팁 부탁드려요!'],
  ['info', '자취 필수템 정리 (2026 ver.)', '1. 멀티탭은 개별 스위치형\n2. 전자레인지 용기는 유리로\n3. 암막 커튼은 생각보다 중요해요'],
  ['daily', '오늘 한강 노을 진짜 예뻤어요', '퇴근길에 잠깐 들렀는데 하늘이 분홍색이었어요. 다들 오늘 하루도 고생 많으셨어요.'],
  ['dev', '리액트 공부 순서 정리해 봤어요', MARKDOWN_SAMPLE],
  [
    'money',
    '적금 금리 비교해 봤어요',
    '주요 은행 12개월 적금 금리를 정리해 봤어요.\n\n| 은행 | 기본 | 우대 |\n| --- | --- | --- |\n| A은행 | 3.1% | 4.0% |\n| B은행 | 3.3% | 3.8% |\n\n우대 조건을 꼭 확인하세요.',
  ],
  ['question', '주말에 갈 만한 등산 코스 있을까요?', '초보도 갈 수 있는 서울 근교 코스 추천 부탁드려요!'],
  ['daily', '3개월째 아침 운동 성공 중', '처음엔 힘들었는데 이제는 안 하면 허전해요. 작은 습관의 힘!'],
];

/** 긴 마크다운 소개 예시 (채널 헤더의 '더 보기' 확인용) */
const CREATIVE_INTRO = `직접 쓴 **소설**과 그린 **그림**을 나누는 채널이에요.

## 이용 규칙
- 직접 만든 작품만 올려 주세요. 퍼온 작품은 출처가 있어도 삭제돼요.
- 소설은 \`소설\`, 그림은 \`일러스트\` 카테고리에 올려 주세요.
- 서로의 작품에는 따뜻한 감상을 남겨 주세요.

## 운영진
- ⭐ 소유자: 루프
- ⚙️ 관리자: 민트초코
- 🔧 매니저: 하늘색

> 좋은 작품은 공지사항에서 이달의 작품으로 소개해요.`;

const REPLIES = ['좋은 글 감사해요 🙌', '저도 궁금했어요!', '완전 공감해요', '꿀팁 저장합니다'];

/**
 * 로컬 개발용 샘플 데이터. DB 가 비어 있을 때만 넣는다.
 * SEED=true 이거나, DATABASE_URL 없이 메모리 DB 로 켰을 때 동작한다 (테스트는 제외).
 */
@Injectable()
export class Seeder implements OnApplicationBootstrap {
  private readonly log = new Logger(Seeder.name);

  constructor(private readonly db: Database) {}

  get enabled() {
    if (process.env.NODE_ENV === 'test') return process.env.SEED === 'true';
    return process.env.SEED === 'true' || (!process.env.DATABASE_URL && process.env.SEED !== 'false');
  }

  async onApplicationBootstrap() {
    if (!this.enabled) return;
    const count = await this.db.one<{ n: number }>('SELECT count(*)::int AS n FROM users');
    if (count!.n > 0) return;
    await this.db.transaction(() => this.seed());
    this.log.log('샘플 데이터를 넣었어요. 체험 계정: demo@loop.dev / password1234');
  }

  private async seed() {
    const db = this.db;
    const password = await bcrypt.hash('password1234', 10);
    const users: number[] = [];
    for (const [email, nickname] of [
      ['demo@loop.dev', '루프'],
      ['mint@loop.dev', '민트초코'],
      ['sky@loop.dev', '하늘색'],
    ]) {
      users.push((await db.one<{ id: number }>('INSERT INTO users (email, password, nickname) VALUES ($1, $2, $3) RETURNING id', [email, password, nickname]))!.id);
    }
    const channel = async (slug: string, name: string, description: string, owner: number) =>
      (await db.one<{ id: number }>('INSERT INTO channels (slug, name, description, owner_id) VALUES ($1, $2, $3, $4) RETURNING id', [
        slug,
        name,
        description,
        owner,
      ]))!.id;
    const post = async (author: number, channelId: number, categoryId: number | null, title: string, content: string) =>
      (await db.one<{ id: number }>(
        'INSERT INTO posts (author_id, channel_id, category_id, title, content, excerpt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [author, channelId, categoryId, title, content, makeExcerpt(content)],
      ))!.id;

    // 기본 채널(free/question/info/daily)은 마이그레이션이 만들고, 사용자 채널을 몇 개 추가한다
    await channel('dev', '개발', '개발 이야기, 코드 리뷰, 커리어 고민까지', users[0]);
    await channel('money', '재테크', '월급 관리부터 투자까지 돈 이야기', users[1]);
    const channels = new Map((await db.query<{ id: number; slug: string }>('SELECT id, slug FROM channels')).map((c) => [c.slug, c.id]));

    for (let round = 0; round < 5; round++) {
      for (let i = 0; i < SAMPLES.length; i++) {
        const [slug, baseTitle, content] = SAMPLES[i];
        const title = round === 0 ? baseTitle : `${baseTitle} (${round + 1})`;
        const postId = await post(users[(i + round) % users.length], channels.get(slug)!, null, title, content);
        const comments = ((i + round) % 4) + 1;
        for (let c = 0; c < comments; c++) {
          const commentId = (await db.one<{ id: number }>('INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, $3) RETURNING id', [
            postId,
            users[(i + c + 1) % users.length],
            REPLIES[(i + c) % REPLIES.length],
          ]))!.id;
          // 첫 댓글에 좋아요를 몰아줘서 베스트 댓글 예시를 만든다
          const likes = c === 0 ? ((i + round) % 3) + 1 : 0;
          for (let l = 0; l < likes; l++) {
            await db.execute('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)', [commentId, users[l]]);
          }
          await db.execute('UPDATE comments SET like_count = $1 WHERE id = $2', [likes, commentId]);
        }
        await db.execute('UPDATE posts SET comment_count = $1, like_count = $2 WHERE id = $3', [comments, (i * 7 + round * 3) % 20, postId]);
      }
    }

    // 채널 안 카테고리 예시: 공지사항(운영진 전용) / 소설 / 일러스트
    const creative = await channel('creative', '창작', CREATIVE_INTRO, users[0]);
    const category = async (name: string, ownerOnly: boolean, position: number) =>
      (await db.one<{ id: number }>('INSERT INTO channel_categories (channel_id, name, owner_only, position) VALUES ($1, $2, $3, $4) RETURNING id', [
        creative,
        name,
        ownerOnly,
        position,
      ]))!.id;
    const notice = await category('공지사항', true, 0);
    const novel = await category('소설', false, 1);
    const art = await category('일러스트', false, 2);
    await post(users[0], creative, notice, '창작 채널 이용 안내', '## 환영해요!\n\n- 직접 만든 작품만 올려 주세요\n- 소설은 **소설**, 그림은 **일러스트** 카테고리에 올려 주세요');
    await post(users[1], creative, novel, '[단편] 새벽 세 시의 편의점', '> 형광등 아래에서 우리는 모두 조금씩 외로웠다.\n\n새벽 세 시, 편의점 문이 열렸다…');
    await post(users[2], creative, art, '봄 풍경 수채화 그려 봤어요', '처음 그려 본 수채화예요. 벚꽃 색 내기가 어렵네요 🌸');
    await post(users[1], creative, novel, '[연재] 달의 도서관 1화', '도서관은 보름달이 뜨는 밤에만 문을 열었다.');
    await post(users[2], creative, null, '다들 작업할 때 뭐 들으세요?', '저는 주로 로파이 틀어 놔요.');

    // 가입 체험용: demo 계정은 아직 가입하지 않은 채널
    const books = await channel('books', '독서', '읽은 책 이야기와 추천을 나눠요', users[1]);
    await post(users[1], books, null, '이번 달에 읽은 책 3권', '1. 소설 한 권\n2. 에세이 한 권\n3. 경제 책 한 권');
    await post(users[2], books, null, '출퇴근길에 읽기 좋은 책 추천해요', '짧은 단편집이 딱 좋아요.');

    // 채널 주인은 소유자로, 그 채널에 글을 쓴 사람은 멤버로 가입시킨다
    await db.execute(`INSERT INTO channel_members (channel_id, user_id, role) SELECT id, owner_id, 'OWNER' FROM channels WHERE owner_id IS NOT NULL`);
    await db.execute(
      `INSERT INTO channel_members (channel_id, user_id) SELECT DISTINCT channel_id, author_id FROM posts
       ON CONFLICT (channel_id, user_id) DO NOTHING`,
    );
    // 운영진 배지 예시: 창작 채널의 관리자(민트초코) · 매니저(하늘색)
    await db.execute("UPDATE channel_members SET role = 'ADMIN' WHERE channel_id = $1 AND user_id = $2", [creative, users[1]]);
    await db.execute("UPDATE channel_members SET role = 'MANAGER' WHERE channel_id = $1 AND user_id = $2", [creative, users[2]]);
    // 카운터 맞추기
    await db.execute(`UPDATE channels c SET
      post_count = (SELECT count(*) FROM posts p WHERE p.channel_id = c.id),
      member_count = (SELECT count(*) FROM channel_members m WHERE m.channel_id = c.id)`);
  }
}
