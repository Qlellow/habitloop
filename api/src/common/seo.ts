import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { siteUrl } from '../auth/oauth.controller';
import { Database } from '../db/database';

/**
 * 검색엔진용 /robots.txt · /sitemap.xml (api 접두어 밖. Vercel 은 vercel.json, Docker 는 nginx.conf 가 이리 보낸다).
 * 사이트 주소가 배포마다 달라서 정적 파일 대신 요청 주소(SITE_URL)로 만든다.
 * 사이트맵에는 누구나 볼 수 있는 것만: 공개 · 19세 미만 채널, 그 채널의 숨기지 않은 글(19세 카테고리 제외), 공지
 */
const SITEMAP_POSTS = 5000;

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const day = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

export function robotsTxt(site: string) {
  return [
    'User-agent: *',
    'Allow: /',
    // 로그인해야 쓰는 화면 · API 는 수집하지 않는다
    'Disallow: /api/',
    'Disallow: /me',
    'Disallow: /write',
    'Disallow: /login',
    'Disallow: /signup',
    'Disallow: /password/',
    'Disallow: /oauth/',
    'Disallow: /invite/',
    '',
    `Sitemap: ${site}/sitemap.xml`,
    '',
  ].join('\n');
}

async function sitemapXml(db: Database, site: string) {
  const [channels, posts, notices] = await Promise.all([
    db.query<{ slug: string }>("SELECT slug FROM channels WHERE visibility = 'public' AND NOT adult ORDER BY id"),
    db.query<{ id: number; at: string }>(
      `SELECT p.id, COALESCE(p.updated_at, p.created_at) AS at
       FROM posts p JOIN channels c ON c.id = p.channel_id LEFT JOIN channel_categories cat ON cat.id = p.category_id
       WHERE c.visibility = 'public' AND NOT c.adult AND cat.adult IS NOT TRUE AND p.hidden_at IS NULL
       ORDER BY p.id DESC LIMIT ${SITEMAP_POSTS}`,
    ),
    db.query<{ id: number; at: string }>('SELECT id, COALESCE(updated_at, created_at) AS at FROM site_notices ORDER BY id DESC'),
  ]);
  const url = (path: string, lastmod?: string) =>
    `  <url><loc>${xmlEscape(site + path)}</loc>${lastmod ? `<lastmod>${day(lastmod)}</lastmod>` : ''}</url>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    url('/'),
    url('/channels'),
    url('/notices'),
    ...channels.map((c) => url(`/c/${encodeURIComponent(c.slug)}`)),
    ...posts.map((p) => url(`/posts/${p.id}`, p.at)),
    ...notices.map((n) => url(`/notices/${n.id}`, n.at)),
    '</urlset>',
    '',
  ].join('\n');
}

export function installSeo(app: INestApplication) {
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || (req.path !== '/robots.txt' && req.path !== '/sitemap.xml')) return next();
    const site = siteUrl(req);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (req.path === '/robots.txt') return void res.type('text/plain').send(robotsTxt(site));
    try {
      res.type('application/xml').send(await sitemapXml(app.get(Database), site));
    } catch (e) {
      next(e);
    }
  });
}
