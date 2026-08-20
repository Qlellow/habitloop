import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { CheckIn } from '../checkins/checkin.entity';

@Entity('habits')
export class Habit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  emoji: string;

  @ManyToOne(() => User, (user) => user.habits, { onDelete: 'CASCADE' })
  owner: User;

  @OneToMany(() => CheckIn, (checkIn) => checkIn.habit)
  checkIns: CheckIn[];

  @CreateDateColumn()
  createdAt: Date;
}
