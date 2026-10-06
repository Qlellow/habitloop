import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser, LoginUser, Public } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { ApiError } from '../common/api-error';
import { intParam } from '../common/cursor-page';
import { CategoriesService } from './categories.service';
import { CategoryInput, CategoryOrderInput, ChannelInput, ChannelUpdateInput, InviteJoinInput, RoleInput } from './channels.dto';
import { ChannelsService } from './channels.service';
import { IconsService } from './icons.service';
import { MembershipService } from './membership.service';
import { PreviewsService } from './previews.service';
import { StaffService } from './staff.service';

const id = (value: string) => {
  const n = intParam(value);
  if (n === undefined) throw ApiError.badRequest('잘못된 요청이에요');
  return n;
};

@Controller()
export class ChannelsController {
  constructor(
    private readonly channels: ChannelsService,
    private readonly previews: PreviewsService,
    private readonly membership: MembershipService,
    private readonly staff: StaffService,
    private readonly icons: IconsService,
    private readonly categories: CategoriesService,
  ) {}

  /** q 가 없으면 인기 채널, 있으면 채널 이름 검색 */
  @Public()
  @Get('channels')
  async list(@Query('q') q: string | undefined, @CurrentUser() user?: AuthUser) {
    const adult = await this.channels.isAdult(user?.id);
    return q?.trim() ? this.channels.search(q, adult) : this.channels.popular(adult);
  }

  /** 채널 목록 페이지용: 채널마다 최근 글 size 개(최대 8)를 함께 돌려준다 */
  @Public()
  @Get('channels/previews')
  previewList(@Query('q') q: string | undefined, @Query('size') size: string | undefined, @CurrentUser() user?: AuthUser) {
    return this.previews.previews(q, intParam(size) ?? 8, user?.id);
  }

  @Public()
  @Get('channels/:slug')
  detail(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.channels.detail(slug, user?.id);
  }

  @Post('channels')
  create(@LoginUser() user: AuthUser, @Body() input: ChannelInput) {
    return this.channels.create(user.id, input);
  }

  @Put('channels/:slug')
  update(@LoginUser() user: AuthUser, @Param('slug') slug: string, @Body() input: ChannelUpdateInput) {
    return this.channels.update(user.id, slug, input);
  }

  /* ───── 가입 · 북마크 ───── */

  /** 채널 가입 (이미 가입했으면 그대로) */
  @Post('channels/:slug/members')
  @HttpCode(HttpStatus.OK)
  join(@LoginUser() user: AuthUser, @Param('slug') slug: string, @Body() input: InviteJoinInput) {
    return this.membership.join(user.id, slug, input?.code);
  }

  /* ───── 초대 (비공개 채널) ───── */

  /** 초대 링크 · 코드 · QR 로 들어온 화면: 채널 이름과 프로필만 보여 준다 */
  @Public()
  @Get('invites/:code')
  async invite(@Param('code') code: string, @CurrentUser() user?: AuthUser) {
    const c = await this.channels.byInvite(code);
    const joined = !!(await this.channels.roleOf(c.id, user?.id));
    return { slug: c.slug, name: c.name, iconVersion: c.iconVersion, color: c.color, memberCount: c.memberCount, adult: c.adult, joined };
  }

  /** 초대 코드로 팔로우 */
  @Post('invites/:code')
  @HttpCode(HttpStatus.OK)
  async acceptInvite(@LoginUser() user: AuthUser, @Param('code') code: string) {
    const c = await this.channels.byInvite(code);
    await this.membership.join(user.id, c.slug, code);
    return { slug: c.slug };
  }

  /** 초대 코드 새로 만들기 (소유자·관리자). 예전 링크·코드·QR 은 막힌다 */
  @Post('channels/:slug/invite')
  @HttpCode(HttpStatus.OK)
  regenerateInvite(@LoginUser() user: AuthUser, @Param('slug') slug: string) {
    return this.channels.regenerateInvite(user.id, slug);
  }

  /** 채널 탈퇴 (만든 사람은 탈퇴할 수 없다) */
  @Delete('channels/:slug/members/me')
  leave(@LoginUser() user: AuthUser, @Param('slug') slug: string) {
    return this.membership.leave(user.id, slug);
  }

  @Put('channels/:slug/bookmark')
  bookmark(@LoginUser() user: AuthUser, @Param('slug') slug: string) {
    return this.membership.bookmark(user.id, slug, true);
  }

  @Delete('channels/:slug/bookmark')
  unbookmark(@LoginUser() user: AuthUser, @Param('slug') slug: string) {
    return this.membership.bookmark(user.id, slug, false);
  }

  /** 내가 북마크한 채널 */
  @Get('me/bookmarks/channels')
  bookmarked(@LoginUser() user: AuthUser) {
    return this.membership.bookmarkedChannels(user.id);
  }

  /** 내가 가입한 채널 */
  @Get('me/channels')
  mine(@LoginUser() user: AuthUser) {
    return this.membership.myChannels(user.id);
  }

  /* ───── 운영진 ───── */

  /** 운영진 목록 (누구나 볼 수 있다) */
  @Public()
  @Get('channels/:slug/staff')
  staffList(@Param('slug') slug: string) {
    return this.staff.staff(slug);
  }

  /** 운영진으로 지정할 멤버를 닉네임으로 찾기 (소유자만) */
  @Public()
  @Get('channels/:slug/members')
  searchMembers(@Param('slug') slug: string, @Query('q') q: string | undefined, @CurrentUser() user?: AuthUser) {
    return this.staff.searchMembers(user?.id, slug, q);
  }

  /** 멤버를 관리자·매니저로 지정하거나 일반 멤버로 되돌린다 (소유자만) */
  @Put('channels/:slug/members/:userId/role')
  changeRole(@LoginUser() user: AuthUser, @Param('slug') slug: string, @Param('userId') userId: string, @Body() input: RoleInput) {
    return this.staff.changeRole(user.id, slug, userId, input.role);
  }

  /* ───── 프로필 이미지 ───── */

  /** 주소에 버전(?v=)이 있으면 내용이 바뀌지 않으므로 오래 캐시한다 */
  @Public()
  @Get('channels/:slug/icon')
  async icon(@Param('slug') slug: string, @Query('v') v: string | undefined, @Res() res: Response) {
    const icon = await this.icons.get(slug);
    res
      .status(200)
      .type(icon.contentType)
      .set('Cache-Control', v ? 'public, max-age=31536000, immutable' : 'no-cache')
      .set('X-Content-Type-Options', 'nosniff')
      .send(icon.data);
  }

  /** 이미지 바이트를 그대로 올린다 (Content-Type: image/webp | image/png | image/jpeg) */
  @Put('channels/:slug/icon')
  async uploadIcon(@LoginUser() user: AuthUser, @Param('slug') slug: string, @Headers('content-type') type: string, @Req() req: Request) {
    return { iconVersion: await this.icons.upload(user.id, slug, type, req.body) };
  }

  @Delete('channels/:slug/icon')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeIcon(@LoginUser() user: AuthUser, @Param('slug') slug: string) {
    return this.icons.remove(user.id, slug);
  }

  /* ───── 카테고리 (응답은 바뀐 뒤의 전체 목록) ───── */

  @Post('channels/:slug/categories')
  @HttpCode(HttpStatus.OK)
  createCategory(@LoginUser() user: AuthUser, @Param('slug') slug: string, @Body() input: CategoryInput) {
    return this.categories.create(user.id, slug, input);
  }

  @Put('channels/:slug/categories/order')
  reorderCategories(@LoginUser() user: AuthUser, @Param('slug') slug: string, @Body() input: CategoryOrderInput) {
    return this.categories.reorder(user.id, slug, input.ids);
  }

  @Put('channels/:slug/categories/:categoryId')
  updateCategory(
    @LoginUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('categoryId') categoryId: string,
    @Body() input: CategoryInput,
  ) {
    return this.categories.update(user.id, slug, id(categoryId), input);
  }

  @Delete('channels/:slug/categories/:categoryId')
  removeCategory(@LoginUser() user: AuthUser, @Param('slug') slug: string, @Param('categoryId') categoryId: string) {
    return this.categories.remove(user.id, slug, id(categoryId));
  }
}
