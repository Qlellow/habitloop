import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckIn } from './checkin.entity';
import { CheckInsService } from './checkins.service';
import { CheckInsController } from './checkins.controller';
import { HabitsModule } from '../habits/habits.module';

@Module({
  imports: [TypeOrmModule.forFeature([CheckIn]), HabitsModule],
  providers: [CheckInsService],
  controllers: [CheckInsController],
  exports: [CheckInsService],
})
export class CheckInsModule {}
