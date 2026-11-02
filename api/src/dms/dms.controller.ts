import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { LoginUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { intParam } from '../common/cursor-page';
import { DmsService } from './dms.service';

/** 1:1 쪽지: 대화 목록 · 한 사람과의 쪽지 · 보내기 · 나가기 · 안 읽은 수 · 받기 설정 */
@Controller('me')
export class DmsController {
  constructor(private readonly dms: DmsService) {}

  @Get('dms')
  threads(@LoginUser() user: AuthUser) {
    return this.dms.threads(user.id);
  }

  @Get('dms/unread')
  unread(@LoginUser() user: AuthUser) {
    return this.dms.unread(user.id);
  }

  @Get('dm-policy')
  policy(@LoginUser() user: AuthUser) {
    return this.dms.policy(user.id);
  }

  @Put('dm-policy')
  setPolicy(@LoginUser() user: AuthUser, @Body() body: { policy?: unknown }) {
    return this.dms.setPolicy(user.id, body?.policy);
  }

  @Get('dms/:userId')
  messages(@LoginUser() user: AuthUser, @Param('userId') uid: string, @Query('before') before?: string) {
    return this.dms.messages(user.id, uid, intParam(before));
  }

  @Post('dms/:userId')
  send(@LoginUser() user: AuthUser, @Param('userId') uid: string, @Body() body: { content?: unknown }) {
    return this.dms.send(user.id, uid, body?.content);
  }

  @Delete('dms/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(@LoginUser() user: AuthUser, @Param('userId') uid: string) {
    return this.dms.leave(user.id, uid);
  }
}
