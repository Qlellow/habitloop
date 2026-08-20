import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HabitsModule } from './habits/habits.module';
import { CheckInsModule } from './checkins/checkins.module';
import { SocialModule } from './social/social.module';
import { User } from './users/user.entity';
import { Habit } from './habits/habit.entity';
import { CheckIn } from './checkins/checkin.entity';
import { Follow } from './social/follow.entity';
import { Like } from './social/like.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USER', 'habitloop'),
        password: config.get<string>('DB_PASSWORD', 'habitloop'),
        database: config.get<string>('DB_NAME', 'habitloop'),
        entities: [User, Habit, CheckIn, Follow, Like],
        synchronize: true,
      }),
    }),
    AuthModule,
    UsersModule,
    HabitsModule,
    CheckInsModule,
    SocialModule,
  ],
})
export class AppModule {}
