import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { HabitsService } from './habits.service';

@ApiTags('habits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('habits')
export class HabitsController {
  constructor(private readonly habits: HabitsService) {}

  @Get()
  findMine(@CurrentUser() user: { userId: number }) {
    return this.habits.findMine(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: { userId: number },
    @Body() body: { title: string; emoji?: string },
  ) {
    return this.habits.create(user.userId, body.title, body.emoji);
  }
}
