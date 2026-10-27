import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { clamp, cursorPage } from '../common/cursor-page';
import { Database } from '../db/database';
import { makeExcerpt } from '../posts/excerpt';

export const NOTICE_KINDS = ['update', 'notice', 'event', 'maintenance'] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

export interface NoticeInput {
  title: string;
  body: string;
  kind: NoticeKind;
  pinned?: boolean;
  version?: string | null;
}

interface NoticeRow {
  id: number;
  title: string;
  body: string;
  kind: NoticeKind;
  pinned: boolean;
  version: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

const COLUMNS = `id, title, body, kind, pinned, version, created_at AS "createdAt", updated_at AS "updatedAt"`;

const summary = (n: NoticeRow) => ({
  id: n.id,
  title: n.title,
  excerpt: makeExcerpt(n.body),
  kind: n.kind,
  pinned: n.pinned,
  version: n.version ?? undefined,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt ?? undefined,
});

/**
 * 사이트 공지사항 (업데이트 소식 · 공지 · 이벤트 · 점검). 사이트 관리자만 쓰고, 누구나 본다.
 * 채널 공지(운영진 전용 카테고리)와는 따로다
 */
@Injectable()
export class NoticesService {
  constructor(private readonly db: Database) {}

  /** 목록: 첫 페이지에는 고정 공지를 따로 함께. 나머지는 최신순 (키셋 페이지네이션) */
  async list(kind: NoticeKind | undefined, cursor: number | undefined, size: number) {
    const pageSize = clamp(size, 1, 50);
    const rows = await this.db.query<NoticeRow>(
      `SELECT ${COLUMNS} FROM site_notices
       WHERE NOT pinned AND ($1::text IS NULL OR kind = $1) AND ($2::int IS NULL OR id < $2)
       ORDER BY id DESC LIMIT $3`,
      [kind ?? null, cursor ?? null, pageSize + 1],
    );
    const page = cursorPage(rows, pageSize);
    const pinned =
      cursor == null
        ? await this.db.query<NoticeRow>(`SELECT ${COLUMNS} FROM site_notices WHERE pinned AND ($1::text IS NULL OR kind = $1) ORDER BY id DESC`, [kind ?? null])
        : [];
    return { pinned: pinned.map(summary), items: page.items.map(summary), nextCursor: page.nextCursor };
  }

  /** 가장 최근 공지 (안 읽은 공지 점) */
  async latest() {
    const row = await this.db.one<{ id: number; title: string; kind: NoticeKind; createdAt: Date }>(
      'SELECT id, title, kind, created_at AS "createdAt" FROM site_notices ORDER BY id DESC LIMIT 1',
    );
    return row ?? {};
  }

  /** 자세히 + 이전 · 다음 공지 */
  async get(id: number) {
    const row = await this.db.one<NoticeRow>(`SELECT ${COLUMNS} FROM site_notices WHERE id = $1`, [id]);
    if (!row) throw ApiError.notFound('없는 공지예요');
    const [prev, next] = await Promise.all([
      this.db.one<{ id: number; title: string }>('SELECT id, title FROM site_notices WHERE id < $1 ORDER BY id DESC LIMIT 1', [id]),
      this.db.one<{ id: number; title: string }>('SELECT id, title FROM site_notices WHERE id > $1 ORDER BY id ASC LIMIT 1', [id]),
    ]);
    return { ...summary(row), body: row.body, prev: prev ?? undefined, next: next ?? undefined };
  }

  async create(input: NoticeInput) {
    const row = await this.db.one<{ id: number }>(
      'INSERT INTO site_notices (title, body, kind, pinned, version) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [input.title.trim(), input.body, input.kind, !!input.pinned, input.version?.trim() || null],
    );
    return this.get(row!.id);
  }

  async update(id: number, input: NoticeInput) {
    const n = await this.db.execute(
      'UPDATE site_notices SET title = $2, body = $3, kind = $4, pinned = $5, version = $6, updated_at = now() WHERE id = $1',
      [id, input.title.trim(), input.body, input.kind, !!input.pinned, input.version?.trim() || null],
    );
    if (!n) throw ApiError.notFound('없는 공지예요');
    return this.get(id);
  }

  async remove(id: number) {
    const row = await this.db.one<{ title: string }>('DELETE FROM site_notices WHERE id = $1 RETURNING title', [id]);
    if (!row) throw ApiError.notFound('없는 공지예요');
    return row.title;
  }
}
