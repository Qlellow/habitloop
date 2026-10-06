import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/auth.guard';
import { ApiError } from '../common/api-error';
import { Database } from '../db/database';

/** 작성자 프로필: 닉네임 · 가입일 · 쓴 글 / 댓글 수 (이메일 같은 개인 정보는 주지 않는다) */
@Controller()
export class UsersController {
  constructor(private readonly db: Database) {}

  @Public()
  @Get('users/:id')
  async profile(@Param('id') raw: string) {
    const user =
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)
        ? undefined
        : await this.db.one<{ id: string; nickname: string; createdAt: Date; postCount: string; commentCount: string }>(
            `SELECT u.uid::text AS id, u.nickname, u.created_at AS "createdAt", u.banner,
                    CASE WHEN u.avatar_id IS NULL THEN NULL ELSE '/api/images/' || u.avatar_id END AS "avatarUrl",
                    (SELECT count(*) FROM posts WHERE author_id = u.id) AS "postCount",
                    (SELECT count(*) FROM comments WHERE author_id = u.id) AS "commentCount"
             FROM users u WHERE u.uid::text = $1`,
            [raw.toLowerCase()],
          );
    if (!user) throw ApiError.notFound('없는 사용자예요');
    return { ...user, postCount: Number(user.postCount), commentCount: Number(user.commentCount) };
  }
}
