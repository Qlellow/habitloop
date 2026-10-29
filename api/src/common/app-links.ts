import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * 웹 링크를 누르면 앱이 깔린 휴대폰에서는 앱으로 열리게 하는 확인 파일 (api 접두어 밖, /.well-known/…).
 * Vercel 은 vercel.json, Docker 는 nginx.conf 가 이리 보낸다. 값이 없으면 404 (그 플랫폼은 브라우저로 열린다)
 *  - 안드로이드 App Links: ANDROID_APP_SHA256 (앱 서명 인증서 SHA-256 지문, 여러 개면 쉼표). 패키지는 ANDROID_PACKAGE (기본 dev.loop.community)
 *  - iOS Universal Links: IOS_APP_ID (팀 ID.번들 ID, 예: ABCDE12345.dev.loop.community)
 * 앱에서 열 주소: 글 · 채널 · 프로필 · 공지 · 초대 (mobile/app.json 의 intentFilters · associatedDomains 와 같게)
 */
export const APP_LINK_PATHS = ['/posts/*', '/c/*', '/u/*', '/notices/*', '/invite/*'];

const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export function assetLinks() {
  const fingerprints = list(process.env.ANDROID_APP_SHA256);
  if (!fingerprints.length) return null;
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: process.env.ANDROID_PACKAGE?.trim() || 'dev.loop.community', sha256_cert_fingerprints: fingerprints },
    },
  ];
}

export function appleAppSiteAssociation() {
  const appIds = list(process.env.IOS_APP_ID);
  if (!appIds.length) return null;
  return { applinks: { details: [{ appIDs: appIds, components: APP_LINK_PATHS.map((p) => ({ '/': p })) }] } };
}

export function installAppLinks(app: INestApplication) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();
    const body =
      req.path === '/.well-known/assetlinks.json' ? assetLinks()
      : req.path === '/.well-known/apple-app-site-association' ? appleAppSiteAssociation()
      : undefined;
    if (body === undefined) return next();
    if (!body) return void res.status(404).json({ message: '앱 링크가 설정되지 않았어요' });
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.type('application/json').send(JSON.stringify(body));
  });
}
