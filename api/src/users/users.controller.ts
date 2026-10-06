import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { LoginUser, Public } from '../auth/auth.guard';
import { AuthUser } from '../auth/jwt.service';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';
import { RewardsService } from './rewards.service';

/** 작성자 프로필: 닉네임 · 가입일 · 쓴 글 / 댓글 수 · 배지 (이메일 같은 개인 정보는 주지 않는다) */
@Controller()
export class UsersController {
  constructor(
    private readonly db: Database,
    private readonly rewards: RewardsService,
  ) {}

  @Public()
  @Get('users/:id')
  async profile(@Param('id') raw: string) {
    const user: { internalId: number; id: string; nickname: string; createdAt: Date; postCount: string; commentCount: string } | undefined =
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)
        ? undefined
        : await this.db.one(
            `SELECT u.id AS "internalId", u.uid::text AS id, u.nickname, u.created_at AS "createdAt", u.banner,
                    CASE WHEN u.avatar_id IS NULL THEN NULL ELSE '/api/images/' || u.avatar_id END AS "avatarUrl",
                    (SELECT count(*) FROM posts WHERE author_id = u.id) AS "postCount",
                    (SELECT count(*) FROM comments WHERE author_id = u.id) AS "commentCount"
             FROM users u WHERE u.uid::text = $1 AND u.withdrawn_at IS NULL`,
            [raw.toLowerCase()],
          );
    if (!user) throw ApiError.notFound('없는 사용자예요');
    const { internalId, ...rest } = user;
    return {
      ...rest,
      postCount: Number(user.postCount),
      commentCount: Number(user.commentCount),
      badges: await this.rewards.badges(internalId),
    };
  }

  /** 오늘 출석 체크. 앱을 열 때 부르면 하루 한 번만 포인트가 쌓인다 */
  @Post('me/attendance')
  @HttpCode(HttpStatus.OK)
  attend(@LoginUser() user: AuthUser) {
    return this.rewards.attend(user.id);
  }

  /** 내 초대 코드 (가입 주소에 ?ref=코드) 와 지금까지 초대한 사람 수 */
  @Get('me/invite')
  invite(@LoginUser() user: AuthUser) {
    return this.rewards.invite(user.id);
  }
}
