import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { LoginUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { ApiError } from '../common/api-error';
import { intParam } from '../common/cursor-page';
import { PostsService } from '../posts/posts.service';
import { ReportActionInput, ReportInput } from './reports.dto';
import { ReportsService } from './reports.service';

const id = (value: string) => {
  const n = intParam(value);
  if (n === undefined) throw ApiError.badRequest('잘못된 요청이에요');
  return n;
};

@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly posts: PostsService,
  ) {}

  /** 글 신고 (볼 수 있는 글만) */
  @Post('posts/:id/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reportPost(@LoginUser() user: AuthUser, @Param('id') postId: string, @Body() input: ReportInput) {
    await this.posts.requirePostAccess(id(postId), user.id);
    await this.reports.report(user.id, id(postId), undefined, input.reason, input.detail);
  }

  /** 댓글 신고 */
  @Post('posts/:id/comments/:commentId/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reportComment(@LoginUser() user: AuthUser, @Param('id') postId: string, @Param('commentId') commentId: string, @Body() input: ReportInput) {
    await this.posts.requirePostAccess(id(postId), user.id);
    await this.reports.report(user.id, id(postId), id(commentId), input.reason, input.detail);
  }

  /** 채널 신고함 (운영진만): ?status=open(처리 전, 기본) | done(처리한 것) */
  @Get('channels/:slug/reports')
  list(@LoginUser() user: AuthUser, @Param('slug') slug: string, @Query('status') status?: string) {
    return this.reports.list(slug, user.id, status === 'done' ? 'done' : 'open');
  }

  /** 신고 처리: 숨기기 · 숨김 풀기 · 지우기 · 문제 없음 */
  @Post('channels/:slug/reports/action')
  @HttpCode(HttpStatus.NO_CONTENT)
  act(@LoginUser() user: AuthUser, @Param('slug') slug: string, @Body() input: ReportActionInput) {
    return this.reports.act(slug, user.id, input.postId, input.commentId, input.action);
  }
}
