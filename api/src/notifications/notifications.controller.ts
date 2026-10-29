import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { LoginUser, Public } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { ApiError } from '../common/api-error';
import { intParam } from '../common/cursor-page';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

class PushTokenInput {
  @IsString()
  @MaxLength(255)
  token!: string;

  @IsIn(['ios', 'android'])
  platform!: string;
}

class PushTokenDeleteInput {
  @IsString()
  @MaxLength(255)
  token!: string;
}

/** 내 알림: 목록 · 안 읽은 수(헤더 종의 빨간 점) · 읽음 표시 */
@Controller()
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

  /** 앱: 로그인하면 이 기기의 푸시 토큰을 등록한다 */
  @Post('me/push-tokens')
  @HttpCode(HttpStatus.NO_CONTENT)
  registerPush(@LoginUser() user: AuthUser, @Body() input: PushTokenInput) {
    return this.push.register(user.id, input.token, input.platform);
  }

  /** 앱: 로그아웃하면 이 기기로는 더 보내지 않는다 (로그인이 이미 풀렸어도 지울 수 있게 토큰만 받는다) */
  @Public()
  @Delete('me/push-tokens')
  @HttpCode(HttpStatus.NO_CONTENT)
  unregisterPush(@Body() input: PushTokenDeleteInput) {
    return this.push.unregister(input.token);
  }

  @Get('me/notifications')
  list(@LoginUser() user: AuthUser, @Query('cursor') cursor?: string, @Query('size') size?: string) {
    return this.notifications.list(user.id, intParam(cursor), intParam(size) ?? 20);
  }

  @Get('me/notifications/unread')
  unread(@LoginUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Post('me/notifications/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  readAll(@LoginUser() user: AuthUser) {
    return this.notifications.readAll(user.id);
  }

  @Post('me/notifications/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  read(@LoginUser() user: AuthUser, @Param('id') raw: string) {
    const id = intParam(raw);
    if (id === undefined) throw ApiError.badRequest('잘못된 요청이에요');
    return this.notifications.read(user.id, id);
  }
}
