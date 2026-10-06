// 링크 미리보기 이미지(og:image) 만들기: og.html 을 1200x630 으로 찍어 web/public/og-v2.png 로 저장한다.
// 2배로 찍어 고해상도 화면에서도 선명하게. 실행: npx -y -p playwright node web/og/render.mjs
// 바꾼 뒤에는 파일 이름(og-v3.png …)과 index.html 의 og:image 주소도 바꿔야 카카오톡 캐시에 걸리지 않는다
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const html = fileURLToPath(new URL('./og.html', import.meta.url));
const out = fileURLToPath(new URL('../public/og-v2.png', import.meta.url));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 })).newPage();
await page.goto(`file://${html}`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
