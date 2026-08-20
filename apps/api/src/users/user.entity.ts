import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Habit } from '../habits/habit.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  nickname: string;

  @OneToMany(() => Habit, (habit) => habit.owner)
  habits: Habit[];
}
