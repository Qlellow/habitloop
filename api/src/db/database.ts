import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { MIGRATIONS } from './migrations';

/** SQL 을 실행하는 대상 (커넥션 풀 또는 트랜잭션 중인 커넥션) */
interface Executor {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number }>;
}

interface Driver extends Executor {
  /** 여러 문장으로 된 SQL (마이그레이션) */
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * 운영: DATABASE_URL 의 Postgres (Neon 등) — node-postgres 커넥션 풀.
 * 서버리스 함수 인스턴스마다 풀이 생기므로 연결 수를 작게 잡는다 (Neon 은 pooled 주소를 쓰면 더 좋다).
 */
async function postgresDriver(url: string): Promise<Driver> {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: url, max: Number(process.env.DB_POOL_SIZE ?? 5), idleTimeoutMillis: 10_000 });
  const run = async (client: { query: (s: string, p?: unknown[]) => Promise<any> }, sql: string, params?: unknown[]) => {
    const res = await client.query(sql, params);
    return { rows: res.rows ?? [], rowCount: res.rowCount ?? 0 };
  };
  return {
    query: (sql, params) => run(pool, sql, params),
    exec: async (sql) => void (await pool.query(sql)),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: (sql, params) => run(client, sql, params) });
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/**
 * 로컬 개발 · 테스트: 메모리 안에서 도는 진짜 Postgres (PGlite). 설치 없이 바로 뜨고, 끄면 데이터가 사라진다.
 * 커넥션이 하나라 PGlite 가 쿼리와 트랜잭션을 알아서 줄 세운다.
 */
async function pgliteDriver(): Promise<Driver> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  const run = async (q: { query: (s: string, p?: unknown[]) => Promise<any> }, sql: string, params?: unknown[]) => {
    const res = await q.query(sql, params);
    return { rows: res.rows ?? [], rowCount: res.affectedRows ?? res.rows?.length ?? 0 };
  };
  return {
    query: (sql, params) => run(db, sql, params),
    exec: async (sql) => void (await db.exec(sql)),
    transaction: (fn) => db.transaction((tx) => fn({ query: (sql, params) => run(tx, sql, params) })),
    close: () => db.close(),
  };
}

/**
 * DB 접근. Spring 의 @Transactional 처럼, transaction() 안에서 부르는 query 는 (다른 서비스에서 부르더라도)
 * 자동으로 같은 트랜잭션을 쓴다 (AsyncLocalStorage).
 */
@Injectable()
export class Database implements OnModuleDestroy {
  private readonly log = new Logger(Database.name);
  private readonly current = new AsyncLocalStorage<Executor>();
  private driver?: Driver;
  private ready?: Promise<Driver>;

  /** 처음 쓸 때 연결하고 마이그레이션을 적용한다 (서버리스 콜드 스타트에서 한 번) */
  private connect(): Promise<Driver> {
    this.ready ??= (async () => {
      const url = process.env.DATABASE_URL;
      const driver = url ? await postgresDriver(url) : await pgliteDriver();
      if (!url) this.log.warn('DATABASE_URL 이 없어 메모리 DB(PGlite)를 써요. 끄면 데이터가 사라져요');
      await this.migrate(driver);
      this.driver = driver;
      return driver;
    })().catch((e) => {
      this.ready = undefined; // 다음 요청에서 다시 시도
      throw e;
    });
    return this.ready;
  }

  private async migrate(driver: Driver) {
    await driver.transaction(async (tx) => {
      // 여러 인스턴스가 동시에 떠도 한 곳에서만 적용하도록 잠근다
      await tx.query('SELECT pg_advisory_xact_lock(727274)');
      await tx.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
      const done = new Set((await tx.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name as string));
      for (const m of MIGRATIONS) {
        if (done.has(m.name)) continue;
        for (const statement of splitStatements(m.sql)) await tx.query(statement);
        await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [m.name]);
        this.log.log(`마이그레이션 적용: ${m.name}`);
      }
    });
  }

  private async executor(): Promise<Executor> {
    return this.current.getStore() ?? this.driver ?? (await this.connect());
  }

  /** 여러 행 */
  async query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await (await this.executor()).query(sql, params)).rows as T[];
  }

  /** 첫 행 (없으면 undefined) */
  async one<T = any>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return (await this.query<T>(sql, params))[0];
  }

  /** 바뀐 행 수 */
  async execute(sql: string, params: unknown[] = []): Promise<number> {
    return (await (await this.executor()).query(sql, params)).rowCount;
  }

  /** 이미 트랜잭션 안이면 그 트랜잭션을 그대로 쓴다 */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.current.getStore()) return fn();
    const driver = this.driver ?? (await this.connect());
    return driver.transaction((tx) => this.current.run(tx, fn));
  }

  async onModuleDestroy() {
    const driver = this.driver;
    this.driver = undefined;
    this.ready = undefined;
    await driver?.close();
  }
}

/** 마이그레이션 SQL 을 문장 단위로 나눈다 (주석 줄 제거, 문자열 안의 ; 는 쓰지 않는다는 전제) */
function splitStatements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Postgres 오류 코드: 23505 unique 위반, 23503 FK 위반 */
export function isConstraintViolation(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code === '23505' || code === '23503';
}
