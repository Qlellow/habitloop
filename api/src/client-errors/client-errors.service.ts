import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Database } from '../db/database';

export interface ClientErrorInput {
  kind?: string;
  message?: string;
  stack?: string;
  url?: string;
  release?: string;
}

const KINDS = ['render', 'error', 'rejection', 'chunk'] as const;
/** IP 마다 1분에 받는 보고 수 (오류가 반복돼도 서버가 넘치지 않게) */
const PER_MINUTE = 20;
const cut = (s: unknown, n: number) => String(s ?? '').slice(0, n);

/**
 * 사용자 화면에서 난 오류 모으기. 같은 오류(종류 + 메시지 + 스택 첫 줄)는 한 줄로 묶어 횟수만 센다.
 * 개인 정보는 남기지 않는다: 주소는 경로만(쿼리 · 해시 제거), 사용자 · IP 는 저장하지 않는다
 */
@Injectable()
export class ClientErrorsService {
  private readonly hits = new Map<string, { n: number; until: number }>();

  constructor(private readonly db: Database) {}

  /** 받았으면 true, 너무 잦아 버렸으면 false */
  async report(ip: string, input: ClientErrorInput, userAgent: string): Promise<boolean> {
    const now = Date.now();
    const hit = this.hits.get(ip);
    if (hit && hit.until > now) {
      if (++hit.n > PER_MINUTE) return false;
    } else this.hits.set(ip, { n: 1, until: now + 60_000 });
    if (this.hits.size > 10_000) this.hits.clear();

    const kind = (KINDS as readonly string[]).includes(input.kind ?? '') ? input.kind! : 'error';
    const message = cut(input.message, 500).trim() || '(메시지 없음)';
    const stack = cut(input.stack, 4000);
    let path = '/';
    try {
      path = new URL(cut(input.url, 500), 'http://x').pathname.slice(0, 200);
    } catch {
      // 주소가 이상하면 '/' 로
    }
    // 새 버전 파일 오류는 어디서 잡혔든 같은 일이라 메시지로만 묶는다
    const top = kind === 'chunk' ? '' : (stack.split('\n').find((l) => l.includes('at ') || l.includes('@'))?.trim() ?? '');
    const fingerprint = createHash('sha1').update(`${kind}|${message}|${top.replace(/\?[^:)]*/, '').replace(/-[A-Za-z0-9_]{8}\.js/, '.js')}`).digest('hex');
    await this.db.execute(
      `INSERT INTO client_errors (fingerprint, kind, message, stack, path, user_agent, release)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (fingerprint) DO UPDATE SET count = client_errors.count + 1, last_seen = now(),
         path = EXCLUDED.path, user_agent = EXCLUDED.user_agent, release = EXCLUDED.release, stack = EXCLUDED.stack`,
      [fingerprint, kind, message, stack, path, cut(userAgent, 300), cut(input.release, 40) || null],
    );
    return true;
  }

  /** 관리자: 최근에 난 순서 */
  list() {
    return this.db.query(
      `SELECT fingerprint AS id, kind, message, stack, path, user_agent AS "userAgent", release, count,
              first_seen AS "firstSeen", last_seen AS "lastSeen"
       FROM client_errors ORDER BY last_seen DESC LIMIT 100`,
    );
  }

  /** 관리자: 고쳤으면 지운다 (다시 나면 새로 쌓인다) */
  async resolve(id: string) {
    await this.db.execute('DELETE FROM client_errors WHERE fingerprint = $1', [id]);
  }
}
