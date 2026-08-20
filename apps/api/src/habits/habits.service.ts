import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Habit } from './habit.entity';

@Injectable()
export class HabitsService {
  constructor(@InjectRepository(Habit) private readonly habits: Repository<Habit>) {}

  async create(userId: number, title: string, emoji?: string) {
    const habit = this.habits.create({ title, emoji, owner: { id: userId } as any });
    return this.habits.save(habit);
  }

  findMine(userId: number) {
    return this.habits.find({
      where: { owner: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneOwned(userId: number, habitId: number) {
    const habit = await this.habits.findOne({
      where: { id: habitId },
      relations: ['owner'],
    });
    if (!habit) throw new NotFoundException('Habit not found');
    if (habit.owner.id !== userId) throw new ForbiddenException();
    return habit;
  }
}
