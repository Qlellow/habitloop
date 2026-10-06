import { createHash } from 'node:crypto';
import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, LoginUser, Public } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { ApiError } from '../common/api-error';
import { intParam } from '../common/cursor-page';
import { CommentsService } from './comments.service';
import { CommentInput, CommentUpdateInput, CreatePostInput, UpdatePostInput } from './posts.dto';
import { PostsService, SORTS, type PostSort } from './posts.service';

/** UUID 모양인지 (사용자 id) */
export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const id = (value: string) => {
  const n = intParam(value);
  if (n === undefined) throw ApiError.badRequest('잘못된 요청이에요');
  return n;
};

/**
 * 조회수를 한 번만 세기 위한 "본 사람" 값.
 * 로그인: 계정 / 비로그인: 웹·앱이 처음 실행할 때 만들어 저장해 둔 X-Viewer 값 / 그것도 없으면 IP + User-Agent 해시
 */
function viewerKey(user: AuthUser | undefined, req: Request): string {
  if (user) return `u:${user.id}`;
  const anon = req.header('x-viewer');
  if (anon && /^[A-Za-z0-9_-]{8,40}$/.test(anon)) return `a:${anon}`;
  const ip = String(req.header('x-forwarded-for') ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
  return `h:${createHash('sha256').update(`${ip}|${req.header('user-agent') ?? ''}`).digest('base64url').slice(0, 32)}`;
}

@Controller()
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly comments: CommentsService,
  ) {}

  @Public()
  @Get('posts')
  list(@Query() query: Record<string, string | undefined>, @CurrentUser() user?: AuthUser) {
    return this.posts.list(
      {
        channel: query.channel?.trim() || undefined,
        category: intParam(query.category),
        authorId: isUuid(query.authorId) ? query.authorId : query.authorId ? '00000000-0000-0000-0000-000000000000' : undefined,
        q: query.q,
      },
      intParam(query.cursor),
      intParam(query.size) ?? 20,
      user?.id,
    );
  }

  /** 채널 글 목록 (번호 페이지 · 검색 · 정렬) */
  @Public()
  @Get('posts/page')
  page(@Query() query: Record<string, string | undefined>, @CurrentUser() user?: AuthUser) {
    const channel = query.channel?.trim();
    if (!channel) throw ApiError.badRequest('채널을 알려 주세요');
    const sort = (query.sort && query.sort in SORTS ? query.sort : 'latest') as PostSort;
    return this.posts.page(
      {
        channel,
        category: intParam(query.category),
        q: query.q?.slice(0, 50),
        sort,
        excludeNotices: query.excludeNotices === 'true',
      },
      intParam(query.page) ?? 1,
      intParam(query.size) ?? 20,
      user?.id,
    );
  }

  /** 채널 공지 (전체 탭 위에 고정) */
  @Public()
  @Get('posts/notices')
  notices(@Query('channel') channel = '', @CurrentUser() user?: AuthUser) {
    return this.posts.notices(channel.trim(), user?.id);
  }

  @Public()
  @Get('posts/popular')
  // 비공개 채널 인기글이 공용 캐시에 남지 않게 private
  @Header('Cache-Control', 'private, max-age=30')
  async popular(@Query('channel') channel: string | undefined, @CurrentUser() user?: AuthUser) {
    const slug = channel?.trim() || undefined;
    if (slug) await this.posts.requireChannelAccess(slug, user?.id);
    return this.posts.popular(slug);
  }

  @Public()
  @Get('posts/:id')
  detail(@Param('id') postId: string, @CurrentUser() user: AuthUser | undefined, @Req() req: Request) {
    return this.posts.detail(id(postId), user?.id, viewerKey(user, req));
  }

  @Post('posts')
  create(@LoginUser() user: AuthUser, @Body() input: CreatePostInput) {
    return this.posts.create(user.id, input);
  }

  @Put('posts/:id')
  update(@LoginUser() user: AuthUser, @Param('id') postId: string, @Body() input: UpdatePostInput) {
    return this.posts.update(user.id, id(postId), input);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@LoginUser() user: AuthUser, @Param('id') postId: string) {
    return this.posts.remove(user.id, id(postId));
  }

  @Post('posts/:id/like')
  @HttpCode(HttpStatus.OK)
  async like(@LoginUser() user: AuthUser, @Param('id') postId: string) {
    await this.posts.requirePostAccess(id(postId), user.id);
    return this.posts.like(user.id, id(postId));
  }

  @Delete('posts/:id/like')
  unlike(@LoginUser() user: AuthUser, @Param('id') postId: string) {
    return this.posts.unlike(user.id, id(postId));
  }

  /* ───── 댓글 ───── */

  @Public()
  @Get('posts/:id/comments')
  async commentList(
    @Param('id') postId: string,
    @Query('cursor') cursor: string | undefined,
    @Query('size') size: string | undefined,
    @CurrentUser() user?: AuthUser,
  ) {
    await this.posts.requirePostAccess(id(postId), user?.id);
    return this.comments.list(id(postId), intParam(cursor), intParam(size) ?? 30, user?.id);
  }

  @Public()
  @Get('posts/:id/comments/best')
  async best(@Param('id') postId: string, @CurrentUser() user?: AuthUser) {
    await this.posts.requirePostAccess(id(postId), user?.id);
    return this.comments.best(id(postId), user?.id);
  }

  @Post('posts/:id/comments')
  async addComment(@LoginUser() user: AuthUser, @Param('id') postId: string, @Body() input: CommentInput) {
    await this.posts.requirePostAccess(id(postId), user.id);
    return this.comments.create(user.id, id(postId), input.content, input.parentId);
  }

  @Put('posts/:id/comments/:commentId')
  async updateComment(@LoginUser() user: AuthUser, @Param('id') postId: string, @Param('commentId') commentId: string, @Body() input: CommentUpdateInput) {
    await this.posts.requirePostAccess(id(postId), user.id);
    return this.comments.update(user.id, id(postId), id(commentId), input.content);
  }

  @Delete('posts/:id/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeComment(@LoginUser() user: AuthUser, @Param('id') postId: string, @Param('commentId') commentId: string) {
    return this.comments.remove(user.id, id(postId), id(commentId));
  }

  @Post('posts/:id/comments/:commentId/like')
  @HttpCode(HttpStatus.OK)
  async likeComment(@LoginUser() user: AuthUser, @Param('id') postId: string, @Param('commentId') commentId: string) {
    await this.posts.requirePostAccess(id(postId), user.id);
    return this.comments.like(user.id, id(postId), id(commentId));
  }

  @Delete('posts/:id/comments/:commentId/like')
  unlikeComment(@LoginUser() user: AuthUser, @Param('id') postId: string, @Param('commentId') commentId: string) {
    return this.comments.unlike(user.id, id(postId), id(commentId));
  }
}
