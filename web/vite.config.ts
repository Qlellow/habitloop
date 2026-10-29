import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * SPA 라서 /c/free 같은 주소는 실제 파일이 없다. 새 창·새로고침으로 바로 열면 호스팅이 404 를 내므로
 * 빌드 결과에 index.html 과 같은 404.html 을 두어, 정적 호스팅이 404 페이지로 앱을 띄우게 한다.
 * (Vercel 은 루트 vercel.json 의 services.web.rewrites, Docker 는 nginx try_files 가 먼저 처리하고 이건 마지막 안전망)
 */
function spaFallback(): Plugin {
  let outDir = 'dist';
  return {
    name: 'spa-fallback-404',
    apply: 'build',
    configResolved: (c) => void (outDir = resolve(c.root, c.build.outDir)),
    closeBundle: () => copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html')),
  };
}

/**
 * 콘텐츠 보안 정책(CSP): 혹시 글 본문 등에 스크립트가 끼어들어도 실행되지 않게, 스크립트는 이 사이트 파일과 카카오 공유 SDK 만 허용한다.
 * 로그인 정보가 localStorage 에 있으므로 XSS 의 마지막 안전망. 개발 서버는 인라인 스크립트 · HMR 웹소켓을 써서 빌드에만 넣는다.
 * meta 로 넣어 Vercel · Docker(nginx) 어디서나 같게 적용된다 (meta 로 못 넣는 frame-ancestors 는 vercel.json · nginx.conf 헤더)
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://t1.kakaocdn.net",
  // React 의 style 속성 · CodeMirror 가 넣는 <style>
  "style-src 'self' 'unsafe-inline'",
  // 본문 이미지는 바깥 주소도 쓸 수 있고, 올리기 전 미리보기는 blob:
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  // 음성방(LiveKit) 은 wss:, 날씨 등은 https:
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  'frame-src https://*.kakao.com',
  "object-src 'none'",
  "base-uri 'self'",
  // 카카오톡 공유: SDK 가 sharer.kakao.com 으로 폼을 보내 공유 창을 연다
  "form-action 'self' https://*.kakao.com",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
  };
}

/**
 * react-router 는 package.json exports 에 'production' 조건이 없어 빌드에도 개발용 파일(경고 · 검사 포함)이 들어간다.
 * 빌드할 때만 같은 버전의 production 파일로 바꿔 끼운다
 */
const routerDist = resolve(dirname(createRequire(import.meta.url).resolve('react-router/package.json')), 'dist/production');

/** 이 빌드의 이름 (오류 보고에 붙인다): Vercel · GitHub Actions 의 커밋, 없으면 dev */
const RELEASE = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'dev').slice(0, 7);

export default defineConfig(({ command }) => ({
  plugins: [react(), spaFallback(), contentSecurityPolicy()],
  define: { __RELEASE__: JSON.stringify(RELEASE) },
  resolve: {
    alias:
      command === 'build'
        ? [
            { find: /^react-router$/, replacement: resolve(routerDist, 'index.mjs') },
            { find: /^react-router\/dom$/, replacement: resolve(routerDist, 'dom-export.mjs') },
          ]
        : [],
  },
  // 포트: 백엔드 3000, 웹 3001 (이미 쓰고 있으면 다른 포트로 넘어가지 않고 바로 에러를 낸다)
  server: {
    port: 3001,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  preview: {
    port: 3001,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: true,
    rolldownOptions: {
      output: {
        // 자주 바뀌지 않는 라이브러리를 앱 코드와 분리해 배포 후에도 브라우저 캐시가 유지되도록 한다
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'router', test: /node_modules[\\/](react-router|react-router-dom)[\\/]/, priority: 20 },
            { name: 'query', test: /node_modules[\\/]@tanstack[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
}));
