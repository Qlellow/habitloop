import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/auth.guard';
import { ClientErrorsService, type ClientErrorInput } from './client-errors.service';

/** 사용자 화면에서 난 오류 보고 (로그인 없이도). 응답은 늘 204 */
@Controller()
export class ClientErrorsController {
  constructor(private readonly errors: ClientErrorsService) {}

  @Public()
  @Post('client-errors')
  @HttpCode(HttpStatus.NO_CONTENT)
  async report(@Body() body: ClientErrorInput, @Req() req: Request) {
    const ip = String(req.header('x-forwarded-for') ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
    await this.errors.report(ip, body ?? {}, String(req.header('user-agent') ?? '')).catch(() => undefined);
  }
}
