import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { LoginUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { BadgesService } from '../badges/badges.service';
import { PetsService } from './pets.service';

/** 커뮤니티 펫: 데려오기 · 보기 · 이름/전시 바꾸기 · 쓰다듬기 (다른 사람의 펫은 프로필 GET /users/:id 에) */
@Controller()
export class PetsController {
  constructor(
    private readonly pets: PetsService,
    private readonly badges: BadgesService,
  ) {}

  @Get('me/pet')
  async mine(@LoginUser() user: AuthUser) {
    return { pet: await this.pets.mine(user.id) };
  }

  @Post('me/pet')
  adopt(@LoginUser() user: AuthUser, @Body() body: { species?: string; name?: string }) {
    return this.pets.adopt(user.id, body ?? {});
  }

  @Patch('me/pet')
  update(@LoginUser() user: AuthUser, @Body() body: { name?: string; shown?: boolean }) {
    return this.pets.update(user.id, body ?? {});
  }

  @Post('me/pet/pat')
  @HttpCode(HttpStatus.OK)
  async pat(@LoginUser() user: AuthUser) {
    const res = await this.pets.pat(user.id);
    // 하루에 쓰다듬은 횟수 (숨은 배지 '쓰다듬기 중독')
    const day = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    await this.badges.bump(user.id, `pat:${day}`);
    await this.badges.checkQuietly(user.id);
    return res;
  }
}
