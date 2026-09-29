import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { isConstraintViolation } from '../db/database';

/**
 * 모든 오류를 { message } 로 바꾼다.
 * - 동시에 두 번 눌러 unique 제약에 걸리면 409 "이미 처리된 요청이에요"
 * - 예상하지 못한 오류는 로그만 남기고 500
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('Error');

  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const body = error.getResponse();
      let message = typeof body === 'object' && body && 'message' in body ? (body as { message: unknown }).message : body;
      if (Array.isArray(message)) message = message[0];
      if (status === HttpStatus.NOT_FOUND && typeof message === 'string' && message.startsWith('Cannot ')) message = '찾을 수 없어요';
      if (status === HttpStatus.BAD_REQUEST && typeof message === 'string' && /JSON|Unexpected token/i.test(message)) message = '잘못된 요청이에요';
      if (status === HttpStatus.PAYLOAD_TOO_LARGE) message = '요청이 너무 커요';
      res.status(status).json({ message: typeof message === 'string' ? message : '잘못된 요청이에요' });
      return;
    }
    // body-parser 오류 (깨진 JSON, 너무 큰 본문)
    const parseStatus = (error as { status?: number; type?: string })?.status;
    if (parseStatus === 400 || parseStatus === 413) {
      res.status(parseStatus).json({ message: parseStatus === 413 ? '요청이 너무 커요' : '잘못된 요청이에요' });
      return;
    }
    if (isConstraintViolation(error)) {
      res.status(HttpStatus.CONFLICT).json({ message: '이미 처리된 요청이에요' });
      return;
    }
    this.log.error(error instanceof Error ? error.stack : String(error));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: '잠시 후 다시 시도해 주세요' });
  }
}
