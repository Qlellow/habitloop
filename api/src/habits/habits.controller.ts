import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, LoginUser, Public } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { ApiError } from '../common/api-error';
import { intParam } from '../common/cursor-page';
import { HabitsService } from './habits.service';

const id = (value: string) => {
  const n = intParam(value);
  if (n === undefined) throw ApiError.badRequest('잘못된 요청이에요');
  return n;
};

/** 습관 체크인 · 채널 챌린지 */
@Controller()
export class HabitsController {
  constructor(private readonly habits: HabitsService) {}

  @Get('me/habits')
  list(@LoginUser() user: AuthUser) {
    return this.habits.list(user.id);
  }

  @Post('me/habits')
  create(@LoginUser() user: AuthUser, @Body() body: { title?: unknown; emoji?: unknown }) {
    return this.habits.create(user.id, body ?? {});
  }

  @Put('me/habits/:id')
  update(@LoginUser() user: AuthUser, @Param('id') raw: string, @Body() body: { title?: unknown; emoji?: unknown }) {
    return this.habits.update(user.id, id(raw), body ?? {});
  }

  @Delete('me/habits/:id')
  archive(@LoginUser() user: AuthUser, @Param('id') raw: string) {
    return this.habits.archive(user.id, id(raw));
  }

  /** 체크 · 취소 (day 없으면 오늘) */
  @Put('me/habits/:id/check')
  check(@LoginUser() user: AuthUser, @Param('id') raw: string, @Query('day') day?: string) {
    return this.habits.check(user.id, id(raw), day, true);
  }

  @Delete('me/habits/:id/check')
  uncheck(@LoginUser() user: AuthUser, @Param('id') raw: string, @Query('day') day?: string) {
    return this.habits.check(user.id, id(raw), day, false);
  }

  @Public()
  @Get('channels/:slug/challenges')
  challenges(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.habits.challenges(slug, user?.id);
  }

  @Post('channels/:slug/challenges')
  open(@LoginUser() user: AuthUser, @Param('slug') slug: string, @Body() body: { title?: unknown; emoji?: unknown; days?: unknown }) {
    return this.habits.openChallenge(slug, user.id, body ?? {});
  }

  @Post('challenges/:id/join')
  join(@LoginUser() user: AuthUser, @Param('id') raw: string) {
    return this.habits.join(id(raw), user.id);
  }
}
