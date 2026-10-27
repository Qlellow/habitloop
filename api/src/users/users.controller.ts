import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, LoginUser, Public } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { ApiError } from '../common/api-error';
import { escapeLike } from '../common/cursor-page';
import { Database } from '../db/database';
import { BlocksService } from './blocks.service';
import { RewardsService } from './rewards.service';
import { featuredBadge } from '../badges/catalog';
import { PetsService } from '../pets/pets.service';
import { DnaService } from './dna.service';
import { parseHomeLayout, type HomeLayout } from './home-layout';

/** 작성자 프로필: 닉네임 · 가입일 · 쓴 글 / 댓글 수 · 배지 (이메일 같은 개인 정보는 주지 않는다) */
@Controller()
export class UsersController {
  constructor(
    private readonly db: Database,
    private readonly rewards: RewardsService,
    private readonly blocks: BlocksService,
    private readonly pets: PetsService,
    private readonly dna: DnaService,
  ) {}

  /** 닉네임으로 사용자 찾기 (커맨드 팔레트). 앞부분이 맞는 사람부터, 공개 정보만 */
  @Public()
  @Get('users')
  search(@Query('q') q: string | undefined) {
    const keyword = (q ?? '').trim().toLowerCase().slice(0, 30);
    if (!keyword) return [];
    return this.db.query(
      `SELECT u.uid::text AS id, u.nickname,
              CASE WHEN u.avatar_id IS NULL THEN NULL ELSE '/api/images/' || u.avatar_id END AS "avatarUrl"
       FROM users u
       WHERE u.withdrawn_at IS NULL AND u.suspended_at IS NULL AND lower(u.nickname) LIKE $1 ESCAPE '\\'
       ORDER BY (lower(u.nickname) LIKE $2 ESCAPE '\\') DESC, length(u.nickname), u.id
       LIMIT 8`,
      [`%${escapeLike(keyword)}%`, `${escapeLike(keyword)}%`],
    );
  }

  @Public()
  @Get('users/:id')
  async profile(@Param('id') raw: string, @CurrentUser() viewer?: AuthUser) {
    const user:
      | { internalId: number; id: string; nickname: string; createdAt: Date; postCount: string; commentCount: string; featuredBadge: string | null }
      | undefined =
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)
        ? undefined
        : await this.db.one(
            `SELECT u.id AS "internalId", u.uid::text AS id, u.nickname, u.created_at AS "createdAt", u.banner, u.featured_badge AS "featuredBadge",
                    CASE WHEN u.avatar_id IS NULL THEN NULL ELSE '/api/images/' || u.avatar_id END AS "avatarUrl",
                    (SELECT count(*) FROM posts WHERE author_id = u.id) AS "postCount",
                    (SELECT count(*) FROM comments WHERE author_id = u.id) AS "commentCount"
             FROM users u WHERE u.uid::text = $1 AND u.withdrawn_at IS NULL`,
            [raw.toLowerCase()],
          );
    if (!user) throw ApiError.notFound('없는 사용자예요');
    const { internalId, ...rest } = user;
    const [badges, blocked, pet] = await Promise.all([
      this.rewards.badges(internalId),
      this.blocks.isBlocked(viewer?.id, internalId),
      this.pets.shownOf(internalId),
    ]);
    return {
      ...rest,
      postCount: Number(user.postCount),
      commentCount: Number(user.commentCount),
      featuredBadge: featuredBadge(user.featuredBadge),
      badges,
      /** 내가 이 사람을 차단했는지 (비로그인 · 내 프로필은 false) */
      blocked,
      /** 프로필에 전시한 펫 */
      pet,
    };
  }

  /** 사용자 차단 · 해제 (상대에게 알리지 않는다) */
  /** 활동 DNA: 언제 · 어디서 · 어떻게 활동했는지로 그린 커뮤니티 성향 (공개 채널 활동만) */
  @Public()
  @Get('users/:id/dna')
  activityDna(@Param('id') raw: string) {
    return this.dna.of(raw);
  }

  @Put('users/:id/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  block(@LoginUser() user: AuthUser, @Param('id') id: string) {
    return this.blocks.block(user.id, id);
  }

  @Delete('users/:id/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  unblock(@LoginUser() user: AuthUser, @Param('id') id: string) {
    return this.blocks.unblock(user.id, id);
  }

  /** 나만의 홈: 저장한 위젯 배치 (없으면 기본 홈) */
  @Get('me/home')
  async home(@LoginUser() user: AuthUser) {
    const row = await this.db.one<{ layout: HomeLayout | null }>('SELECT home_layout AS layout FROM users WHERE id = $1', [user.id]);
    return { layout: row?.layout ?? null };
  }

  @Put('me/home')
  async saveHome(@LoginUser() user: AuthUser, @Body() body: { layout?: unknown }) {
    const layout = parseHomeLayout(body?.layout);
    await this.db.execute('UPDATE users SET home_layout = $2 WHERE id = $1', [user.id, JSON.stringify(layout)]);
    await this.rewards.checkBadges(user.id);
    return { layout };
  }

  /** 기본 홈으로 되돌리기 */
  @Delete('me/home')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetHome(@LoginUser() user: AuthUser) {
    await this.db.execute('UPDATE users SET home_layout = NULL WHERE id = $1', [user.id]);
  }

  /** 내가 차단한 사용자 (설정) */
  @Get('me/blocks')
  myBlocks(@LoginUser() user: AuthUser) {
    return this.blocks.list(user.id);
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
