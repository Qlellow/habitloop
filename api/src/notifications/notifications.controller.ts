import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { LoginUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { ApiError } from '../common/api-error';
import { intParam } from '../common/cursor-page';
import { NotificationsService } from './notifications.service';

/** 내 알림: 목록 · 안 읽은 수(헤더 종의 빨간 점) · 읽음 표시 */
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

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
