import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, LoginUser, Public } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';
import { BadgesService } from './badges.service';

/** 배지 도감 · 대표 배지 · 새 배지 알림 · 화면에서 보내는 기록 */
@Controller()
export class BadgesController {
  constructor(
    private readonly badges: BadgesService,
    private readonly db: Database,
  ) {}

  /** 도감: ?user=UUID 면 그 사람의 것 (없으면 내 것, 로그인 필요). 진행도는 내 도감에서만 */
  @Public()
  @Get('badges')
  async book(@Query('user') uid: string | undefined, @CurrentUser() viewer?: AuthUser) {
    if (!uid) {
      if (!viewer) throw ApiError.unauthorized();
      return this.badges.book(viewer.id, true);
    }
    const user = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)
      ? await this.db.one<{ id: number }>('SELECT id FROM users WHERE uid::text = $1 AND withdrawn_at IS NULL', [uid.toLowerCase()])
      : undefined;
    if (!user) throw ApiError.notFound('없는 사용자예요');
    return this.badges.book(user.id, user.id === viewer?.id);
  }

  @Put('me/badge')
  feature(@LoginUser() user: AuthUser, @Body() body: { code?: string | null }) {
    return this.badges.feature(user.id, body?.code ?? null);
  }

  @Get('me/badges/new')
  unseen(@LoginUser() user: AuthUser) {
    return this.badges.unseen(user.id);
  }

  @Post('me/badges/seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  seen(@LoginUser() user: AuthUser) {
    return this.badges.markSeen(user.id);
  }

  /** 화면에서 일어난 일 (커맨드 팔레트 · 몰입 모드 · 별똥별 · 숨은 애니메이션 · 음성방 시간 · 화면 공유) */
  @Post('me/badge-events')
  @HttpCode(HttpStatus.OK)
  event(@LoginUser() user: AuthUser, @Body() body: { event?: string }) {
    return this.badges.clientEvent(user.id, String(body?.event ?? ''));
  }
}
