import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/auth.guard';
import { ApiError } from '../common/api-error';
import { intParam } from '../common/cursor-page';
import { AdminLoginCodeInput, AdminLoginInput, AdminReportActionInput, NoticeInputDto, SuspendInput } from './admin.dto';
import { AdminGuard, AdminLogin, CurrentAdmin, type AdminUser } from './admin.guard';
import { AdminService } from './admin.service';
import { ClientErrorsService } from '../client-errors/client-errors.service';

const noticeId = (raw: string) => {
  const n = intParam(raw);
  if (n == null || n < 1) throw ApiError.notFound('없는 공지예요');
  return n;
};

const ipOf = (req: Request) => String(req.header('x-forwarded-for') ?? req.socket.remoteAddress ?? '').split(',')[0].trim();

/**
 * 사이트 관리자 API. 일반 로그인과 완전히 따로다.
 * - 모든 요청에 X-Admin-Key(=ADMIN_KEY) 가 있어야 하고, 틀리면 '없는 주소'처럼 404
 * - 로그인: ADMIN_EMAIL · ADMIN_PASSWORD (회원 계정과 따로) + 매번 그 이메일로 받은 인증번호 → 2시간짜리 관리자 토큰
 * 일반 사용자 토큰 검사는 건너뛰고(@Public) AdminGuard 가 따로 확인한다
 */
@Public()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly errors: ClientErrorsService,
  ) {}

  /** 관리자 주소가 맞는지 (맞으면 204, 아니면 가드가 404) */
  @AdminLogin()
  @Get('gate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  gate() {}

  @AdminLogin()
  @Post('login/code')
  @HttpCode(HttpStatus.NO_CONTENT)
  sendCode(@Body() input: AdminLoginCodeInput, @Req() req: Request) {
    return this.admin.sendLoginCode(input.email, input.password, ipOf(req));
  }

  @AdminLogin()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  login(@Body() input: AdminLoginInput, @Req() req: Request) {
    return this.admin.login(input.email, input.password, input.code, ipOf(req));
  }

  @Get('me')
  me(@CurrentAdmin() admin: AdminUser) {
    return { email: admin.email };
  }

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('reports')
  reports(@Query('status') status?: string) {
    return this.admin.reports(status === 'done' ? 'done' : 'open');
  }

  @Post('reports/action')
  @HttpCode(HttpStatus.NO_CONTENT)
  reportAction(@Body() input: AdminReportActionInput) {
    return this.admin.reportAction(input.postId, input.commentId, input.action);
  }

  @Get('users')
  users(@Query('q') q?: string, @Query('cursor') cursor?: string) {
    return this.admin.users(q?.slice(0, 50), intParam(cursor));
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  suspend(@Param('id') id: string, @Body() input: SuspendInput) {
    return this.admin.suspend(id, input.suspend);
  }

  @Get('channels')
  channels(@Query('q') q?: string) {
    return this.admin.channelList(q?.slice(0, 50));
  }

  /* ───── 사이트 공지사항 (업데이트 소식 · 공지 · 이벤트 · 점검) ───── */

  @Post('notices')
  createNotice(@Body() input: NoticeInputDto) {
    return this.admin.createNotice(input);
  }

  @Put('notices/:id')
  updateNotice(@Param('id') id: string, @Body() input: NoticeInputDto) {
    return this.admin.updateNotice(noticeId(id), input);
  }

  @Delete('notices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeNotice(@Param('id') id: string) {
    return this.admin.removeNotice(noticeId(id));
  }

  /* ───── 사용자 화면 오류 ───── */

  @Get('errors')
  clientErrors() {
    return this.errors.list();
  }

  @Delete('errors/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  resolveError(@Param('id') id: string) {
    return this.errors.resolve(id.slice(0, 40));
  }

  @Get('logs')
  logs() {
    return this.admin.logs();
  }
}
