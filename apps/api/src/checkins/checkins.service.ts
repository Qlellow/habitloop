import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CheckIn } from './checkin.entity';
import { HabitsService } from '../habits/habits.service';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class CheckInsService {
  constructor(
    @InjectRepository(CheckIn) private readonly checkIns: Repository<CheckIn>,
    private readonly habits: HabitsService,
  ) {}

  async checkInToday(userId: number, habitId: number, note?: string) {
    const habit = await this.habits.findOneOwned(userId, habitId);
    const date = todayStr();

    const existing = await this.checkIns.findOne({ where: { habit: { id: habit.id }, date } });
    if (existing) throw new ConflictException('Already checked in today');

    const checkIn = this.checkIns.create({
      habit,
      user: { id: userId } as any,
      date,
      note,
    });
    return this.checkIns.save(checkIn);
  }

  async streak(habitId: number): Promise<number> {
    const rows = await this.checkIns.find({
      where: { habit: { id: habitId } },
      order: { date: 'DESC' },
    });
    if (rows.length === 0) return 0;

    let streak = 0;
    let cursor = new Date(todayStr());
    const dates = new Set(rows.map((r) => r.date));

    while (dates.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  async feedForUsers(userIds: number[], limit = 30) {
    if (userIds.length === 0) return [];
    return this.checkIns.find({
      where: userIds.map((id) => ({ user: { id } })),
      relations: ['habit', 'user', 'likes', 'likes.user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
