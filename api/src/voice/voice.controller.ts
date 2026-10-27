import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, LoginUser, Public } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { ApiError } from '../common/api-error';
import { intParam } from '../common/cursor-page';
import { BadgesService } from '../badges/badges.service';
import { VoiceService } from './voice.service';

const id = (value: string) => {
  const n = intParam(value);
  if (n === undefined) throw ApiError.badRequest('잘못된 요청이에요');
  return n;
};

type RoomBody = { name?: unknown; maxParticipants?: unknown };

/** 채널 음성채팅: 음성방 목록 · 만들기/바꾸기/지우기(운영진) · 입장 토큰 */
@Controller()
export class VoiceController {
  constructor(
    private readonly voice: VoiceService,
    private readonly badges: BadgesService,
  ) {}

  /** 음성방 찾기 (커맨드 팔레트 voice:) */
  @Public()
  @Get('voice/rooms')
  search(@Query('q') q: string | undefined, @CurrentUser() user?: AuthUser) {
    return this.voice.search(q, user?.id);
  }

  @Public()
  @Get('channels/:slug/voice')
  list(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.voice.list(slug, user?.id);
  }

  @Post('channels/:slug/voice')
  create(@Param('slug') slug: string, @LoginUser() user: AuthUser, @Body() body: RoomBody) {
    return this.voice.create(slug, user.id, body);
  }

  @Put('channels/:slug/voice/:roomId')
  update(@Param('slug') slug: string, @Param('roomId') roomId: string, @LoginUser() user: AuthUser, @Body() body: RoomBody) {
    return this.voice.update(slug, id(roomId), user.id, body);
  }

  @Delete('channels/:slug/voice/:roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('slug') slug: string, @Param('roomId') roomId: string, @LoginUser() user: AuthUser) {
    return this.voice.remove(slug, id(roomId), user.id);
  }

  @Post('voice/rooms/:roomId/token')
  @HttpCode(HttpStatus.OK)
  async token(@Param('roomId') roomId: string, @LoginUser() user: AuthUser) {
    const res = await this.voice.token(id(roomId), user.id);
    // 음성방에 들어감 (배지 '첫 목소리')
    await this.badges.bump(user.id, 'voice_join');
    await this.badges.checkQuietly(user.id);
    return res;
  }
}
