import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { siteUrl } from '../auth/oauth.controller';
import { makeExcerpt } from './excerpt';
import { PostsService } from './posts.service';

/**
 * 링크 미리보기 카드 (카카오톡 · 디스코드 · X · 검색엔진): 웹은 SPA 라 어느 글 주소든 index.html 의 사이트 기본 카드만 보인다.
 * 미리보기 봇이 /posts/{번호} 를 열면 (Vercel 은 vercel.json, Docker 는 nginx.conf 가 User-Agent 로 골라 이리 보낸다)
 * 그 글의 제목 · 요약 · 첫 이미지를 담은 작은 HTML 을 돌려준다. 사람은 이 경로로 오지 않는다.
 * 볼 수 없는 글(비공개 · 19세 이상 · 숨김 · 없는 글)은 사이트 기본 카드로.
 */
const PATH = /^\/posts\/(\d+)\/?$/;
const DEFAULT_IMAGE = '/og-v2.png';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 본문의 첫 이미지 (마크다운 ![](주소)). 업로드 이미지(/api/images/…)는 사이트 주소를 붙인다 */
function firstImage(content: string, site: string): string | undefined {
  const src = content.match(/!\[[^\]]*]\(\s*<?([^)\s>]+)/)?.[1];
  if (!src) return undefined;
  if (src.startsWith('/') && !src.startsWith('//')) return site + src;
  return /^https:\/\//.test(src) ? src : undefined;
}

export function renderPreview(site: string, path: string, card?: { title: string; description: string; image?: string }) {
  const title = card ? `${card.title} · 루프` : '루프 · 좋아하는 이야기로 이어지는 곳';
  const description = card?.description || '관심사 채널을 팔로우하고, 글을 쓰고, 공감을 나눠 보세요';
  const image = card?.image ?? site + DEFAULT_IMAGE;
  const url = site + path;
  const meta = [
    ['og:type', card ? 'article' : 'website'],
    ['og:site_name', '루프'],
    ['og:title', title],
    ['og:description', description],
    ['og:image', image],
    ['og:url', url],
  ];
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}" />
${meta.map(([k, v]) => `<meta property="${k}" content="${escape(v)}" />`).join('\n')}
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${escape(url)}" />
</head>
<body>
<h1>${escape(title)}</h1>
<p>${escape(description)}</p>
<a href="${escape(url)}">루프에서 보기</a>
</body>
</html>`;
}

export function installPostPreview(app: INestApplication) {
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const m = req.method === 'GET' ? req.path.match(PATH) : null;
    if (!m) return next();
    const site = siteUrl(req);
    const path = `/posts/${m[1]}`;
    let card: { title: string; description: string; image?: string } | undefined;
    try {
      // 비로그인으로 본다 (조회수는 세지 않는다)
      const post = await app.get(PostsService).detail(Number(m[1]));
      if (!post.hidden) {
        card = {
          title: post.title,
          description: `${post.channel.name} · ${makeExcerpt(post.content, 110)}`,
          image: firstImage(post.content, site),
        };
      }
    } catch {
      // 볼 수 없거나 없는 글 → 기본 카드
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.type('html').send(renderPreview(site, path, card));
  });
}
