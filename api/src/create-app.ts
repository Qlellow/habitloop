import 'reflect-metadata';
import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import { MAX_IMAGE_BYTES } from './images/images.service';
import { installPostPreview } from './posts/post-preview';
import { installSeo } from './common/seo';
import { installAppLinks } from './common/app-links';

/**
 * 앱 설정을 한곳에: 서버(main.ts) · 테스트가 같은 설정을 쓴다.
 * 모든 API 는 /api 아래에 있다 (Vercel 이 /api/* 를 이 서비스로 보낸다).
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: process.env.NODE_ENV === 'test' ? ['error', 'warn'] : undefined,
  });
  app.setGlobalPrefix('api');

  // JSON 본문 (글은 2만 자까지라 넉넉히) + 프로필·본문 이미지 바이트
  app.use(express.json({ limit: '1mb' }));
  // 크기(프로필 512KB, 본문 3MB)는 각 서비스가 확인해서 알아듣기 쉬운 메시지로 돌려준다
  app.use(express.raw({ type: ['image/*'], limit: MAX_IMAGE_BYTES + 512 * 1024 }));
  // null 필드는 응답에서 뺀다 (예전 Spring 응답과 같은 모양)
  app.getHttpAdapter().getInstance().set('json replacer', (_key: string, value: unknown) => (value === null ? undefined : value));
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  // 링크 미리보기 봇이 여는 /posts/{번호} (api 접두어 밖): 글 제목 · 요약 카드
  installPostPreview(app);
  // 검색엔진용 /robots.txt · /sitemap.xml
  installSeo(app);
  // 웹 링크를 앱으로 여는 확인 파일 /.well-known/assetlinks.json · apple-app-site-association
  installAppLinks(app);

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Viewer'],
    maxAge: 3600, // preflight 결과 캐시
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      // 첫 번째 오류 메시지 하나만 { message } 로 돌려준다
      exceptionFactory: (errors) => {
        const first = errors[0];
        const message = first?.constraints ? Object.values(first.constraints)[0] : '입력값을 확인해 주세요';
        return new BadRequestException({ message });
      },
    }),
  );
  app.enableShutdownHooks();
  await app.init();
  return app;
}
