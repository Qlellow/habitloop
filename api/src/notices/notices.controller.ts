import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../auth/auth.guard';
import { ApiError } from '../common/api-error';
import { intParam } from '../common/cursor-page';
import { NOTICE_KINDS, NoticesService, type NoticeKind } from './notices.service';

/** 사이트 공지사항 (누구나 본다). 쓰기 · 고치기 · 지우기는 관리자 API (/api/admin/notices) */
@Public()
@Controller('notices')
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get()
  list(@Query('kind') kind?: string, @Query('cursor') cursor?: string, @Query('size') size?: string) {
    const k = (NOTICE_KINDS as readonly string[]).includes(kind ?? '') ? (kind as NoticeKind) : undefined;
    return this.notices.list(k, intParam(cursor), intParam(size) ?? 20);
  }

  @Get('latest')
  latest() {
    return this.notices.latest();
  }

  @Get(':id')
  get(@Param('id') raw: string) {
    const id = intParam(raw);
    if (id == null || id < 1) throw ApiError.notFound('없는 공지예요');
    return this.notices.get(id);
  }
}
