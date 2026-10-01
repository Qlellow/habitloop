import { createHash } from 'node:crypto';
import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, LoginUser, Public } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { ApiError } from '../common/api-error';
import { intParam } from '../common/cursor-page';
import { CommentsService } from './comments.service';
import { CommentInput, CreatePostInput, UpdatePostInput } from './posts.dto';
import { PostsService } from './posts.service';

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
  list(@Query() query: Record<string, string | undefined>) {
    return this.posts.list(
      {
        channel: query.channel?.trim() || undefined,
        category: intParam(query.category),
        authorId: intParam(query.authorId),
        q: query.q,
      },
      intParam(query.cursor),
      intParam(query.size) ?? 20,
    );
  }

  @Public()
  @Get('posts/popular')
  @Header('Cache-Control', 'public, max-age=30')
  popular(@Query('channel') channel?: string) {
    return this.posts.popular(channel?.trim() || undefined);
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
  like(@LoginUser() user: AuthUser, @Param('id') postId: string) {
    return this.posts.like(user.id, id(postId));
  }

  @Delete('posts/:id/like')
  unlike(@LoginUser() user: AuthUser, @Param('id') postId: string) {
    return this.posts.unlike(user.id, id(postId));
  }

  /* ───── 댓글 ───── */

  @Public()
  @Get('posts/:id/comments')
  commentList(
    @Param('id') postId: string,
    @Query('cursor') cursor: string | undefined,
    @Query('size') size: string | undefined,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.comments.list(id(postId), intParam(cursor), intParam(size) ?? 30, user?.id);
  }

  @Public()
  @Get('posts/:id/comments/best')
  best(@Param('id') postId: string, @CurrentUser() user?: AuthUser) {
    return this.comments.best(id(postId), user?.id);
  }

  @Post('posts/:id/comments')
  addComment(@LoginUser() user: AuthUser, @Param('id') postId: string, @Body() input: CommentInput) {
    return this.comments.create(user.id, id(postId), input.content);
  }

  @Delete('posts/:id/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeComment(@LoginUser() user: AuthUser, @Param('id') postId: string, @Param('commentId') commentId: string) {
    return this.comments.remove(user.id, id(postId), id(commentId));
  }

  @Post('posts/:id/comments/:commentId/like')
  @HttpCode(HttpStatus.OK)
  likeComment(@LoginUser() user: AuthUser, @Param('id') postId: string, @Param('commentId') commentId: string) {
    return this.comments.like(user.id, id(postId), id(commentId));
  }

  @Delete('posts/:id/comments/:commentId/like')
  unlikeComment(@LoginUser() user: AuthUser, @Param('id') postId: string, @Param('commentId') commentId: string) {
    return this.comments.unlike(user.id, id(postId), id(commentId));
  }
}
