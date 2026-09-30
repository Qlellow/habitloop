import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/create-app';
import { JwtService } from '../src/auth/jwt.service';
import { Mailer } from '../src/mail/mailer';
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
    .send({ email, password: 'password1234', nickname, code: lastCode(email) })
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

    // 조회수
    expect((await http().get(`/api/posts/${lastId}`)).body.viewCount).toBe(1);
    expect((await http().get(`/api/posts/${lastId}`)).body.viewCount).toBe(2);
    expect((await http().get(`/api/posts/${lastId}`)).body.viewCount).toBe(3);

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
    await http().post('/api/channels').set(bearer(owner)).send(req).expect(201);
    await http().post('/api/channels').set(bearer(stranger)).send(req).expect(409);
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
    await http().post('/api/posts').set(bearer(member)).send({ channel: 'art', title: '잡담', content: 'c' }).expect(201);
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

    // 이름 변경 / 삭제 → 글은 남고 카테고리만 빈다
    expect((await http().put(`${base}/${art}`).set(bearer(owner)).send({ name: '그림', ownerOnly: false })).body[1].name).toBe('그림');
    expect((await http().get(`/api/posts/${postId}`)).body.category.name).toBe('그림');
    await http().delete(`${base}/${art}`).set(bearer(member)).expect(403);
    expect((await http().delete(`${base}/${art}`).set(bearer(owner))).body).toHaveLength(2);
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
    const staffPost = await http()
      .post('/api/posts')
      .set(bearer(manager))
      .send({ channel: 'staffs', categoryId: notice, title: '공지', content: 'c' })
      .expect(201);
    expect(staffPost.body.author.role).toBe('MANAGER');
    await http().post('/api/posts').set(bearer(member)).send({ channel: 'staffs', categoryId: notice, title: 't', content: 'c' }).expect(403);

    // 목록·댓글의 닉네임 옆 배지: 일반 멤버는 역할이 없다
    const memberPost = (await http().post('/api/posts').set(bearer(member)).send({ channel: 'staffs', title: '멤버 글', content: 'c' })).body.id;
    const list = (await http().get('/api/posts').query({ channel: 'staffs' })).body.items;
    expect(list[0].authorRole).toBeUndefined();
    expect(list[1].authorRole).toBe('MANAGER');
    expect((await http().post(`/api/posts/${memberPost}/comments`).set(bearer(owner)).send({ content: '환영' })).body.authorRole).toBe('OWNER');
    const memberComment = (await http().post(`/api/posts/${memberPost}/comments`).set(bearer(member)).send({ content: 'hi' })).body.id;
    const comments = (await http().get(`/api/posts/${memberPost}/comments`)).body.items;
    expect(comments[0].authorRole).toBe('OWNER');
    expect(comments[1].authorRole).toBeUndefined();

    // 운영진은 아래 역할의 글·댓글을 지울 수 있다. 일반 멤버는 못 한다
    expect((await http().get(`/api/posts/${memberPost}`).set(bearer(manager))).body.canModerate).toBe(true);
    expect((await http().get(`/api/posts/${staffPost.body.id}`).set(bearer(member))).body.canModerate).toBe(false);
    await http().delete(`/api/posts/${staffPost.body.id}`).set(bearer(member)).expect(403);
    // 매니저는 더 높은 운영진(소유자)의 댓글은 지울 수 없다
    const ownerComment = comments[0].id;
    const asManager = (await http().get(`/api/posts/${memberPost}/comments`).set(bearer(manager))).body.items;
    expect(asManager[0].deletable).toBe(false);
    expect(asManager[1].deletable).toBe(true);
    await http().delete(`/api/posts/${memberPost}/comments/${ownerComment}`).set(bearer(manager)).expect(403);
    expect((await http().get(`/api/posts/${staffPost.body.id}`).set(bearer(admin))).body.canModerate).toBe(true);
    await http().delete(`/api/posts/${memberPost}/comments/${memberComment}`).set(bearer(manager)).expect(204);
    await http().delete(`/api/posts/${memberPost}`).set(bearer(manager)).expect(204);

    // 일반 멤버로 되돌리면 권한과 배지가 없어진다
    expect((await role(managerId, owner, 'MEMBER')).body).toHaveLength(2);
    expect((await http().get(`/api/posts/${staffPost.body.id}`)).body.author.role).toBeUndefined();
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
    const wrong = await http().put('/api/me/password').set(bearer(me)).send({ currentPassword: 'wrong-password', newPassword: 'newpassword123' }).expect(400);
    expect(wrong.body.message).toBe('지금 비밀번호가 맞지 않아요');
    await http().put('/api/me/password').set(bearer(me)).send({ currentPassword: 'password1234', newPassword: 'short' }).expect(400);
    await http().put('/api/me/password').set(bearer(me)).send({ currentPassword: 'password1234', newPassword: 'newpassword123' }).expect(204);
    await http().post('/api/auth/login').send({ email: 'mypage@test.dev', password: 'password1234' }).expect(401);
    const login = await http().post('/api/auth/login').send({ email: 'mypage@test.dev', password: 'newpassword123' }).expect(200);
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
    const ghost = jwt.issue(999_999, '유령');
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
    const form = { email: 'code@test.dev', password: 'password1234', nickname: '인증', code: '123456' };
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
    const login = { email: '2fa@test.dev', password: 'password1234' };

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
    expect((await http().post('/api/me/2fa/disable').set(bearer(newToken)).send({ password: 'password1234' })).body.twoFactorEnabled).toBe(false);
    expect((await http().post('/api/auth/login').send(login)).body.token).toBeDefined();
  });

  it('비밀번호 재설정은 항상 이메일 인증을 거친다', async () => {
    await signup('reset@test.dev', '재설정');
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
    expect((await http().post('/api/auth/password/reset').send({ resetToken, newPassword: 'password1234' }).expect(400)).body.message).toBe(
      '지금 비밀번호와 다른 비밀번호를 입력해 주세요',
    );
    await http().post('/api/auth/password/reset').send({ resetToken, newPassword: 'new-password-99' }).expect(204);
    expect(mailer.lastNotice('reset@test.dev')).toBe('비밀번호가 바뀌었어요');
    // 한 번 쓴 토큰은 다시 못 쓴다
    await http().post('/api/auth/password/reset').send({ resetToken, newPassword: 'another-password' }).expect(400);
    await http().post('/api/auth/login').send({ email: 'reset@test.dev', password: 'password1234' }).expect(401);
    expect((await http().post('/api/auth/login').send({ email: 'reset@test.dev', password: 'new-password-99' }).expect(200)).body.token).toBeDefined();
  });

  it('인증 입력 검사', async () => {
    await signup('dup@test.dev', '중복');
    await http().post('/api/auth/signup').send({ email: 'dup@test.dev', password: 'password1234', nickname: '다른닉', code: 'AAAAAA' }).expect(409);
    const short = await http().post('/api/auth/signup').send({ email: 'short@test.dev', password: '123', nickname: '짧은비번', code: 'AAAAAA' }).expect(400);
    expect(short.body.message).toBe('비밀번호는 8자 이상이어야 해요');
    await http().post('/api/auth/login').send({ email: 'dup@test.dev', password: 'wrong-password' }).expect(401);
    const token = (await http().post('/api/auth/login').send({ email: 'DUP@test.dev', password: 'password1234' }).expect(200)).body.token;
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
