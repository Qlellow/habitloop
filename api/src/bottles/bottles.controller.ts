import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { LoginUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { ApiError } from '../common/api-error';
import { intParam } from '../common/cursor-page';
import { BottlesService } from './bottles.service';

const id = (value: string) => {
  const n = intParam(value);
  if (n === undefined) throw ApiError.badRequest('잘못된 요청이에요');
  return n;
};

/** 메시지 표류병: 바다 보기(병 줍기) · 띄우기 · 답장 · 다시 띄우기 · 신고 · 내가 띄운 병 */
@Controller('bottles')
export class BottlesController {
  constructor(private readonly bottles: BottlesService) {}

  @Get('sea')
  sea(@LoginUser() user: AuthUser) {
    return this.bottles.sea(user.id);
  }

  @Get('mine')
  mine(@LoginUser() user: AuthUser) {
    return this.bottles.mine(user.id);
  }

  @Post()
  throw(@LoginUser() user: AuthUser, @Body() body: { content?: string }) {
    return this.bottles.throw(user.id, String(body?.content ?? ''));
  }

  @Post(':id/reply')
  @HttpCode(HttpStatus.NO_CONTENT)
  reply(@LoginUser() user: AuthUser, @Param('id') raw: string, @Body() body: { content?: string }) {
    return this.bottles.reply(user.id, id(raw), String(body?.content ?? ''));
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.NO_CONTENT)
  release(@LoginUser() user: AuthUser, @Param('id') raw: string) {
    return this.bottles.release(user.id, id(raw));
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  report(@LoginUser() user: AuthUser, @Param('id') raw: string) {
    return this.bottles.report(user.id, id(raw));
  }
}
