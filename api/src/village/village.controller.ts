import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser, Public } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { VillageService } from './village.service';

/** 채널 마을 (채널을 볼 수 있는 사람이면 누구나) */
@Controller()
export class VillageController {
  constructor(private readonly village: VillageService) {}

  @Public()
  @Get('channels/:slug/village')
  get(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.village.village(slug, user?.id);
  }
}
