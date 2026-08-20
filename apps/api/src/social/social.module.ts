import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Follow } from './follow.entity';
import { Like } from './like.entity';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { CheckInsModule } from '../checkins/checkins.module';

@Module({
  imports: [TypeOrmModule.forFeature([Follow, Like]), CheckInsModule],
  providers: [SocialService],
  controllers: [SocialController],
})
export class SocialModule {}
