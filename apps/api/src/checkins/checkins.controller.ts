import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CheckInsService } from './checkins.service';

@ApiTags('checkins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('habits/:habitId/checkins')
export class CheckInsController {
  constructor(private readonly checkIns: CheckInsService) {}

  @Post()
  checkInToday(
    @CurrentUser() user: { userId: number },
    @Param('habitId', ParseIntPipe) habitId: number,
    @Body() body: { note?: string },
  ) {
    return this.checkIns.checkInToday(user.userId, habitId, body?.note);
  }

  @Get('streak')
  streak(@Param('habitId', ParseIntPipe) habitId: number) {
    return this.checkIns.streak(habitId).then((count) => ({ habitId, streak: count }));
  }
}
