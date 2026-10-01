import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

export default defineConfig({
  plugins: [react(), spaFallback()],
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
});
