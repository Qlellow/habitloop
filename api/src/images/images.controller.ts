import { Controller, Get, Headers, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LoginUser, Public } from '../auth/auth.guard';
import type { AuthUser } from '../auth/jwt.service';
import { ImagesService } from './images.service';

@Controller()
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  /** 본문 이미지 올리기: 이미지 바이트를 그대로 (Content-Type: image/webp | png | jpeg | gif) */
  @Post('images')
  upload(@LoginUser() user: AuthUser, @Headers('content-type') type: string, @Req() req: Request) {
    return this.images.upload(user.id, type, req.body);
  }

  /** 한 번 올린 이미지는 바뀌지 않으므로 오래 캐시한다 */
  @Public()
  @Get('images/:id')
  async get(@Param('id') id: string, @Res() res: Response) {
    const image = await this.images.get(id);
    res
      .status(200)
      .type(image.contentType)
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .set('X-Content-Type-Options', 'nosniff')
      .set('Content-Security-Policy', "default-src 'none'")
      .send(image.data);
  }
}
