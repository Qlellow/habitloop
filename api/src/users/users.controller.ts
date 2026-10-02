import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/auth.guard';
import { ApiError } from '../common/api-error';
import { intParam } from '../common/cursor-page';
import { Database } from '../db/database';

/** 작성자 프로필: 닉네임 · 가입일 · 쓴 글 / 댓글 수 (이메일 같은 개인 정보는 주지 않는다) */
@Controller()
export class UsersController {
  constructor(private readonly db: Database) {}

  @Public()
  @Get('users/:id')
  async profile(@Param('id') raw: string) {
    const id = intParam(raw);
    const user =
      id === undefined
        ? undefined
        : await this.db.one<{ id: number; nickname: string; createdAt: Date; postCount: string; commentCount: string }>(
            `SELECT u.id, u.nickname, u.created_at AS "createdAt",
                    (SELECT count(*) FROM posts WHERE author_id = u.id) AS "postCount",
                    (SELECT count(*) FROM comments WHERE author_id = u.id) AS "commentCount"
             FROM users u WHERE u.id = $1`,
            [id],
          );
    if (!user) throw ApiError.notFound('없는 사용자예요');
    return { ...user, postCount: Number(user.postCount), commentCount: Number(user.commentCount) };
  }
}
