import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
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
  detail(@Param('id') postId: string, @CurrentUser() user?: AuthUser) {
    return this.posts.detail(id(postId), user?.id);
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
