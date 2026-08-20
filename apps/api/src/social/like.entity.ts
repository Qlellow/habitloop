import { Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity';
import { CheckIn } from '../checkins/checkin.entity';

@Entity('likes')
@Unique(['user', 'checkIn'])
export class Like {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => CheckIn, (checkIn) => checkIn.likes, { onDelete: 'CASCADE' })
  checkIn: CheckIn;
}
