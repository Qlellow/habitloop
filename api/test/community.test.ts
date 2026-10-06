import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/create-app';
import { JwtService } from '../src/auth/jwt.service';
import { Mailer } from '../src/mail/mailer';
import { Database } from '../src/db/database';
import { makeExcerpt, EXCERPT_LENGTH } from '../src/posts/excerpt';

/**
 * 통합 테스트: 메모리 Postgres(PGlite) 위에서 실제 HTTP 요청으로 전체 흐름을 확인한다.
 * (예전 Spring Boot 테스트를 그대로 옮겨, API 동작이 바뀌지 않았음을 보장한다)
 */
let app: INestApplication;
let mailer: Mailer;
let jwt: JwtService;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MAIL_RESEND_INTERVAL_SECONDS = '0';
  // TEST_DATABASE_URL 을 주면 진짜 Postgres 로, 없으면 메모리 DB(PGlite)로 돌린다
  if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  else delete process.env.DATABASE_URL;
  delete process.env.MAIL_USERNAME;
  delete process.env.MAIL_PASSWORD;
  app = await createApp();
  mailer = app.get(Mailer);
  jwt = app.get(JwtService);
});

afterAll(async () => {
  await app?.close();
});

const http = () => request(app.getHttpServer());
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const lastCode = (email: string) => mailer.lastCode(email)!;
const other = (code: string) => (code === 'AAAAAA' ? 'BBBBBB' : 'AAAAAA');

async function signup(email: string, nickname: string): Promise<string> {
  await http().post('/api/auth/signup/code').send({ email }).expect(204);
  const res = await http()
    .post('/api/auth/signup')
    .send({ email, password: 'password1234!', nickname, code: lastCode(email) })
    .expect(201);
  return res.body.token;
}

describe('excerpt', () => {
  it('공백을 하나로 모으고 150자로 자른다', () => {
    expect(makeExcerpt('  안녕\n\n하세요\t반가워요 ')).toBe('안녕 하세요 반가워요');
    expect([...makeExcerpt('가'.repeat(500))]).toHaveLength(EXCERPT_LENGTH);
  });

  it('마크다운 기호를 걷어낸다', () => {
    const markdown = [
      '# 제목',
      '**굵게** 와 *기울임*, `코드` 그리고 [링크](https://a.dev)',
      '![이미지](https://a.dev/x.png)',
      '> 인용문',
      '- 목록',
      '1. 번호',
      '---',
      '```js',
      'const snake_case = 1;',
      '```',
      '',
    ].join('\n');
    expect(makeExcerpt(markdown)).toBe('제목 굵게 와 기울임, 코드 그리고 링크 인용문 목록 번호 const snake_case = 1;');
  });
});

describe('커뮤니티', () => {
  it('전체 흐름: 채널 · 글 · 페이지네이션 · 좋아요 · 댓글 · 권한', async () => {
    const alice = await signup('alice@test.dev', '앨리스');
    const bob = await signup('bob@test.dev', '바비');

    // 비로그인 글쓰기 불가
    await http().post('/api/posts').send({ channel: 'free', title: 't', content: 'c' }).expect(401);

    // 채널 만들기
    const created = await http()
      .post('/api/channels')
      .set(bearer(alice))
      .send({ slug: 'cats', name: '고양이', description: '냥냥' })
      .expect(201);
    expect(created.body.mine).toBe(true);
    expect(created.body.ownerNickname).toBe('앨리스');

    // 'cats' 는 만든 사람이라 자동 가입, 'free' 는 가입해야 글을 쓸 수 있다
    expect((await http().post('/api/channels/free/members').set(bearer(alice))).body.joined).toBe(true);

    // 글 25개 → 커서 페이지네이션
    let lastId = 0;
    for (let i = 1; i <= 25; i++) {
      const res = await http()
        .post('/api/posts')
        .set(bearer(alice))
        .send({ channel: i % 2 === 0 ? 'cats' : 'free', title: `제목 ${i}`, content: `본문   \n\n **내용** ${i}` })
        .expect(201);
      expect(res.body.mine).toBe(true);
      lastId = res.body.id;
    }

    const page1 = (await http().get('/api/posts').query({ size: 10 })).body;
    expect(page1.items).toHaveLength(10);
    expect(page1.items[0].title).toBe('제목 25');
    expect(page1.items[0].excerpt).toBe('본문 내용 25');
    expect((await http().get('/api/posts').query({ size: 10, cursor: page1.nextCursor })).body.items[0].title).toBe('제목 15');
    const tail = (await http().get('/api/posts').query({ size: 10, cursor: 6 })).body;
    expect(tail.items).toHaveLength(5);
    expect(tail.nextCursor).toBeUndefined();

    // 채널 / 검색 필터
    const cats = (await http().get('/api/posts').query({ channel: 'cats', size: 50 })).body;
    expect(cats.items).toHaveLength(12);
    expect(cats.items[0].channelName).toBe('고양이');
    expect((await http().get('/api/channels/cats')).body.postCount).toBe(12);
    expect((await http().get('/api/channels').query({ q: '고양' })).body[0].slug).toBe('cats');
    expect((await http().get('/api/channels')).body[0].slug).toBe('free'); // 글 13개로 1위
    expect((await http().get('/api/posts').query({ q: '제목 2' })).body.items).toHaveLength(7); // 2, 20~25
    expect((await http().get('/api/posts').query({ q: '%' })).body.items).toHaveLength(0);

    // 조회수: 같은 사람이 다시 보거나 새로고침해도 한 번만 오른다
    const views = async (headers: Record<string, string> = {}) => (await http().get(`/api/posts/${lastId}`).set(headers)).body.viewCount;
    expect(await views(bearer(bob))).toBe(1);
    expect(await views(bearer(bob))).toBe(1);
    expect(await views(bearer(alice))).toBe(2);
    expect(await views({ 'X-Viewer': 'guest-browser-1' })).toBe(3);
    expect(await views({ 'X-Viewer': 'guest-browser-1' })).toBe(3);
    expect(await views({ 'X-Viewer': 'guest-browser-2' })).toBe(4);
    // 비로그인 표식이 없으면 IP + 브라우저로 구분한다
    expect(await views({ 'User-Agent': 'test-agent' })).toBe(5);
    expect(await views({ 'User-Agent': 'test-agent' })).toBe(5);
    await http().get('/api/posts/999999').expect(404);

    // 좋아요 (중복 요청은 멱등)
    let like = await http().post(`/api/posts/${lastId}/like`).set(bearer(bob)).expect(200);
    expect(like.body).toEqual({ liked: true, likeCount: 1 });
    expect((await http().post(`/api/posts/${lastId}/like`).set(bearer(bob))).body.likeCount).toBe(1);
    const seen = (await http().get(`/api/posts/${lastId}`).set(bearer(bob))).body;
    expect(seen.liked).toBe(true);
    expect(seen.mine).toBe(false);
    expect((await http().get('/api/posts/popular').query({ channel: 'free' })).body[0].id).toBe(lastId);
    expect((await http().get('/api/posts/popular').query({ channel: 'cats' })).body[0].likeCount).toBe(0);
    like = await http().delete(`/api/posts/${lastId}/like`).set(bearer(bob));
    expect(like.body).toEqual({ liked: false, likeCount: 0 });

    // 댓글
    const comment = (await http().post(`/api/posts/${lastId}/comments`).set(bearer(bob)).send({ content: '좋은 글이네요' }).expect(201)).body;
    const comments = (await http().get(`/api/posts/${lastId}/comments`)).body;
    expect(comments.items).toHaveLength(1);
    expect(comments.items[0].authorNickname).toBe('바비');
    expect((await http().get(`/api/posts/${lastId}`)).body.commentCount).toBe(1);

    // 댓글 좋아요 & 베스트 댓글 (좋아요 2개 이상)
    const commentLike = `/api/posts/${lastId}/comments/${comment.id}/like`;
    expect((await http().post(commentLike).set(bearer(alice))).body).toEqual({ liked: true, likeCount: 1 });
    expect((await http().post(commentLike).set(bearer(alice))).body.likeCount).toBe(1);
    expect((await http().get(`/api/posts/${lastId}/comments/best`)).body).toHaveLength(0);
    expect((await http().post(commentLike).set(bearer(bob))).body.likeCount).toBe(2);
    const best = (await http().get(`/api/posts/${lastId}/comments/best`).set(bearer(alice))).body;
    expect(best).toHaveLength(1);
    expect(best[0].liked).toBe(true);
    expect(best[0].likeCount).toBe(2);
    expect((await http().get(`/api/posts/${lastId}/comments`).set(bearer(alice))).body.items[0].liked).toBe(true);
    expect((await http().get(`/api/posts/${lastId}/comments`)).body.items[0].liked).toBe(false);
    expect((await http().delete(commentLike).set(bearer(bob))).body.likeCount).toBe(1);
    await http().delete(`/api/posts/${lastId}/comments/${comment.id}`).set(bearer(alice)).expect(403);
    await http().delete(`/api/posts/${lastId}/comments/${comment.id}`).set(bearer(bob)).expect(204);
    expect((await http().get(`/api/posts/${lastId}`)).body.commentCount).toBe(0);

    // 수정 / 삭제 권한
    const edit = { title: '수정됨', content: '# 수정 본문' };
    await http().put(`/api/posts/${lastId}`).set(bearer(bob)).send(edit).expect(403);
    const edited = (await http().put(`/api/posts/${lastId}`).set(bearer(alice)).send(edit)).body;
    expect(edited.title).toBe('수정됨');
    expect(edited.channel.slug).toBe('free');
    expect(edited.content).toBe('# 수정 본문');
    await http().post(`/api/posts/${lastId}/like`).set(bearer(bob)).expect(200);
    await http().delete(`/api/posts/${lastId}`).set(bearer(alice)).expect(204);
    await http().get(`/api/posts/${lastId}`).expect(404);
    expect((await http().get('/api/channels/free')).body.postCount).toBe(12);
  });

  it('채널 규칙', async () => {
    const owner = await signup('owner@test.dev', '채널주인');
    const stranger = await signup('other@test.dev', '지나가는사람');
    const req = { slug: 'books', name: '독서', description: '책 이야기' };

    await http().post('/api/channels').send(req).expect(401);
    const made = (await http().post('/api/channels').set(bearer(owner)).send(req).expect(201)).body;
    // 기본 프로필 색은 만들 때 정해져 고리와 상관없이 그대로 (안 주면 무작위)
    expect(made.color).toBeGreaterThanOrEqual(0);
    expect(made.color).toBeLessThan(8);
    await http().post('/api/channels').set(bearer(stranger)).send(req).expect(409);
    await http().post('/api/channels').set(bearer(stranger)).send({ slug: 'colored', name: '색고른채널', color: 3 }).expect(201);
    expect((await http().get('/api/channels/colored')).body.color).toBe(3);
    await http().post('/api/channels').set(bearer(stranger)).send({ slug: 'badcolor', name: '잘못된색', color: 99 }).expect(400);
    await http().post('/api/channels').set(bearer(stranger)).send({ slug: 'books2', name: '독서' }).expect(409);
    await http().post('/api/channels').set(bearer(stranger)).send({ slug: 'new', name: '새채널' }).expect(409);
    await http().post('/api/channels').set(bearer(stranger)).send({ slug: 'Bad Slug!', name: '잘못된주소' }).expect(400);
    await http().post('/api/posts').set(bearer(stranger)).send({ channel: 'nope', title: 't', content: 'c' }).expect(404);

    const edit = { name: '책과 사람', description: '바뀐 소개' };
    await http().put('/api/channels/books').set(bearer(stranger)).send(edit).expect(403);
    const updated = (await http().put('/api/channels/books').set(bearer(owner)).send(edit).expect(200)).body;
    expect(updated.name).toBe('책과 사람');
    expect(updated.slug).toBe('books');
    await http().put('/api/channels/free').set(bearer(owner)).send(edit).expect(403);
  });

  it('채널 카테고리', async () => {
    const owner = await signup('cat-owner@test.dev', '창작주인');
    const member = await signup('cat-member@test.dev', '창작회원');
    expect((await http().post('/api/channels').set(bearer(owner)).send({ slug: 'art', name: '그림방' })).body.categories).toHaveLength(0);
    const base = '/api/channels/art/categories';

    // 소유자·관리자만 카테고리를 만들 수 있다
    await http().post(base).set(bearer(member)).send({ name: '공지사항', ownerOnly: true }).expect(403);
    expect((await http().post(base).set(bearer(owner)).send({ name: '공지사항', ownerOnly: true }).expect(200)).body).toHaveLength(1);
    await http().post(base).set(bearer(owner)).send({ name: '소설', ownerOnly: false });
    const cats = (await http().post(base).set(bearer(owner)).send({ name: '일러스트', ownerOnly: false })).body;
    expect(cats.map((c: { name: string }) => c.name)).toEqual(['공지사항', '소설', '일러스트']);
    const [notice, novel, art] = cats.map((c: { id: number }) => c.id);
    await http().post(base).set(bearer(owner)).send({ name: '소설', ownerOnly: false }).expect(409);

    // 순서 바꾸기 (일부만 보내면 거절)
    await http().put(`${base}/order`).set(bearer(owner)).send({ ids: [art, notice] }).expect(400);
    const reordered = (await http().put(`${base}/order`).set(bearer(owner)).send({ ids: [notice, art, novel] }).expect(200)).body;
    expect(reordered.map((c: { name: string }) => c.name)).toEqual(['공지사항', '일러스트', '소설']);
    const channel = (await http().get('/api/channels/art')).body;
    expect(channel.categories[1].name).toBe('일러스트');
    expect(channel.categories[0].ownerOnly).toBe(true);

    await http().post('/api/channels/art/members').set(bearer(member)).expect(200);
    await http().post('/api/channels/free/members').set(bearer(member)).expect(200);

    // 운영진 전용 카테고리: 일반 멤버는 못 쓰고 소유자는 쓸 수 있다
    await http().post('/api/posts').set(bearer(member)).send({ channel: 'art', categoryId: notice, title: '공지', content: 'c' }).expect(403);
    expect(
      (await http().post('/api/posts').set(bearer(owner)).send({ channel: 'art', categoryId: notice, title: '공지', content: 'c' })).body.category
        .name,
    ).toBe('공지사항');
    const novelPost = (await http().post('/api/posts').set(bearer(member)).send({ channel: 'art', categoryId: novel, title: '소설 1화', content: 'c' }))
      .body;
    expect(novelPost.category.name).toBe('소설');
    // 카테고리가 있는 채널은 카테고리를 골라야 한다
    await http().post('/api/posts').set(bearer(member)).send({ channel: 'art', title: '잡담', content: 'c' }).expect(400);
    await http().post('/api/posts').set(bearer(member)).send({ channel: 'art', categoryId: art, title: '잡담', content: 'c' }).expect(201);
    // 다른 채널의 카테고리는 쓸 수 없다
    await http().post('/api/posts').set(bearer(member)).send({ channel: 'free', categoryId: novel, title: 't', content: 'c' }).expect(400);

    // 카테고리 탭 목록
    const tab = (await http().get('/api/posts').query({ channel: 'art', category: novel })).body;
    expect(tab.items).toHaveLength(1);
    expect(tab.items[0].categoryName).toBe('소설');
    expect((await http().get('/api/posts').query({ channel: 'art' })).body.items).toHaveLength(3);

    // 글의 카테고리 바꾸기
    const postId = novelPost.id;
    expect((await http().put(`/api/posts/${postId}`).set(bearer(member)).send({ categoryId: art, title: '그림으로 바꿈', content: 'c' })).body.category.name).toBe(
      '일러스트',
    );
    await http().put(`/api/posts/${postId}`).set(bearer(member)).send({ categoryId: notice, title: 't', content: 'c' }).expect(403);

    // 운영진 전용 카테고리는 항상 일반 카테고리보다 위: 새로 만들면 운영진 전용 중 맨 아래, 순서를 바꿔도 아래로 못 간다
    const names = (list: { name: string }[]) => list.map((c) => c.name);
    const withRules = (await http().post(base).set(bearer(owner)).send({ name: '규칙', ownerOnly: true }).expect(200)).body;
    expect(names(withRules)).toEqual(['공지사항', '규칙', '일러스트', '소설']);
    const rules = withRules[1].id;
    expect(names((await http().put(`${base}/order`).set(bearer(owner)).send({ ids: [notice, art, novel, rules] }).expect(200)).body)).toEqual([
      '공지사항',
      '규칙',
      '일러스트',
      '소설',
    ]);
    // 일반 카테고리를 운영진 전용으로 바꾸면 운영진 전용 무리의 맨 아래로
    expect(names((await http().put(`${base}/${novel}`).set(bearer(owner)).send({ name: '소설', ownerOnly: true }).expect(200)).body)).toEqual([
      '공지사항',
      '규칙',
      '소설',
      '일러스트',
    ]);
    await http().put(`${base}/${novel}`).set(bearer(owner)).send({ name: '소설', ownerOnly: false }).expect(200);
    await http().delete(`${base}/${rules}`).set(bearer(owner)).expect(200);

    // 이름 변경 / 삭제 → 글은 지우지 않고 고른 카테고리로 옮긴다
    expect((await http().put(`${base}/${art}`).set(bearer(owner)).send({ name: '그림', ownerOnly: false })).body[2].name).toBe('그림');
    expect((await http().get(`/api/posts/${postId}`)).body.category.name).toBe('그림');
    await http().delete(`${base}/${art}`).set(bearer(member)).expect(403);
    expect((await http().get(`${base}/post-counts`).set(bearer(owner)).expect(200)).body).toEqual({ [notice]: 1, [art]: 2 });
    await http().delete(`${base}/${art}`).set(bearer(owner)).expect(400); // 옮길 곳을 골라야 한다
    await http().delete(`${base}/${art}`).query({ moveTo: art }).set(bearer(owner)).expect(400);
    expect((await http().delete(`${base}/${art}`).query({ moveTo: novel }).set(bearer(owner)).expect(200)).body).toHaveLength(2);
    expect((await http().get(`/api/posts/${postId}`)).body.category.name).toBe('소설');
    // 글이 없는 카테고리는 그냥 지운다. 마지막 카테고리면 글은 카테고리 없이 남는다
    await http().delete(`${base}/${notice}`).query({ moveTo: novel }).set(bearer(owner)).expect(200);
    expect((await http().delete(`${base}/${novel}`).set(bearer(owner)).expect(200)).body).toHaveLength(0);
    const orphan = await http().get(`/api/posts/${postId}`).expect(200);
    expect(orphan.body.category).toBeUndefined();
    expect((await http().get('/api/channels/art')).body.postCount).toBe(3);
  });

  it('채널 목록: 채널마다 최근 글 미리보기', async () => {
    const owner = await signup('preview@test.dev', '미리보기');
    for (const slug of ['pv-many', 'pv-few', 'pv-empty']) {
      await http().post('/api/channels').set(bearer(owner)).send({ slug, name: `미리${slug.slice(3)}` }).expect(201);
    }
    for (let i = 1; i <= 10; i++) await http().post('/api/posts').set(bearer(owner)).send({ channel: 'pv-many', title: `많은글 ${i}`, content: 'c' });
    for (let i = 1; i <= 2; i++) await http().post('/api/posts').set(bearer(owner)).send({ channel: 'pv-few', title: `적은글 ${i}`, content: 'c' });

    const list = (await http().get('/api/channels/previews').query({ q: '미리' }).expect(200)).body;
    const bySlug = Object.fromEntries(list.map((c: { slug: string }) => [c.slug, c]));
    expect(Object.keys(bySlug)).toEqual(expect.arrayContaining(['pv-many', 'pv-few', 'pv-empty']));
    const many = bySlug['pv-many'].recentPosts;
    expect(many).toHaveLength(8); // 최대 8개
    expect(many[0].title).toBe('많은글 10'); // 최신순
    expect(many[7].title).toBe('많은글 3');
    expect(bySlug['pv-few'].recentPosts).toHaveLength(2);
    expect(bySlug['pv-empty'].recentPosts).toHaveLength(0);

    // 개수 지정 (상한 8)
    expect((await http().get('/api/channels/previews').query({ q: '미리many', size: 3 })).body[0].recentPosts).toHaveLength(3);
    expect((await http().get('/api/channels/previews').query({ q: '미리many', size: 50 })).body[0].recentPosts).toHaveLength(8);
    // 검색어 없이 부르면 인기 채널 기준
    await http().get('/api/channels/previews').expect(200);
    // 'previews' 는 고리로 쓸 수 없다
    await http().post('/api/channels').set(bearer(owner)).send({ slug: 'previews', name: '예약어' }).expect(409);
  });

  it('채널 가입', async () => {
    const owner = await signup('club-owner@test.dev', '모임장');
    const guest = await signup('club-guest@test.dev', '구경꾼');
    const club = (await http().post('/api/channels').set(bearer(owner)).send({ slug: 'club', name: '동호회' })).body;
    expect(club.joined).toBe(true);
    expect(club.memberCount).toBe(1);
    const postId = (await http().post('/api/posts').set(bearer(owner)).send({ channel: 'club', title: '환영해요', content: 'c' }).expect(201)).body.id;

    // 가입 안 한 사람: 글쓰기는 막히고
    expect((await http().get('/api/channels/club').set(bearer(guest))).body.joined).toBe(false);
    const denied = await http().post('/api/posts').set(bearer(guest)).send({ channel: 'club', title: 't', content: 'c' }).expect(403);
    expect(denied.body.message).toBe("'동호회' 채널을 팔로우해야 글을 쓸 수 있어요");
    // 보기 · 공감 · 댓글 · 댓글 좋아요는 된다
    await http().get(`/api/posts/${postId}`).set(bearer(guest)).expect(200);
    expect((await http().post(`/api/posts/${postId}/like`).set(bearer(guest))).body.liked).toBe(true);
    const commentId = (await http().post(`/api/posts/${postId}/comments`).set(bearer(guest)).send({ content: '구경 왔어요' }).expect(201)).body.id;
    expect((await http().post(`/api/posts/${postId}/comments/${commentId}/like`).set(bearer(guest))).body.liked).toBe(true);

    // 가입하면 글을 쓸 수 있다 (여러 번 눌러도 한 번만)
    expect((await http().post('/api/channels/club/members').set(bearer(guest))).body).toEqual({ joined: true, memberCount: 2 });
    expect((await http().post('/api/channels/club/members').set(bearer(guest))).body.memberCount).toBe(2);
    await http().post('/api/posts').set(bearer(guest)).send({ channel: 'club', title: '가입 인사', content: 'c' }).expect(201);
    const mine = (await http().get('/api/me/channels').set(bearer(guest))).body;
    expect(mine[0]).toMatchObject({ slug: 'club', memberCount: 2, owner: false });
    expect((await http().get('/api/me/channels').set(bearer(owner))).body[0].owner).toBe(true);
    expect((await http().get('/api/channels/previews').query({ q: '동호회' }).set(bearer(guest))).body[0].joined).toBe(true);
    expect((await http().get('/api/channels/previews').query({ q: '동호회' })).body[0].joined).toBe(false);

    // 팔로우한 채널은 북마크한 채널이 먼저, 그다음 최근에 팔로우한 순
    await http().post('/api/channels/free/members').set(bearer(guest)).expect(200);
    expect((await http().get('/api/me/channels').set(bearer(guest))).body.map((c: { slug: string }) => c.slug)).toEqual(['free', 'club']);
    await http().put('/api/channels/club/bookmark').set(bearer(guest)).expect(200);
    expect((await http().get('/api/me/channels').set(bearer(guest))).body.map((c: { slug: string }) => c.slug)).toEqual(['club', 'free']);
    await http().delete('/api/channels/free/members/me').set(bearer(guest)).expect(200);

    // 탈퇴하면 다시 못 쓴다. 만든 사람은 탈퇴할 수 없다
    expect((await http().delete('/api/channels/club/members/me').set(bearer(guest))).body).toEqual({ joined: false, memberCount: 1 });
    await http().post('/api/posts').set(bearer(guest)).send({ channel: 'club', title: 't', content: 'c' }).expect(403);
    await http().delete('/api/channels/club/members/me').set(bearer(owner)).expect(400);
    await http().post('/api/channels/club/members').expect(401);
    expect((await http().get('/api/me/channels').set(bearer(guest))).body).toHaveLength(0);
  });

  it('운영진 역할과 배지', async () => {
    const owner = await signup('staff-owner@test.dev', '방장');
    const admin = await signup('staff-admin@test.dev', '관리');
    const manager = await signup('staff-manager@test.dev', '매니');
    const member = await signup('staff-member@test.dev', '멤버');
    const created = (await http().post('/api/channels').set(bearer(owner)).send({ slug: 'staffs', name: '운영진채널' })).body;
    expect(created.myRole).toBe('OWNER');
    expect(created.canManage).toBe(true);
    for (const t of [admin, manager, member]) await http().post('/api/channels/staffs/members').set(bearer(t)).expect(200);
    const found = (await http().get('/api/channels/staffs/members').query({ q: '관리' }).set(bearer(owner))).body;
    expect(found).toHaveLength(1);
    const adminId = found[0].userId;
    const managerId = (await http().get('/api/channels/staffs/members').query({ q: '매니' }).set(bearer(owner))).body[0].userId;
    const role = (userId: number, token: string, value: string) =>
      http().put(`/api/channels/staffs/members/${userId}/role`).set(bearer(token)).send({ role: value });

    // 운영진 지정은 소유자만
    await role(adminId, member, 'ADMIN').expect(403);
    await http().get('/api/channels/staffs/members').query({ q: '관리' }).set(bearer(member)).expect(403);
    await role(adminId, owner, 'ADMIN').expect(200);
    expect((await role(managerId, owner, 'MANAGER')).body.map((s: { role: string }) => s.role)).toEqual(['OWNER', 'ADMIN', 'MANAGER']);
    await role(adminId, owner, 'OWNER').expect(400);
    expect((await http().get('/api/channels/staffs/staff')).body).toHaveLength(3);

    // 관리자는 채널을 관리할 수 있고, 매니저는 못 한다
    const asAdmin = (await http().get('/api/channels/staffs').set(bearer(admin))).body;
    expect(asAdmin).toMatchObject({ myRole: 'ADMIN', canManage: true, mine: false });
    await http().put('/api/channels/staffs').set(bearer(admin)).send({ name: '운영진채널', description: '## 소개\n\n**마크다운**' }).expect(200);
    await http().put('/api/channels/staffs').set(bearer(manager)).send({ name: '운영진채널', description: 'x' }).expect(403);
    const asMember = (await http().get('/api/channels/staffs').set(bearer(member))).body;
    expect(asMember.myRole).toBeUndefined();
    expect(asMember.staff).toBe(false);

    // 운영진 전용 카테고리: 매니저는 쓸 수 있고 일반 멤버는 못 쓴다
    const notice = (await http().post('/api/channels/staffs/categories').set(bearer(admin)).send({ name: '공지', ownerOnly: true })).body[0].id;
    const free = (await http().post('/api/channels/staffs/categories').set(bearer(admin)).send({ name: '자유', ownerOnly: false })).body[1].id;
    const staffPost = await http()
      .post('/api/posts')
      .set(bearer(manager))
      .send({ channel: 'staffs', categoryId: notice, title: '공지', content: 'c' })
      .expect(201);
    expect(staffPost.body.author.role).toBe('MANAGER');
    await http().post('/api/posts').set(bearer(member)).send({ channel: 'staffs', categoryId: notice, title: 't', content: 'c' }).expect(403);

    // 목록·댓글의 닉네임 옆 배지: 일반 멤버는 역할이 없다
    const memberPost = (await http().post('/api/posts').set(bearer(member)).send({ channel: 'staffs', categoryId: free, title: '멤버 글', content: 'c' })).body.id;
    const list = (await http().get('/api/posts').query({ channel: 'staffs' })).body.items;
    expect(list[0].authorRole).toBeUndefined();
    expect(list[1].authorRole).toBe('MANAGER');
    expect((await http().post(`/api/posts/${memberPost}/comments`).set(bearer(owner)).send({ content: '환영' })).body.authorRole).toBe('OWNER');
    const memberComment = (await http().post(`/api/posts/${memberPost}/comments`).set(bearer(member)).send({ content: 'hi' })).body.id;
    // 최근 댓글이 위에
    const comments = (await http().get(`/api/posts/${memberPost}/comments`)).body.items;
    expect(comments[1].authorRole).toBe('OWNER');
    expect(comments[0].authorRole).toBeUndefined();

    // 운영진은 아래 역할의 글·댓글을 지울 수 있다. 일반 멤버는 못 한다
    expect((await http().get(`/api/posts/${memberPost}`).set(bearer(manager))).body.canModerate).toBe(true);
    expect((await http().get(`/api/posts/${staffPost.body.id}`).set(bearer(member))).body.canModerate).toBe(false);
    await http().delete(`/api/posts/${staffPost.body.id}`).set(bearer(member)).expect(403);
    // 매니저는 더 높은 운영진(소유자)의 댓글은 지울 수 없다
    const ownerComment = comments[1].id;
    const asManager = (await http().get(`/api/posts/${memberPost}/comments`).set(bearer(manager))).body.items;
    expect(asManager[1].deletable).toBe(false);
    expect(asManager[0].deletable).toBe(true);
    await http().delete(`/api/posts/${memberPost}/comments/${ownerComment}`).set(bearer(manager)).expect(403);
    expect((await http().get(`/api/posts/${staffPost.body.id}`).set(bearer(admin))).body.canModerate).toBe(true);
    await http().delete(`/api/posts/${memberPost}/comments/${memberComment}`).set(bearer(manager)).expect(204);
    await http().delete(`/api/posts/${memberPost}`).set(bearer(manager)).expect(204);

    // 일반 멤버로 되돌리면 권한과 배지가 없어진다
    expect((await role(managerId, owner, 'MEMBER')).body).toHaveLength(2);
    expect((await http().get(`/api/posts/${staffPost.body.id}`)).body.author.role).toBeUndefined();
  });

  it('본문 이미지 올리기', async () => {
    const me = await signup('img@test.dev', '사진가');
    const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]);
    const upload = (type: string, body: Buffer, token?: string) => {
      const req = http().post('/api/images').set('Content-Type', type);
      return (token ? req.set(bearer(token)) : req).send(body);
    };
    await upload('image/webp', webp).expect(401);
    await upload('text/html', webp, me).expect(400);
    expect((await upload('image/webp', Buffer.alloc(3 * 1024 * 1024 + 1), me).expect(400)).body.message).toBe('이미지는 3MB 이하로 올려 주세요');
    const { id, url } = (await upload('image/webp', webp, me).expect(201)).body;
    expect(url).toBe(`/api/images/${id}`);
    // 누구나 볼 수 있고, 바뀌지 않으므로 오래 캐시한다
    const res = await http().get(url).buffer(true).parse(binary).expect(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['cache-control']).toContain('immutable');
    expect(Buffer.compare(res.body as Buffer, webp)).toBe(0);
    await http().get('/api/images/doesnotexist0000000').expect(404);
    await http().get('/api/images/..%2Fetc').expect(404);
  });

  it('채널 글 목록: 번호 페이지 · 검색 · 정렬 · 공지 고정 · 작성자 프로필', async () => {
    const owner = await signup('page-owner@test.dev', '페이지주인');
    const reader = await signup('page-reader@test.dev', '페이지독자');
    await http().post('/api/channels').set(bearer(owner)).send({ slug: 'paging', name: '페이지방' }).expect(201);
    const base = '/api/channels/paging/categories';
    const [notice, talk] = (
      await http().post(base).set(bearer(owner)).send({ name: '공지사항', ownerOnly: true }).then(() =>
        http().post(base).set(bearer(owner)).send({ name: '잡담', ownerOnly: false }),
      )
    ).body.map((c: { id: number }) => c.id);
    const write = (title: string, content: string, categoryId?: number) =>
      http().post('/api/posts').set(bearer(owner)).send({ channel: 'paging', title, content, categoryId }).expect(201).then((r) => r.body.id as number);
    await write('공지 1', '규칙', notice);
    await write('공지 2', '규칙 2', notice);
    const ids: number[] = [];
    for (let i = 1; i <= 23; i++) ids.push(await write(`글 ${i}`, i === 7 ? '본문에 사과가 있어요' : '내용', talk));
    // 7번 글에 좋아요 → 공감순 1위
    await http().post(`/api/posts/${ids[6]}/like`).set(bearer(reader)).expect(200);

    const page = (q: Record<string, string | number>) => http().get('/api/posts/page').query({ channel: 'paging', ...q }).expect(200).then((r) => r.body);
    // 전체 탭: 공지는 빼고 20개씩
    const p1 = await page({ excludeNotices: 'true' });
    expect(p1).toMatchObject({ total: 23, page: 1, size: 20, pages: 2 });
    expect(p1.items[0].title).toBe('글 23');
    // 사용자 id 는 UUID (가입 순서가 드러나지 않게)
    expect(p1.items[0].authorId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    const p2 = await page({ excludeNotices: 'true', page: 2 });
    expect(p2.items.map((p: { title: string }) => p.title)).toEqual(['글 3', '글 2', '글 1']);
    // 범위를 넘는 페이지는 마지막 페이지로
    expect((await page({ excludeNotices: 'true', page: 99 })).page).toBe(2);
    // 공지를 빼지 않으면 25개
    expect((await page({})).total).toBe(25);
    // 정렬 · 카테고리 · 검색(제목·본문)
    expect((await page({ sort: 'likes' })).items[0].title).toBe('글 7');
    expect((await page({ category: notice })).total).toBe(2);
    expect((await page({ q: '사과' })).items.map((p: { title: string }) => p.title)).toEqual(['글 7']);
    expect((await page({ q: '글 2' })).total).toBe(5); // 글 2, 20~23
    await http().get('/api/posts/page').expect(400);

    // 공지 (운영진 전용 카테고리 글), 최신순
    const notices = (await http().get('/api/posts/notices').query({ channel: 'paging' }).expect(200)).body;
    expect(notices.map((p: { title: string }) => p.title)).toEqual(['공지 2', '공지 1']);

    // 작성자 프로필: 공개 정보만
    const profile = (await http().get(`/api/users/${p1.items[0].authorId}`).expect(200)).body;
    expect(profile).toMatchObject({ nickname: '페이지주인', postCount: 25, commentCount: 0 });
    expect(profile.email).toBeUndefined();
    await http().get('/api/users/999999').expect(404);
    await http().get('/api/users/00000000-0000-0000-0000-000000000000').expect(404);
    await http().get('/api/users/abc').expect(404);
  });

  it('비공개 채널: 초대 코드로만 팔로우, 팔로워만 보기', async () => {
    const owner = await signup('priv-owner@test.dev', '비밀주인');
    const friend = await signup('priv-friend@test.dev', '초대받은');
    const stranger = await signup('priv-stranger@test.dev', '지나가는');
    const made = (await http().post('/api/channels').set(bearer(owner)).send({ slug: 'secret', name: '비밀방', visibility: 'private' }).expect(201)).body;
    expect(made.visibility).toBe('private');
    const code = made.inviteCode as string;
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
    const postId = (await http().post('/api/posts').set(bearer(owner)).send({ channel: 'secret', title: '비밀 글', content: '쉿' }).expect(201)).body.id;

    // 목록 · 검색 · 홈 피드 · 인기글에 나오지 않는다
    expect((await http().get('/api/channels').query({ q: '비밀' })).body).toHaveLength(0);
    expect((await http().get('/api/channels')).body.some((c: { slug: string }) => c.slug === 'secret')).toBe(false);
    expect((await http().get('/api/posts').set(bearer(stranger))).body.items.some((p: { id: number }) => p.id === postId)).toBe(false);

    // 팔로워가 아니면 이름·프로필만 (잠김), 글·댓글은 403
    const locked = (await http().get('/api/channels/secret').set(bearer(stranger)).expect(200)).body;
    expect(locked).toMatchObject({ locked: 'private', name: '비밀방', categories: [] });
    expect(locked.inviteCode).toBeUndefined();
    await http().get(`/api/posts/${postId}`).set(bearer(stranger)).expect(403);
    await http().get(`/api/posts/${postId}/comments`).expect(403);
    await http().get('/api/posts/page').query({ channel: 'secret' }).set(bearer(stranger)).expect(403);
    await http().get('/api/posts').query({ channel: 'secret' }).expect(403);

    // 코드 없이 · 틀린 코드로는 팔로우할 수 없다
    await http().post('/api/channels/secret/members').set(bearer(stranger)).send({}).expect(403);
    await http().post('/api/channels/secret/members').set(bearer(stranger)).send({ code: 'WRONG123' }).expect(403);

    // 초대 화면 → 초대 코드로 팔로우 (소문자로 입력해도 된다)
    expect((await http().get(`/api/invites/${code}`).expect(200)).body).toMatchObject({ slug: 'secret', name: '비밀방', joined: false });
    expect((await http().post(`/api/invites/${code.toLowerCase()}`).set(bearer(friend)).expect(200)).body.slug).toBe('secret');
    expect((await http().get(`/api/posts/${postId}`).set(bearer(friend)).expect(200)).body.title).toBe('비밀 글');
    expect((await http().get('/api/channels/secret').set(bearer(friend))).body.locked).toBeUndefined();

    // 초대 코드 새로 만들기 → 예전 코드는 막힌다 (관리자만)
    await http().post('/api/channels/secret/invite').set(bearer(friend)).expect(403);
    const next = (await http().post('/api/channels/secret/invite').set(bearer(owner)).expect(200)).body.inviteCode;
    expect(next).not.toBe(code);
    await http().get(`/api/invites/${code}`).expect(404);
    await http().post('/api/channels/secret/members').set(bearer(stranger)).send({ code: next }).expect(200);

    // 공개로 바꾸면 누구나
    await http().put('/api/channels/secret').set(bearer(owner)).send({ name: '비밀방', visibility: 'public' }).expect(200);
    expect((await http().get('/api/channels').query({ q: '비밀' })).body).toHaveLength(1);
  });

  it('만 19세 이상: 나이 확인한 사람만 채널·카테고리를 본다', async () => {
    const adult = await signup('adult@test.dev', '어른');
    const minor = await signup('minor@test.dev', '청소년');
    const guest = await signup('noage@test.dev', '미확인');
    // 나이 확인 전에는 19세 이상 채널을 만들 수 없다
    await http().post('/api/channels').set(bearer(adult)).send({ slug: 'grown', name: '어른방', adult: true }).expect(403);
    await http().put('/api/me/age').set(bearer(adult)).send({ birthDate: '1990-05-01' }).expect(200);
    expect((await http().get('/api/me').set(bearer(adult))).body).toMatchObject({ ageChecked: true, adult: true });
    // 테스트 중이라 다시 바꿀 수 있다
    expect((await http().put('/api/me/age').set(bearer(adult)).send({ birthDate: `${new Date().getFullYear() - 10}-01-01` }).expect(200)).body.adult).toBe(false);
    expect((await http().put('/api/me/age').set(bearer(adult)).send({ birthDate: '1990-05-01' }).expect(200)).body).toMatchObject({ adult: true, birthDate: '1990-05-01' });
    const thisYear = new Date().getFullYear();
    expect((await http().put('/api/me/age').set(bearer(minor)).send({ birthDate: `${thisYear - 15}-01-01` }).expect(200)).body.adult).toBe(false);
    await http().put('/api/me/age').set(bearer(guest)).send({ birthDate: '2001-02-30' }).expect(400);

    await http().post('/api/channels').set(bearer(adult)).send({ slug: 'grown', name: '어른방', adult: true }).expect(201);
    const postId = (await http().post('/api/posts').set(bearer(adult)).send({ channel: 'grown', title: '어른 글', content: 'c' }).expect(201)).body.id;
    // 성인에게만 목록에 보이고, 아니면 잠김
    expect((await http().get('/api/channels').query({ q: '어른' }).set(bearer(adult))).body).toHaveLength(1);
    expect((await http().get('/api/channels').query({ q: '어른' }).set(bearer(minor))).body).toHaveLength(0);
    expect((await http().get('/api/channels/grown').set(bearer(minor))).body.locked).toBe('adult');
    expect((await http().get('/api/channels/grown')).body.locked).toBe('adult');
    await http().get(`/api/posts/${postId}`).set(bearer(minor)).expect(403);
    expect((await http().get(`/api/posts/${postId}`).set(bearer(adult)).expect(200)).body.title).toBe('어른 글');
    await http().post('/api/channels/grown/members').set(bearer(minor)).expect(403);

    // 일반 채널 안의 19세 이상 카테고리
    await http().post('/api/channels').set(bearer(adult)).send({ slug: 'mixed', name: '섞인방' }).expect(201);
    const cats = (await http().post('/api/channels/mixed/categories').set(bearer(adult)).send({ name: '성인', adult: true }).expect(200)).body;
    expect(cats[0].adult).toBe(true);
    const adultCat = cats[0].id;
    await http().post('/api/channels/mixed/members').set(bearer(minor)).expect(200);
    await http().post('/api/posts').set(bearer(minor)).send({ channel: 'mixed', categoryId: adultCat, title: 't', content: 'c' }).expect(403);
    const hidden = (await http().post('/api/posts').set(bearer(adult)).send({ channel: 'mixed', categoryId: adultCat, title: '성인 카테고리 글', content: 'c' }).expect(201)).body.id;
    const normalCat = (await http().post('/api/channels/mixed/categories').set(bearer(adult)).send({ name: '보통' }).expect(200)).body[1].id;
    await http().post('/api/posts').set(bearer(adult)).send({ channel: 'mixed', categoryId: normalCat, title: '보통 글', content: 'c' }).expect(201);
    expect((await http().get('/api/channels/mixed').set(bearer(minor))).body.categories.map((c: { name: string }) => c.name)).toEqual(['보통']);
    expect((await http().get('/api/posts/page').query({ channel: 'mixed' }).set(bearer(minor))).body.items.map((p: { title: string }) => p.title)).toEqual(['보통 글']);
    expect((await http().get('/api/posts/page').query({ channel: 'mixed' }).set(bearer(adult))).body.total).toBe(2);
    await http().get(`/api/posts/${hidden}`).set(bearer(minor)).expect(403);
    // 만 19세 이상 카테고리는 만 19세 이상만 만들거나 그렇게 바꿀 수 있다
    await http().post('/api/channels').set(bearer(minor)).send({ slug: 'teen', name: '청소년방' }).expect(201);
    await http().post('/api/channels/teen/categories').set(bearer(minor)).send({ name: '성인', adult: true }).expect(403);
    const teenCat = (await http().post('/api/channels/teen/categories').set(bearer(minor)).send({ name: '일반' }).expect(200)).body[0].id;
    await http().put(`/api/channels/teen/categories/${teenCat}`).set(bearer(minor)).send({ name: '일반', adult: true }).expect(403);
  });

  it('프로필 사진 · 배너 · 포인트', async () => {
    const me = await signup('avatar@test.dev', '사진주인');
    const other = await signup('avatar-other@test.dev', '남의사진');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const upload = async (token: string) =>
      (await http().post('/api/images').set(bearer(token)).set('Content-Type', 'image/png').send(png).expect(201)).body.id as string;
    const mine = await upload(me);
    const theirs = await upload(other);

    // 프로필 사진: 내가 올린 이미지만
    await http().put('/api/me/avatar').set(bearer(me)).send({ imageId: theirs }).expect(400);
    const withAvatar = (await http().put('/api/me/avatar').set(bearer(me)).send({ imageId: mine }).expect(200)).body;
    expect(withAvatar.avatarUrl).toBe(`/api/images/${mine}`);
    const userId = withAvatar.id;
    // 글 · 댓글 · 프로필에 사진이 함께 온다
    await http().post('/api/channels/free/members').set(bearer(me)).expect(200);
    const postId = (await http().post('/api/posts').set(bearer(me)).send({ channel: 'free', title: '사진 있는 사람', content: 'c' }).expect(201)).body.id;
    expect((await http().get(`/api/posts/${postId}`)).body.author.avatarUrl).toBe(`/api/images/${mine}`);
    await http().post(`/api/posts/${postId}/comments`).set(bearer(me)).send({ content: '댓글' }).expect(201);
    expect((await http().get(`/api/posts/${postId}/comments`)).body.items[0].authorAvatar).toBe(`/api/images/${mine}`);
    expect((await http().get('/api/posts').query({ authorId: userId })).body.items[0].authorAvatar).toBe(`/api/images/${mine}`);
    expect((await http().put('/api/me/avatar').set(bearer(me)).send({ imageId: null }).expect(200)).body.avatarUrl).toBeUndefined();

    // 기본 배너는 무료
    await http().put('/api/me/banner').set(bearer(me)).send({ banner: 'p:없는배너' }).expect(400);
    expect((await http().put('/api/me/banner').set(bearer(me)).send({ banner: 'p:sunset' }).expect(200)).body.banner).toBe('p:sunset');
    expect((await http().get(`/api/users/${userId}`)).body.banner).toBe('p:sunset');
    // 커스텀 배너는 포인트로 연 뒤에
    await http().put('/api/me/banner').set(bearer(me)).send({ banner: `i:${mine}` }).expect(403);
    await http().post('/api/me/banner/unlock').set(bearer(me)).expect(400); // 0P
    await app.get(Database).execute('UPDATE users SET points = 450 WHERE uid::text = $1', [userId]);
    const unlocked = (await http().post('/api/me/banner/unlock').set(bearer(me)).expect(200)).body;
    expect(unlocked).toMatchObject({ points: 150, customBanner: true });
    expect((await http().post('/api/me/banner/unlock').set(bearer(me)).expect(200)).body.points).toBe(150); // 두 번 빠지지 않는다
    await http().put('/api/me/banner').set(bearer(me)).send({ banner: `i:${theirs}` }).expect(400);
    expect((await http().put('/api/me/banner').set(bearer(me)).send({ banner: `i:${mine}` }).expect(200)).body.banner).toBe(`i:${mine}`);
    expect((await http().get('/api/me/points').set(bearer(me))).body.items[0]).toMatchObject({ delta: -300, reason: '커스텀 배너 열기' });
  });

  it('포인트 적립 · 배지 · 친구 초대', async () => {
    const db = app.get(Database);
    const host = await signup('reward-host@test.dev', '초대왕');
    const me = (await http().get('/api/me').set(bearer(host))).body;
    const points = async (token: string) => (await http().get('/api/me').set(bearer(token))).body.points as number;

    // 초대 코드로 가입하면 초대한 사람 +100P, 가입한 사람 +30P
    const invite = (await http().get('/api/me/invite').set(bearer(host)).expect(200)).body;
    expect(invite).toMatchObject({ invitedCount: 0 });
    expect(invite.code).toMatch(/^[0-9A-F]{8}$/);
    await http().post('/api/auth/signup/code').send({ email: 'reward-guest@test.dev' }).expect(204);
    const joined = (
      await http()
        .post('/api/auth/signup')
        .send({ email: 'reward-guest@test.dev', password: 'password1234!', nickname: '초대받음', code: lastCode('reward-guest@test.dev'), ref: invite.code.toLowerCase() })
        .expect(201)
    ).body;
    const guest = joined.token as string;
    expect(joined.user.points).toBe(30);
    expect(await points(host)).toBe(100);
    expect((await http().get('/api/me/invite').set(bearer(host))).body.invitedCount).toBe(1);
    // 없는 코드는 그냥 가입만
    await http().post('/api/auth/signup/code').send({ email: 'reward-none@test.dev' }).expect(204);
    const plain = await http()
      .post('/api/auth/signup')
      .send({ email: 'reward-none@test.dev', password: 'password1234!', nickname: '그냥가입', code: lastCode('reward-none@test.dev'), ref: 'NOPE' })
      .expect(201);
    expect(plain.body.user.points).toBe(0);

    // 출석: 하루 한 번 +10P
    expect((await http().post('/api/me/attendance').set(bearer(guest)).expect(200)).body).toMatchObject({ awarded: true, earned: 10, streak: 1 });
    expect((await http().post('/api/me/attendance').set(bearer(guest)).expect(200)).body).toMatchObject({ awarded: false, earned: 0, streak: 1 });
    expect(await points(guest)).toBe(40);
    // 지난 6일 출석해 두면 오늘이 7일 연속 → +10P +50P
    const plainId = (await db.one<{ id: number }>("SELECT id FROM users WHERE nickname = '그냥가입'"))!.id;
    await db.execute(
      "INSERT INTO attendance (user_id, day) SELECT $1, (now() AT TIME ZONE 'Asia/Seoul')::date - g FROM generate_series(1, 6) g",
      [plainId],
    );
    const plainToken = plain.body.token as string;
    expect((await http().post('/api/me/attendance').set(bearer(plainToken)).expect(200)).body).toMatchObject({ awarded: true, earned: 60, streak: 7 });

    // 글쓰기 +5P, 하루 5번까지
    await http().post('/api/channels/free/members').set(bearer(guest)).expect(200);
    const before = await points(guest);
    let postId = 0;
    for (let i = 0; i < 6; i++) {
      postId = (await http().post('/api/posts').set(bearer(guest)).send({ channel: 'free', title: `보상 ${i}`, content: 'c' }).expect(201)).body.id;
    }
    expect(await points(guest)).toBe(before + 25);

    // 공감 받기 +2P: 같은 사람은 한 번만, 내 글에 내가 누른 건 없음
    const liked = await points(guest);
    await http().post(`/api/posts/${postId}/like`).set(bearer(guest)).expect(200);
    await http().post(`/api/posts/${postId}/like`).set(bearer(host)).expect(200);
    await http().delete(`/api/posts/${postId}/like`).set(bearer(host)).expect(200);
    await http().post(`/api/posts/${postId}/like`).set(bearer(host)).expect(200);
    expect(await points(guest)).toBe(liked + 2);
    expect((await http().get('/api/me/points').set(bearer(guest))).body.items[0]).toMatchObject({ delta: 2, reason: '공감 받음' });
    // 내역 필터: 오래된순 · 적립만 · 사용만, 커서로 이어 받기
    const logs = async (query: Record<string, string | number>) => (await http().get('/api/me/points').query(query).set(bearer(guest)).expect(200)).body;
    expect((await logs({ order: 'oldest' })).items[0]).toMatchObject({ delta: 30, reason: '초대받아 가입' });
    expect((await logs({ type: 'spend' })).items).toHaveLength(0);
    expect((await logs({ type: 'earn' })).items.every((l: { delta: number }) => l.delta > 0)).toBe(true);
    const first = await logs({ order: 'oldest', size: 2 });
    expect(first.items).toHaveLength(2);
    const next = await logs({ order: 'oldest', size: 2, cursor: first.nextCursor });
    expect(next.items[0].id).toBeGreaterThan(first.items[1].id);

    // 배지는 다른 사람도 프로필에서 본다
    const profile = (await http().get(`/api/users/${joined.user.id}`)).body;
    expect(profile.badges.map((b: { code: string }) => b.code)).toEqual(['first_post']);
    expect((await http().get(`/api/users/${me.id}`)).body.badges.map((b: { code: string }) => b.code)).toEqual(['invite_1']);
    expect((await http().get(`/api/users/${plain.body.user.id}`)).body.badges.map((b: { code: string }) => b.code)).toEqual(['streak_7']);

    // 채널 팔로워 배지: 내 채널 팔로워가 10명을 넘으면
    await http().post('/api/channels').set(bearer(host)).send({ slug: 'reward-ch', name: '보상채널', description: '' }).expect(201);
    for (let i = 0; i < 9; i++) {
      const t = await signup(`reward-f${i}@test.dev`, `팔로워${i}`);
      await http().post('/api/channels/reward-ch/members').set(bearer(t)).expect(200);
    }
    const hostBadges = (await http().get(`/api/users/${me.id}`)).body.badges.map((b: { code: string }) => b.code);
    expect(hostBadges).toEqual(['invite_1', 'channel_open', 'followers_10']);
  });

  it('소셜 로그인: state · 쿠키 확인, 새 가입 · 다시 로그인 · 같은 이메일 계정에 잇기', async () => {
    expect((await http().get('/api/auth/oauth/providers')).body).toEqual([]);
    await http().get('/api/auth/oauth/google/start').expect(404); // 키가 없으면 꺼져 있다
    process.env.GOOGLE_CLIENT_ID = 'test-google';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.KAKAO_CLIENT_ID = 'test-kakao';
    let profile: Record<string, unknown> = {};
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const body = url.includes('token') ? { access_token: 'provider-token' } : profile;
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    try {
      expect((await http().get('/api/auth/oauth/providers')).body).toEqual(['google', 'kakao']);
      // 시작: 제공자 로그인 화면으로 보내고, 이 브라우저에 nonce 쿠키를 심는다
      const login = async (provider: string, opts: { cookie?: boolean; next?: string } = {}) => {
        const start = await http().get(`/api/auth/oauth/${provider}/start`).query({ next: opts.next ?? '/c/free' }).expect(302);
        const to = new URL(start.headers.location);
        const cookie = (start.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
        const callback = http().get(`/api/auth/oauth/${provider}/callback`).query({ code: 'abc', state: to.searchParams.get('state') });
        const res = await (opts.cookie === false ? callback : callback.set('Cookie', cookie)).expect(302);
        return { to, hash: new URLSearchParams(new URL(res.headers.location).hash.slice(1)) };
      };
      // (요청 객체를 먼저 만들면 supertest 가 서버를 공유하다 닫으므로, 토큰을 먼저 받고 나서 /api/me 를 부른다)
      const meOf = async (provider: string) => {
        const token = (await login(provider)).hash.get('token')!;
        return (await http().get('/api/me').set(bearer(token)).expect(200)).body;
      };

      profile = { sub: 'g-1', email: 'Social@Test.dev', email_verified: true, name: '구글사람' };
      const first = await login('google');
      expect(first.to.origin).toBe('https://accounts.google.com');
      expect(first.to.searchParams.get('client_id')).toBe('test-google');
      expect(first.hash.get('next')).toBe('/c/free');
      const token = first.hash.get('token')!;
      const me = (await http().get('/api/me').set(bearer(token)).expect(200)).body;
      expect(me).toMatchObject({ nickname: '구글사람', email: 'social@test.dev' });
      // 같은 소셜 계정으로 다시 로그인하면 같은 사용자
      const again = await meOf('google');
      expect(again.id).toBe(me.id);

      // 다른 브라우저에서 시작한 요청(쿠키 없음)은 거절, 바깥 주소로는 돌려보내지 않는다
      expect((await login('google', { cookie: false })).hash.get('error')).toContain('다시 시도');
      expect((await login('google', { next: '//evil.com' })).hash.get('next')).toBe('/');

      // 제공자가 확인한 이메일과 같은 기존 계정에는 이어 붙인다
      const existing = await signup('linked@test.dev', '원래계정');
      const existingId = (await http().get('/api/me').set(bearer(existing))).body.id;
      profile = { sub: 'g-2', email: 'linked@test.dev', email_verified: true, name: '다른이름' };
      expect((await meOf('google')).id).toBe(existingId);
      // 확인되지 않은 이메일이면 이어 붙이지 않고 새 계정 (닉네임이 겹치면 숫자를 붙인다)
      profile = { sub: 'g-3', email: 'linked@test.dev', email_verified: false, name: '구글사람' };
      const unverified = await meOf('google');
      expect(unverified.id).not.toBe(existingId);
      expect(unverified.nickname).toMatch(/^구글사람\d{4}$/);

      // 이메일을 주지 않는 카카오 계정도 가입된다
      profile = { id: 12345, kakao_account: { profile: { nickname: '카카오친구' } } };
      const kakao = await meOf('kakao');
      expect(kakao.nickname).toBe('카카오친구');
    } finally {
      fetchMock.mockRestore();
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.KAKAO_CLIENT_ID;
    }
  });

  it('댓글: 최신순 · 답글 · 수정', async () => {
    const a = await signup('reply-a@test.dev', '답글가');
    const b = await signup('reply-b@test.dev', '답글나');
    await http().post('/api/channels/free/members').set(bearer(a)).expect(200);
    const postId = (await http().post('/api/posts').set(bearer(a)).send({ channel: 'free', title: '답글 테스트', content: 'c' }).expect(201)).body.id;
    const add = (token: string, content: string, parentId?: number) =>
      http().post(`/api/posts/${postId}/comments`).set(bearer(token)).send({ content, parentId }).expect(201).then((r) => r.body);
    const first = await add(a, '첫 댓글');
    await add(b, '둘째 댓글');
    const reply = await add(b, '첫 댓글에 답글', first.id);
    expect(reply.parentId).toBe(first.id);
    // 답글의 답글도 같은 댓글 아래로
    expect((await add(a, '답글에 답글', reply.id)).parentId).toBe(first.id);
    const list = (await http().get(`/api/posts/${postId}/comments`)).body.items;
    expect(list.map((c: { content: string }) => c.content)).toEqual(['둘째 댓글', '첫 댓글']);
    expect(list[1].replies.map((c: { content: string }) => c.content)).toEqual(['첫 댓글에 답글', '답글에 답글']);
    expect((await http().get(`/api/posts/${postId}`)).body.commentCount).toBe(4);
    // 수정은 쓴 사람만
    await http().put(`/api/posts/${postId}/comments/${first.id}`).set(bearer(b)).send({ content: '남의 것' }).expect(403);
    const edited = (await http().put(`/api/posts/${postId}/comments/${first.id}`).set(bearer(a)).send({ content: '고친 댓글' }).expect(200)).body;
    expect(edited).toMatchObject({ content: '고친 댓글' });
    expect(edited.updatedAt).toBeDefined();
    // 댓글을 지우면 답글도 함께, 댓글 수도 그만큼
    await http().delete(`/api/posts/${postId}/comments/${first.id}`).set(bearer(a)).expect(204);
    expect((await http().get(`/api/posts/${postId}`)).body.commentCount).toBe(1);
    await http().post(`/api/posts/${postId}/comments`).set(bearer(a)).send({ content: 'x', parentId: 999999 }).expect(404);
  });

  it('채널 프로필 이미지', async () => {
    const owner = await signup('icon-owner@test.dev', '아이콘');
    const stranger = await signup('icon-other@test.dev', '남남');
    expect((await http().post('/api/channels').set(bearer(owner)).send({ slug: 'icons', name: '아이콘채널' })).body.iconVersion).toBe(0);
    await http().get('/api/channels/icons/icon').expect(404);

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const upload = (token: string, type: string, body: Buffer) =>
      http().put('/api/channels/icons/icon').set(bearer(token)).set('Content-Type', type).send(body);
    await upload(stranger, 'image/png', png).expect(403);
    await upload(owner, 'text/html', png).expect(400);
    await upload(owner, 'image/png', Buffer.alloc(600 * 1024)).expect(400);
    expect((await upload(owner, 'image/png', png).expect(200)).body.iconVersion).toBe(1);
    const icon = await http().get('/api/channels/icons/icon').query({ v: 1 }).buffer(true).parse(binary).expect(200);
    expect(Buffer.compare(icon.body as Buffer, png)).toBe(0);
    expect(icon.headers['cache-control']).toContain('immutable');
    expect((await http().get('/api/channels').query({ q: '아이콘채널' })).body[0].iconVersion).toBe(1);

    // 지우면 음수 버전이 되고, 다시 올리면 옛 주소와 겹치지 않는 새 버전이 된다
    await http().delete('/api/channels/icons/icon').set(bearer(owner)).expect(204);
    expect((await http().get('/api/channels/icons')).body.iconVersion).toBe(-1);
    await http().get('/api/channels/icons/icon').expect(404);
    expect((await upload(owner, 'image/png', png)).body.iconVersion).toBe(2);
  });

  it('북마크와 내 정보', async () => {
    const me = await signup('mypage@test.dev', '마이페이지');
    await signup('taken@test.dev', '이미있음');

    // 채널 북마크 (가입과 별개, 여러 번 눌러도 같음)
    expect((await http().get('/api/channels/free').set(bearer(me))).body.bookmarked).toBe(false);
    expect((await http().put('/api/channels/free/bookmark').set(bearer(me))).body.bookmarked).toBe(true);
    expect((await http().put('/api/channels/free/bookmark').set(bearer(me))).body.bookmarked).toBe(true);
    await http().put('/api/channels/daily/bookmark').set(bearer(me));
    expect((await http().get('/api/channels/free').set(bearer(me))).body).toMatchObject({ bookmarked: true, joined: false });
    const bookmarks = (await http().get('/api/me/bookmarks/channels').set(bearer(me))).body;
    expect(bookmarks).toHaveLength(2);
    expect(bookmarks[0].slug).toBe('daily'); // 최근 북마크 순
    expect((await http().delete('/api/channels/free/bookmark').set(bearer(me))).body.bookmarked).toBe(false);
    expect((await http().get('/api/me/bookmarks/channels').set(bearer(me))).body).toHaveLength(1);
    await http().put('/api/channels/free/bookmark').expect(401);

    // 닉네임 변경: 새 토큰과 함께 돌아오고, 겹치면 409
    await http().put('/api/me/profile').set(bearer(me)).send({ nickname: '이미있음' }).expect(409);
    const renamed = (await http().put('/api/me/profile').set(bearer(me)).send({ nickname: '새닉네임' })).body;
    expect(renamed.user.nickname).toBe('새닉네임');
    expect((await http().get('/api/me').set(bearer(renamed.token))).body.nickname).toBe('새닉네임');

    // 비밀번호 변경: 지금 비밀번호가 맞아야 한다
    const wrong = await http().put('/api/me/password').set(bearer(me)).send({ currentPassword: 'wrong-password', newPassword: 'newpassword123!' }).expect(400);
    expect(wrong.body.message).toBe('지금 비밀번호가 맞지 않아요');
    await http().put('/api/me/password').set(bearer(me)).send({ currentPassword: 'password1234!', newPassword: 'short' }).expect(400);
    await http().put('/api/me/password').set(bearer(me)).send({ currentPassword: 'password1234!', newPassword: 'newpassword123!' }).expect(204);
    await http().post('/api/auth/login').send({ email: 'mypage@test.dev', password: 'password1234!' }).expect(401);
    const login = await http().post('/api/auth/login').send({ email: 'mypage@test.dev', password: 'newpassword123!' }).expect(200);
    expect(login.body.user.nickname).toBe('새닉네임');
  });

  it('채널 검색: 이름이 검색어로 시작하는 채널이 먼저', async () => {
    const owner = await signup('search-owner@test.dev', '검색테스트');
    await http().post('/api/channels').set(bearer(owner)).send({ slug: 'srch-a', name: '여행사진' });
    await http().post('/api/channels').set(bearer(owner)).send({ slug: 'srch-b', name: '사진관' });
    await http().post('/api/channels').set(bearer(owner)).send({ slug: 'photo', name: '필름카메라' });
    for (let i = 0; i < 3; i++) await http().post('/api/posts').set(bearer(owner)).send({ channel: 'srch-a', title: `t${i}`, content: 'c' });
    const found = (await http().get('/api/channels').query({ q: '사진' })).body;
    expect(found.map((c: { name: string }) => c.name)).toEqual(['사진관', '여행사진']);
    // 이름만 본다: 고리(slug)로는 걸리지 않는다
    expect((await http().get('/api/channels').query({ q: 'photo' })).body).toHaveLength(0);
    expect((await http().get('/api/channels').query({ q: '카메' })).body[0].slug).toBe('photo');
    // LIKE 특수문자는 글자 그대로
    expect((await http().get('/api/channels').query({ q: '%' })).body).toHaveLength(0);
  });

  it('DB 에 없는 사용자의 토큰은 비로그인으로 본다', async () => {
    const ghost = jwt.issue(999_999, '유령', 'no-such-session').token;
    const real = await signup('ghost-check@test.dev', '진짜회원');
    await http().post('/api/channels').set(bearer(real)).send({ slug: 'ghost-ch', name: '유령확인' });
    const postId = (await http().post('/api/posts').set(bearer(real)).send({ channel: 'ghost-ch', title: 't', content: 'c' })).body.id;

    const res = await http().post(`/api/posts/${postId}/like`).set(bearer(ghost)).expect(401);
    expect(res.body.message).toBe('로그인이 필요해요');
    await http().get('/api/me').set(bearer(ghost)).expect(401);
    // 읽기는 비로그인처럼 그대로 된다
    expect((await http().get(`/api/posts/${postId}`).set(bearer(ghost)).expect(200)).body.liked).toBe(false);
  });

  it('회원가입은 이메일 인증번호가 필요하다', async () => {
    const form = { email: 'code@test.dev', password: 'password1234!', nickname: '인증', code: '123456' };
    expect((await http().post('/api/auth/signup').send(form).expect(400)).body.message).toBe('인증번호를 먼저 받아 주세요');
    await http().post('/api/auth/signup/code').send({ email: 'Code@test.dev' }).expect(204);
    const code = lastCode('code@test.dev');
    // 번호는 영문 대문자와 1~9 로 된 6자리
    expect(code).toMatch(/^[A-Z1-9]{6}$/);
    expect((await http().post('/api/auth/signup').send({ ...form, code: '12345' }).expect(400)).body.message).toBe('인증번호 6자리를 입력해 주세요');
    expect((await http().post('/api/auth/signup').send({ ...form, code: other(code) }).expect(400)).body.message).toBe('인증번호가 맞지 않아요 (1/5)');
    // 소문자로 입력해도 같은 번호로 본다
    expect((await http().post('/api/auth/signup').send({ ...form, code: code.toLowerCase() }).expect(201)).body.user.twoFactorEnabled).toBe(false);
    // 한 번 쓴 번호는 다시 못 쓰고, 이미 가입한 이메일로는 번호를 보내지 않는다
    await http().post('/api/auth/signup').send({ ...form, email: 'code2@test.dev', nickname: '인증둘', code }).expect(400);
    await http().post('/api/auth/signup/code').send({ email: 'code@test.dev' }).expect(409);
  });

  it('2단계 인증 로그인', async () => {
    const token = await signup('2fa@test.dev', '이단계');
    const login = { email: '2fa@test.dev', password: 'password1234!' };

    // 켜기: 내 이메일로 받은 번호를 확인해야 켜진다
    await http().post('/api/me/2fa/enable').set(bearer(token)).send({ code: '000000' }).expect(400);
    await http().post('/api/me/2fa/code').set(bearer(token)).expect(204);
    expect((await http().post('/api/me/2fa/enable').set(bearer(token)).send({ code: lastCode('2fa@test.dev') })).body.twoFactorEnabled).toBe(true);
    expect(mailer.lastNotice('2fa@test.dev')).toBe('2단계 인증이 켜졌어요');
    expect((await http().get('/api/me').set(bearer(token))).body.twoFactorEnabled).toBe(true);

    // 로그인: 비밀번호가 맞으면 토큰 대신 challenge 가 오고, 메일로 받은 번호까지 맞아야 토큰이 나온다
    const first = (await http().post('/api/auth/login').send(login).expect(200)).body;
    expect(first.twoFactorRequired).toBe(true);
    expect(first.token).toBeUndefined();
    expect(first.maskedEmail).toBe('2**@test.dev');
    let challenge = first.challenge;
    const wrong = other(lastCode('2fa@test.dev'));
    for (let i = 1; i < 5; i++) {
      expect((await http().post('/api/auth/login/verify').send({ challenge, code: wrong })).body.message).toBe(`인증번호가 맞지 않아요 (${i}/5)`);
    }
    expect((await http().post('/api/auth/login/verify').send({ challenge, code: wrong })).body.message).toBe('인증번호를 5번 틀렸어요. 새 번호를 받아 주세요');
    await http().post('/api/auth/login/verify').send({ challenge, code: lastCode('2fa@test.dev') }).expect(400);

    // 다시 받기 → 새 challenge 와 새 번호로 로그인
    challenge = (await http().post('/api/auth/login').send(login)).body.challenge;
    const resent = (await http().post('/api/auth/login/resend').send({ challenge }).expect(200)).body.challenge;
    await http().post('/api/auth/login/verify').send({ challenge, code: lastCode('2fa@test.dev') }).expect(400);
    const newToken = (await http().post('/api/auth/login/verify').send({ challenge: resent, code: lastCode('2fa@test.dev') }).expect(200)).body.token;
    expect((await http().get('/api/me').set(bearer(newToken))).body.email).toBe('2fa@test.dev');

    // 끄기: 비밀번호 확인
    await http().post('/api/me/2fa/disable').set(bearer(newToken)).send({ password: 'wrong-password' }).expect(400);
    expect((await http().post('/api/me/2fa/disable').set(bearer(newToken)).send({ password: 'password1234!' })).body.twoFactorEnabled).toBe(false);
    expect((await http().post('/api/auth/login').send(login)).body.token).toBeDefined();
  });

  it('닉네임 중복 확인', async () => {
    await signup('nick@test.dev', '먼저쓴닉');
    expect((await http().get('/api/auth/nickname').query({ nickname: '먼저쓴닉' }).expect(200)).body).toEqual({
      available: false,
      reason: '이미 사용 중인 닉네임이에요',
    });
    expect((await http().get('/api/auth/nickname').query({ nickname: ' 아무도안쓴닉 ' })).body).toEqual({ available: true });
    expect((await http().get('/api/auth/nickname').query({ nickname: '가' })).body.available).toBe(false);
  });

  it('비밀번호 재설정은 항상 이메일 인증을 거친다', async () => {
    const before = await signup('reset@test.dev', '재설정');
    await http().post('/api/auth/password/code').send({ email: 'nobody@test.dev' }).expect(404);

    // 1) 이메일로 번호 받기 (2단계 인증을 끈 계정도 번호가 필요하다)
    const sent = (await http().post('/api/auth/password/code').send({ email: 'Reset@test.dev' }).expect(200)).body;
    expect(sent.maskedEmail).toBe('re*et@test.dev');
    let challenge = sent.challenge;
    await http().post('/api/auth/password/verify').send({ challenge, code: other(lastCode('reset@test.dev')) }).expect(400);
    // 로그인용 challenge 확인 주소로는 쓸 수 없다
    await http().post('/api/auth/login/verify').send({ challenge, code: lastCode('reset@test.dev') }).expect(400);

    // 다시 받기 → 새 challenge 로 확인
    challenge = (await http().post('/api/auth/password/resend').send({ challenge }).expect(200)).body.challenge;
    const { resetToken } = (await http().post('/api/auth/password/verify').send({ challenge, code: lastCode('reset@test.dev') }).expect(200)).body;
    // 재설정 토큰으로는 로그인한 것처럼 쓸 수 없다
    await http().get('/api/me').set('Authorization', `Bearer ${resetToken}`).expect(401);

    // 3) 새 비밀번호로 바꾸기
    expect((await http().post('/api/auth/password/reset').send({ resetToken, newPassword: 'password1234!' }).expect(400)).body.message).toBe(
      '지금 비밀번호와 다른 비밀번호를 입력해 주세요',
    );
    await http().post('/api/auth/password/reset').send({ resetToken, newPassword: 'new-password-99' }).expect(204);
    expect(mailer.lastNotice('reset@test.dev')).toBe('비밀번호가 바뀌었어요');
    // 재설정 전에 로그인돼 있던 기기는 모두 로그아웃된다
    await http().get('/api/me').set(bearer(before)).expect(401);
    // 한 번 쓴 토큰은 다시 못 쓴다
    await http().post('/api/auth/password/reset').send({ resetToken, newPassword: 'another-password1' }).expect(400);
    await http().post('/api/auth/login').send({ email: 'reset@test.dev', password: 'password1234!' }).expect(401);
    expect((await http().post('/api/auth/login').send({ email: 'reset@test.dev', password: 'new-password-99' }).expect(200)).body.token).toBeDefined();
  });

  it('로그아웃하면 그 기기의 토큰만 폐기된다', async () => {
    await signup('device@test.dev', '여러기기');
    const login = async (ua: string) =>
      (await http().post('/api/auth/login').set('User-Agent', ua).send({ email: 'device@test.dev', password: 'password1234!' }).expect(200)).body
        .token as string;
    const pc = await login('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36');
    const phone = await login('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
    const app = await login('okhttp/4.12.0');

    // 로그인한 기기 목록: 지금 기기가 맨 위
    const list = (await http().get('/api/me/sessions').set(bearer(pc)).expect(200)).body as { id: string; device: string; current: boolean }[];
    expect(list.map((d) => d.device)).toEqual(expect.arrayContaining(['Chrome · Windows', 'Safari · iOS', '루프 앱 · Android']));
    expect(list[0]).toMatchObject({ device: 'Chrome · Windows', current: true });

    // 휴대폰에서 로그아웃 → 휴대폰 토큰만 바로 막히고, 같은 토큰이 남아 있어도 못 쓴다
    await http().post('/api/auth/logout').set(bearer(phone)).expect(204);
    await http().get('/api/me').set(bearer(phone)).expect(401);
    await http().get('/api/me').set(bearer(pc)).expect(200);
    // 이미 폐기된 토큰으로 다시 로그아웃해도 괜찮다
    await http().post('/api/auth/logout').set(bearer(phone)).expect(204);

    // PC 에서 앱 기기를 로그아웃시키기 (남의 세션은 못 지운다)
    const appSession = (await http().get('/api/me/sessions').set(bearer(pc))).body.find((d: { device: string }) => d.device === '루프 앱 · Android');
    const stranger = await signup('stranger@test.dev', '남의기기');
    await http().delete(`/api/me/sessions/${appSession.id}`).set(bearer(stranger)).expect(404);
    await http().get('/api/me').set(bearer(app)).expect(200);
    await http().delete(`/api/me/sessions/${appSession.id}`).set(bearer(pc)).expect(204);
    await http().get('/api/me').set(bearer(app)).expect(401);

    // 닉네임을 바꿔 새 토큰을 받아도 같은 기기 세션이라 로그아웃 한 번에 둘 다 막힌다
    const renamed = (await http().put('/api/me/profile').set(bearer(pc)).send({ nickname: '바뀐기기닉' }).expect(200)).body.token;
    const after = (await http().get('/api/me/sessions').set(bearer(renamed))).body as { id: string; current: boolean }[];
    expect(after.find((d) => d.current)?.id).toBe(list[0].id);
    expect(after).toHaveLength(list.length - 2);

    // 비밀번호를 바꾸면 지금 기기만 남는다
    const tablet = await login('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36');
    await http().put('/api/me/password').set(bearer(renamed)).send({ currentPassword: 'password1234!', newPassword: 'password5678!' }).expect(204);
    await http().get('/api/me').set(bearer(tablet)).expect(401);
    await http().get('/api/me').set(bearer(renamed)).expect(200);

    // 다른 기기 모두 로그아웃
    const again = (await http().post('/api/auth/login').send({ email: 'device@test.dev', password: 'password5678!' }).expect(200)).body.token;
    await http().delete('/api/me/sessions').set(bearer(renamed)).expect(204);
    await http().get('/api/me').set(bearer(again)).expect(401);

    await http().post('/api/auth/logout').set(bearer(renamed)).expect(204);
    await http().get('/api/me').set(bearer(pc)).expect(401);
    await http().get('/api/me').set(bearer(renamed)).expect(401);
  });

  it('인증 입력 검사', async () => {
    await signup('dup@test.dev', '중복');
    await http().post('/api/auth/signup').send({ email: 'dup@test.dev', password: 'password1234!', nickname: '다른닉', code: 'AAAAAA' }).expect(409);
    const short = await http().post('/api/auth/signup').send({ email: 'short@test.dev', password: '123', nickname: '짧은비번', code: 'AAAAAA' }).expect(400);
    expect(short.body.message).toBe('비밀번호는 8자 이상이어야 해요');
    // 비밀번호 규칙: 숫자·특수문자 포함, 영문·숫자·특수문자만
    const bad = (password: string) => http().post('/api/auth/signup').send({ email: 'rule@test.dev', password, nickname: '규칙', code: 'AAAAAA' });
    expect((await bad('abcdefgh!').expect(400)).body.message).toBe('비밀번호에 숫자를 하나 이상 넣어 주세요');
    expect((await bad('abcdefgh1').expect(400)).body.message).toBe('비밀번호에 특수문자를 하나 이상 넣어 주세요');
    expect((await bad('비밀번호1234!').expect(400)).body.message).toBe('비밀번호는 영문, 숫자, 특수문자만 쓸 수 있어요');
    expect((await bad('pass word1!').expect(400)).body.message).toBe('비밀번호는 영문, 숫자, 특수문자만 쓸 수 있어요');
    await http().post('/api/auth/login').send({ email: 'dup@test.dev', password: 'wrong-password' }).expect(401);
    const token = (await http().post('/api/auth/login').send({ email: 'DUP@test.dev', password: 'password1234!' }).expect(200)).body.token;
    expect((await http().get('/api/me').set(bearer(token))).body.nickname).toBe('중복');
    await http().get('/api/me').set('Authorization', 'Bearer invalid').expect(401);
  });
});

/** 이미지 응답을 Buffer 로 받는다 */
function binary(res: request.Response, done: (err: Error | null, body: Buffer) => void) {
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (c: Buffer) => chunks.push(c));
  stream.on('end', () => done(null, Buffer.concat(chunks)));
}
