import { Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SocialService } from './social.service';

@ApiTags('social')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Post('users/:userId/follow')
  follow(@CurrentUser() user: { userId: number }, @Param('userId', ParseIntPipe) targetId: number) {
    return this.social.follow(user.userId, targetId);
  }

  @Delete('users/:userId/follow')
  unfollow(@CurrentUser() user: { userId: number }, @Param('userId', ParseIntPipe) targetId: number) {
    return this.social.unfollow(user.userId, targetId);
  }

  @Post('checkins/:checkInId/like')
  toggleLike(
    @CurrentUser() user: { userId: number },
    @Param('checkInId', ParseIntPipe) checkInId: number,
  ) {
    return this.social.toggleLike(user.userId, checkInId);
  }

  @Get('feed')
  feed(@CurrentUser() user: { userId: number }) {
    return this.social.feed(user.userId);
  }
}
