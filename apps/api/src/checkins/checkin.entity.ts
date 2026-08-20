import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Habit } from '../habits/habit.entity';
import { User } from '../users/user.entity';
import { Like } from '../social/like.entity';

@Entity('check_ins')
@Unique(['habit', 'date'])
export class CheckIn {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Habit, (habit) => habit.checkIns, { onDelete: 'CASCADE' })
  habit: Habit;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'date' })
  date: string;

  @Column({ nullable: true })
  note: string;

  @OneToMany(() => Like, (like) => like.checkIn)
  likes: Like[];

  @CreateDateColumn()
  createdAt: Date;
}
