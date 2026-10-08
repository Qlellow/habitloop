import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { JwtService } from '../auth/jwt.service';
import { ChannelsService } from '../channels/channels.service';
import { ApiError } from '../common/api-error';
import { cursorPage, escapeLike } from '../common/cursor-page';
import { Database } from '../db/database';
import { Mailer } from '../mail/mailer';
import { VerificationService } from '../mail/verification.service';
import { PostsService } from '../posts/posts.service';
import { adminEmails } from './admin.config';
import type { AdminUser } from './admin.guard';

const LOGIN_FAIL_LIMIT = 5;
const LOGIN_FAIL_WINDOW_MS = 15 * 60_000;
const EXCERPT = 120;

const cut = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return [...t].length > EXCERPT ? `${[...t].slice(0, EXCERPT).join('')}…` : t;
};

/**
 * 사이트 관리자: 로그인(비밀번호 + 매번 이메일 인증번호) · 현황 · 전체 신고 · 사용자 정지 · 채널 · 관리 기록.
 * 관리자가 한 일은 모두 admin_logs 에 남긴다.
 */
@Injectable()
export class AdminService {
  /** 로그인 실패 횟수 (IP 마다, 15분에 5번까지) */
  private readonly failures = new Map<string, { count: number; until: number }>();

  constructor(
    private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly verification: VerificationService,
    private readonly mailer: Mailer,
    private readonly posts: PostsService,
    private readonly channels: ChannelsService,
  ) {}

  /* ───── 로그인 ───── */

  /** 1단계: 이메일 · 비밀번호 확인 → 그 이메일로 인증번호. 관리자가 아닌 계정도 '맞지 않아요'로 똑같이 답한다 */
  async sendLoginCode(email: string, password: string, ip: string) {
    const user = await this.checkCredentials(email, password, ip);
    await this.verification.send(user.email, 'ADMIN_LOGIN', user.id);
  }

  /** 2단계: 인증번호까지 맞으면 관리자 토큰(2시간) */
  async login(email: string, password: string, code: string, ip: string) {
    const user = await this.checkCredentials(email, password, ip);
    await this.verification.verify(user.email, 'ADMIN_LOGIN', code);
    this.failures.delete(ip);
    await this.log(user.id, 'login', undefined, ip);
    await this.mailer
      .sendNotice(user.email, '관리자 페이지에 로그인했어요', `방금 루프 관리자 페이지에 로그인했어요.\n직접 로그인한 것이 아니라면 바로 비밀번호를 바꿔 주세요.`)
      .catch(() => undefined);
    return { token: this.jwt.issueAdmin(user.id, user.password), nickname: user.nickname };
  }

  private async checkCredentials(email: string, password: string, ip: string) {
    const fail = this.failures.get(ip);
    if (fail && fail.until > Date.now() && fail.count >= LOGIN_FAIL_LIMIT) {
      throw ApiError.tooMany('로그인을 너무 많이 틀렸어요. 15분 뒤에 다시 시도해 주세요');
    }
    const normalized = email.trim().toLowerCase();
    const user = adminEmails().has(normalized)
      ? await this.db.one<{ id: number; email: string; nickname: string; password: string }>(
          'SELECT id, email, nickname, password FROM users WHERE lower(email) = $1 AND withdrawn_at IS NULL AND suspended_at IS NULL',
          [normalized],
        )
      : undefined;
    // 관리자가 아닌 이메일도 비밀번호 비교만큼 시간을 쓴다 (응답 시간으로 관리자 이메일을 알아내지 못하게)
    const ok = user ? await bcrypt.compare(password, user.password) : (await bcrypt.compare(password, DUMMY_HASH), false);
    if (!user || !ok) {
      const now = Date.now();
      const prev = fail && fail.until > now ? fail : { count: 0, until: now + LOGIN_FAIL_WINDOW_MS };
      this.failures.set(ip, { count: prev.count + 1, until: prev.until });
      throw ApiError.unauthorized('이메일 또는 비밀번호가 맞지 않아요');
    }
    return user;
  }

  /* ───── 현황 ───── */

  async stats() {
    const row = await this.db.one<Record<string, number>>(
      `SELECT
         (SELECT count(*)::int FROM users WHERE withdrawn_at IS NULL) AS users,
         (SELECT count(*)::int FROM users WHERE withdrawn_at IS NULL AND created_at >= now() - interval '1 day') AS "usersToday",
         (SELECT count(*)::int FROM users WHERE suspended_at IS NOT NULL) AS suspended,
         (SELECT count(*)::int FROM channels) AS channels,
         (SELECT count(*)::int FROM posts) AS posts,
         (SELECT count(*)::int FROM posts WHERE created_at >= now() - interval '1 day') AS "postsToday",
         (SELECT count(*)::int FROM comments) AS comments,
         (SELECT count(*)::int FROM comments WHERE created_at >= now() - interval '1 day') AS "commentsToday",
         (SELECT count(DISTINCT (post_id, comment_id))::int FROM reports WHERE status = 'open') AS "openReports"`,
    );
    return row!;
  }

  /* ───── 신고 (모든 채널) ───── */

  async reports(status: 'open' | 'done') {
    const rows = await this.db.query<{
      postId: number;
      commentId: number | null;
      count: number;
      reasons: string[];
      details: string[] | null;
      status: string;
      lastReportedAt: Date;
      postTitle: string;
      excerpt: string;
      hidden: boolean;
      channelSlug: string;
      channelName: string;
      authorUid: string;
      authorNickname: string;
    }>(
      `SELECT r.post_id AS "postId", r.comment_id AS "commentId", count(*)::int AS count,
              array_agg(DISTINCT r.reason) AS reasons,
              (array_remove(array_agg(r.detail ORDER BY r.id DESC), NULL))[1:5] AS details,
              (array_agg(r.status ORDER BY r.id DESC))[1] AS status,
              max(r.created_at) AS "lastReportedAt",
              p.title AS "postTitle", COALESCE(cm.content, p.excerpt) AS excerpt,
              COALESCE(cm.hidden_at, p.hidden_at) IS NOT NULL AS hidden,
              c.slug AS "channelSlug", c.name AS "channelName",
              a.uid::text AS "authorUid", a.nickname AS "authorNickname"
       FROM reports r
       JOIN posts p ON p.id = r.post_id
       JOIN channels c ON c.id = p.channel_id
       LEFT JOIN comments cm ON cm.id = r.comment_id
       JOIN users a ON a.id = COALESCE(cm.author_id, p.author_id)
       WHERE ${status === 'open' ? "r.status = 'open'" : "r.status <> 'open'"}
       GROUP BY r.post_id, r.comment_id, p.title, p.excerpt, p.hidden_at, cm.content, cm.hidden_at, c.slug, c.name, a.id
       ORDER BY max(r.id) DESC LIMIT 200`,
    );
    return rows.map((r) => ({
      postId: r.postId,
      commentId: r.commentId ?? undefined,
      postTitle: r.postTitle,
      excerpt: cut(r.excerpt),
      channel: { slug: r.channelSlug, name: r.channelName },
      author: { id: r.authorUid, nickname: r.authorNickname },
      count: r.count,
      reasons: r.reasons,
      details: r.details ?? [],
      status: r.status,
      hidden: r.hidden,
      lastReportedAt: r.lastReportedAt,
      canAct: true,
    }));
  }

  /** 사이트 관리자는 채널 역할과 상관없이 처리할 수 있다 */
  async reportAction(admin: AdminUser, postId: number, commentId: number | undefined, action: 'hide' | 'unhide' | 'delete' | 'dismiss') {
    const target = commentId
      ? await this.db.one<{ channelId: number }>(
          'SELECT p.channel_id AS "channelId" FROM comments cm JOIN posts p ON p.id = cm.post_id WHERE cm.id = $1 AND cm.post_id = $2',
          [commentId, postId],
        )
      : await this.db.one<{ channelId: number }>('SELECT channel_id AS "channelId" FROM posts WHERE id = $1', [postId]);
    if (!target) throw ApiError.notFound(commentId ? '댓글을 찾을 수 없어요' : '게시글을 찾을 수 없어요');
    const label = commentId ? `comment:${commentId}` : `post:${postId}`;

    await this.db.transaction(async () => {
      if (action === 'delete') {
        if (commentId) {
          const removed = await this.db.one<{ n: number }>('SELECT count(*)::int AS n FROM comments WHERE id = $1 OR parent_id = $1', [commentId]);
          await this.db.execute('DELETE FROM comments WHERE id = $1', [commentId]);
          await this.db.execute('UPDATE posts SET comment_count = comment_count - $2 WHERE id = $1', [postId, removed!.n]);
        } else {
          await this.db.execute('DELETE FROM posts WHERE id = $1', [postId]);
          await this.db.execute('UPDATE channels SET post_count = post_count - 1 WHERE id = $1', [target.channelId]);
        }
        return;
      }
      if (action === 'hide' || action === 'unhide') {
        await this.db.execute(`UPDATE ${commentId ? 'comments' : 'posts'} SET hidden_at = ${action === 'hide' ? 'now()' : 'NULL'} WHERE id = $1`, [
          commentId ?? postId,
        ]);
      }
      await this.db.execute(
        `UPDATE reports SET status = $3, handled_by = $4, handled_at = now()
         WHERE post_id = $1 AND comment_id IS NOT DISTINCT FROM $2 AND status ${action === 'unhide' ? "<> 'open'" : "= 'open'"}`,
        [postId, commentId ?? null, action === 'hide' ? 'hidden' : 'dismissed', admin.id],
      );
    });
    this.posts.visibilityChanged();
    await this.log(admin.id, `report.${action}`, label);
  }

  /* ───── 사용자 ───── */

  async users(q: string | undefined, cursor: number | undefined) {
    const keyword = q?.trim().toLowerCase();
    const rows = await this.db.query<{
      id: number;
      uid: string;
      nickname: string;
      email: string;
      createdAt: Date;
      postCount: number;
      commentCount: number;
      points: number;
      suspended: boolean;
      withdrawn: boolean;
    }>(
      `SELECT u.id, u.uid::text AS uid, u.nickname, u.email, u.created_at AS "createdAt", u.points,
              (SELECT count(*)::int FROM posts WHERE author_id = u.id) AS "postCount",
              (SELECT count(*)::int FROM comments WHERE author_id = u.id) AS "commentCount",
              u.suspended_at IS NOT NULL AS suspended, u.withdrawn_at IS NOT NULL AS withdrawn
       FROM users u
       WHERE ($1::text IS NULL OR lower(u.nickname) LIKE $1 ESCAPE '\\' OR lower(u.email) LIKE $1 ESCAPE '\\')
         AND ($2::int IS NULL OR u.id < $2)
       ORDER BY u.id DESC LIMIT 31`,
      [keyword ? `%${escapeLike(keyword)}%` : null, cursor ?? null],
    );
    const admins = adminEmails();
    const page = cursorPage(rows, 30);
    return {
      nextCursor: page.nextCursor,
      items: page.items.map(({ id: _, uid, withdrawn, email, ...u }) => ({
        ...u,
        id: uid,
        // 탈퇴한 계정의 이메일은 내부용 주소라 보여 주지 않는다
        email: withdrawn ? undefined : email,
        withdrawn,
        admin: admins.has(email.toLowerCase()),
      })),
    };
  }

  /** 이용 정지 · 해제. 정지하면 모든 기기에서 로그아웃되고 다시 로그인할 수 없다. 관리자는 정지할 수 없다 */
  async suspend(admin: AdminUser, uid: string, suspend: boolean) {
    const user = /^[0-9a-f-]{36}$/i.test(uid)
      ? await this.db.one<{ id: number; email: string; nickname: string }>('SELECT id, email, nickname FROM users WHERE uid::text = $1', [uid.toLowerCase()])
      : undefined;
    if (!user) throw ApiError.notFound('없는 사용자예요');
    if (adminEmails().has(user.email.toLowerCase())) throw ApiError.badRequest('관리자 계정은 정지할 수 없어요');
    await this.db.transaction(async () => {
      await this.db.execute(`UPDATE users SET suspended_at = ${suspend ? 'now()' : 'NULL'} WHERE id = $1`, [user.id]);
      if (suspend) await this.db.execute('DELETE FROM sessions WHERE user_id = $1', [user.id]);
    });
    await this.log(admin.id, suspend ? 'user.suspend' : 'user.unsuspend', `user:${uid}`, user.nickname);
  }

  /* ───── 채널 ───── */

  async channelList(q: string | undefined) {
    const keyword = q?.trim().toLowerCase();
    return this.db.query(
      `SELECT c.slug, c.name, c.visibility, c.adult, c.member_count AS "memberCount", c.post_count AS "postCount",
              c.created_at AS "createdAt", u.nickname AS "ownerNickname", u.uid::text AS "ownerId",
              (SELECT count(DISTINCT (post_id, comment_id))::int FROM reports r WHERE r.channel_id = c.id AND r.status = 'open') AS "openReports"
       FROM channels c LEFT JOIN users u ON u.id = c.owner_id
       WHERE ($1::text IS NULL OR lower(c.name) LIKE $1 ESCAPE '\\' OR c.slug LIKE $1 ESCAPE '\\')
       ORDER BY c.member_count DESC, c.id ASC LIMIT 100`,
      [keyword ? `%${escapeLike(keyword)}%` : null],
    );
  }

  /* ───── 관리 기록 ───── */

  logs() {
    return this.db.query(
      `SELECT l.id, l.action, l.target, l.detail, l.created_at AS "createdAt", u.nickname AS "adminNickname"
       FROM admin_logs l LEFT JOIN users u ON u.id = l.admin_id ORDER BY l.id DESC LIMIT 200`,
    );
  }

  private async log(adminId: number, action: string, target?: string, detail?: string) {
    await this.db
      .execute('INSERT INTO admin_logs (admin_id, action, target, detail) VALUES ($1, $2, $3, $4)', [
        adminId,
        action,
        target ?? null,
        detail?.slice(0, 300) ?? null,
      ])
      .catch(() => undefined);
    // 채널 신고 수 · 인기 채널 숫자가 바뀌었을 수 있다
    this.channels.popularCache.clear();
  }
}

/** 없는 계정일 때 비교용 (아무 비밀번호와도 맞지 않는 해시) */
const DUMMY_HASH = bcrypt.hashSync(`no-account-${Math.random()}`, 10);
