import { HttpException, HttpStatus } from '@nestjs/common';

/** 응답 본문은 항상 { message } 하나 (웹·앱이 그대로 보여 준다) */
export class ApiError extends HttpException {
  constructor(status: HttpStatus, message: string) {
    super({ message }, status);
  }

  static badRequest(message: string) {
    return new ApiError(HttpStatus.BAD_REQUEST, message);
  }

  static unauthorized(message = '로그인이 필요해요') {
    return new ApiError(HttpStatus.UNAUTHORIZED, message);
  }

  static forbidden(message = '권한이 없어요') {
    return new ApiError(HttpStatus.FORBIDDEN, message);
  }

  static notFound(message: string) {
    return new ApiError(HttpStatus.NOT_FOUND, message);
  }

  static conflict(message: string) {
    return new ApiError(HttpStatus.CONFLICT, message);
  }

  static tooMany(message: string) {
    return new ApiError(HttpStatus.TOO_MANY_REQUESTS, message);
  }
}
