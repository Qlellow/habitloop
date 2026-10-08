import { Controller, Get, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth/auth.controller';
import { AuthGuard, Public } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { JwtService } from './auth/jwt.service';
import { OAuthController } from './auth/oauth.controller';
import { OAuthService } from './auth/oauth.service';
import { CategoriesService } from './channels/categories.service';
import { ChannelsController } from './channels/channels.controller';
import { ChannelsService } from './channels/channels.service';
import { IconsService } from './channels/icons.service';
import { MembershipService } from './channels/membership.service';
import { PreviewsService } from './channels/previews.service';
import { StaffService } from './channels/staff.service';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { ImagesController } from './images/images.controller';
import { ImagesService } from './images/images.service';
import { Database } from './db/database';
import { Seeder } from './db/seed';
import { Mailer } from './mail/mailer';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { VerificationService } from './mail/verification.service';
import { CommentsService } from './posts/comments.service';
import { PostsController } from './posts/posts.controller';
import { PostsService } from './posts/posts.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { RewardsService } from './users/rewards.service';
import { UsersController } from './users/users.controller';

@Controller()
class HealthController {
  /** 배포 확인용 */
  @Public()
  @Get('health')
  health() {
    return { status: 'UP' };
  }
}

@Module({
  controllers: [HealthController, AuthController, OAuthController, ChannelsController, PostsController, ImagesController, UsersController, NotificationsController, ReportsController],
  providers: [
    Database,
    ImagesService,
    Seeder,
    JwtService,
    Mailer,
    VerificationService,
    AuthService,
    ChannelsService,
    MembershipService,
    StaffService,
    IconsService,
    CategoriesService,
    PostsService,
    CommentsService,
    PreviewsService,
    RewardsService,
    NotificationsService,
    ReportsService,
    OAuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
