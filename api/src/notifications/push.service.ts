import { Injectable, Logger } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';

/** Expo 푸시 토큰 모양: ExponentPushToken[…] (기기마다 하나) */
const TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/;
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  userId: number;
  title: string;
  body?: string;
  /** 누르면 앱에서 열 화면 (예: /post/12) */
  url?: string;
}

/**
 * 앱 푸시 알림 (Expo Push 서비스). 앱이 로그인할 때 기기 토큰을 등록하고, 알림이 생기면 그 사람의 기기들로 보낸다.
 * 푸시는 덤: 실패해도 알림 목록에는 그대로 남고, 원래 요청(댓글 쓰기 등)은 성공한다.
 * 안드로이드는 EAS 에 FCM 키, iOS 는 APNs 키가 있어야 실제로 도착한다 (README 참고)
 */
@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name);

  constructor(private readonly db: Database) {}

  async register(userId: number, token: string, platform: string) {
    if (!TOKEN.test(token)) throw ApiError.badRequest('알림 토큰이 올바르지 않아요');
    // 같은 기기에서 다른 계정으로 로그인하면 그 계정으로 옮긴다
    await this.db.execute(
      `INSERT INTO push_tokens (token, user_id, platform) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = now()`,
      [token, userId, platform === 'ios' ? 'ios' : 'android'],
    );
  }

  /** 로그아웃: 이 기기로는 더 보내지 않는다 (토큰만 알면 지울 수 있다. 지우는 것뿐이라 괜찮다) */
  async unregister(token: string) {
    await this.db.execute('DELETE FROM push_tokens WHERE token = $1', [token]);
  }

  async send(messages: PushMessage[]) {
    if (!messages.length) return;
    try {
      const users = [...new Set(messages.map((m) => m.userId))];
      const rows = await this.db.query<{ token: string; userId: number }>('SELECT token, user_id AS "userId" FROM push_tokens WHERE user_id = ANY($1)', [users]);
      if (!rows.length) return;
      const out = messages.flatMap((m) =>
        rows
          .filter((r) => r.userId === m.userId)
          .map((r) => ({ to: r.token, title: m.title, body: m.body, data: m.url ? { url: m.url } : {}, sound: 'default', channelId: 'default' })),
      );
      for (let i = 0; i < out.length; i += 100) await this.post(out.slice(i, i + 100));
    } catch (e) {
      this.log.warn(`푸시를 보내지 못했어요: ${(e as Error).message}`);
    }
  }

  private async post(batch: { to: string }[]) {
    const res = await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(3000),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { status: string; details?: { error?: string } }[] };
    // 앱을 지웠거나 알림을 끈 기기의 토큰은 버린다
    const dead = (json.data ?? []).flatMap((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? [batch[i]!.to] : []));
    if (dead.length) await this.db.execute('DELETE FROM push_tokens WHERE token = ANY($1)', [dead]);
  }
}
