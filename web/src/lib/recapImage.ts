import type { WeeklyRecap } from '@loop/shared';
import { hourLabel, rangeLabel } from '../components/WeeklyRecap';

/**
 * 주간 회고 카드를 PNG 로 그린다 (인스타 스토리 · 갤러리에 올리기 좋은 4:5, 1080×1350).
 * 화면의 카드와 같은 내용을 캔버스에 직접 그린다 (외부 라이브러리 없이). 글꼴은 페이지 글꼴을 그대로 쓴다.
 */
const W = 1080;
const H = 1350;
const PAD = 84;
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** 폭에 맞춰 줄바꿈 (한글은 글자 단위로 끊는다). 넘치면 마지막 줄 끝을 … 로 */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > width && line) {
      lines.push(line);
      line = ch.trimStart();
      if (lines.length === maxLines) break;
    } else line += ch;
  }
  if (lines.length < maxLines && line) lines.push(line);
  else if (lines.length === maxLines && line) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

export async function drawRecap(r: WeeklyRecap, title: string): Promise<Blob> {
  await document.fonts?.ready;
  const css = getComputedStyle(document.documentElement);
  const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const primary = css.getPropertyValue('--primary-solid').trim() || '#3182f6';

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  const f = (size: number, weight = 700) => `${weight} ${size}px ${font}`;

  // 배경: 브랜드 색 위에 아래로 갈수록 어둡게
  ctx.fillStyle = '#3182f6';
  ctx.fillStyle = primary; // 캔버스가 모르는 색 표기면 앞의 기본색이 남는다
  ctx.fillRect(0, 0, W, H);
  const shade = ctx.createLinearGradient(0, 0, W, H);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'top';
  let y = PAD;

  ctx.globalAlpha = 0.8;
  ctx.font = f(30, 600);
  ctx.fillText(`주간 회고 · ${rangeLabel(r.week)}${r.week.current ? ' (진행 중)' : ''}`, PAD, y);
  ctx.globalAlpha = 1;
  y += 50;
  ctx.font = f(40);
  ctx.fillText(wrap(ctx, `${r.user.nickname}님의 한 주`, W - PAD * 2, 1)[0], PAD, y);
  y += 84;

  ctx.font = f(64, 800);
  for (const line of wrap(ctx, title, W - PAD * 2, 2)) {
    ctx.fillText(line, PAD, y);
    y += 80;
  }
  y += 28;

  // 숫자 6칸 (3 × 2)
  const s = r.stats;
  const tiles: [string, number][] = [
    ['쓴 글', s.posts],
    ['댓글', s.comments],
    ['받은 공감', s.likesReceived],
    ['받은 반응', s.reactionsReceived],
    ['내 글 읽힘', s.views],
    ['보낸 응원', s.cheersGiven],
  ];
  const gap = 20;
  const tw = (W - PAD * 2 - gap * 2) / 3;
  const th = 150;
  tiles.forEach(([label, value], i) => {
    const x = PAD + (i % 3) * (tw + gap);
    const ty = y + Math.floor(i / 3) * (th + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, x, ty, tw, th, 28);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = f(58, 800);
    ctx.fillText(value.toLocaleString(), x + 30, ty + 26);
    ctx.globalAlpha = 0.82;
    ctx.font = f(28, 600);
    ctx.fillText(label, x + 30, ty + 100);
    ctx.globalAlpha = 1;
  });
  y += th * 2 + gap + 40;

  // 출석한 요일
  if (r.attendance) {
    ctx.font = f(30, 700);
    ctx.fillText('출석', PAD, y);
    ctx.globalAlpha = 0.85;
    ctx.font = f(28, 600);
    const days = `7일 중 ${r.attendance.filter(Boolean).length}일`;
    ctx.fillText(days, W - PAD - ctx.measureText(days).width, y + 2);
    ctx.globalAlpha = 1;
    y += 52;
    const dw = (W - PAD * 2) / 7;
    DAYS.forEach((d, i) => {
      const cx = PAD + dw * i + dw / 2;
      const on = r.attendance![i];
      ctx.beginPath();
      ctx.arc(cx, y + 34, 34, 0, Math.PI * 2);
      ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.14)';
      ctx.fill();
      ctx.fillStyle = on ? '#1b2a4a' : 'rgba(255,255,255,0.75)';
      ctx.font = f(28, 700);
      ctx.fillText(d, cx - ctx.measureText(d).width / 2, y + 20);
    });
    ctx.fillStyle = '#fff';
    y += 108;
  }

  // 가장 반응이 좋았던 글 (자리가 남으면)
  if (r.topPost && y < H - 300) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, PAD, y, W - PAD * 2, 190, 28);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.82;
    ctx.font = f(26, 600);
    ctx.fillText('가장 반응이 좋았던 글', PAD + 32, y + 26);
    ctx.globalAlpha = 1;
    ctx.font = f(36, 700);
    ctx.fillText(wrap(ctx, r.topPost.title, W - PAD * 2 - 64, 1)[0], PAD + 32, y + 70);
    ctx.globalAlpha = 0.85;
    ctx.font = f(26, 500);
    ctx.fillText(`${r.topPost.channel.name} · 공감 ${r.topPost.likes} · 댓글 ${r.topPost.comments}`, PAD + 32, y + 130);
    ctx.globalAlpha = 1;
    y += 220;
  }

  // 한 줄 사실들
  const facts = [r.topChannel && `가장 많이 머문 채널 · ${r.topChannel.name}`, r.peakHour != null && `가장 활발한 시간 · ${hourLabel(r.peakHour)}`].filter(
    Boolean,
  ) as string[];
  ctx.font = f(28, 600);
  for (const fact of facts) {
    if (y > H - 170) break;
    ctx.fillText(wrap(ctx, fact, W - PAD * 2, 1)[0], PAD, y);
    y += 46;
  }

  // 아래: 서비스 이름 · 주소
  ctx.globalAlpha = 0.75;
  ctx.font = f(30, 800);
  ctx.fillText('루프 커뮤니티', PAD, H - PAD - 30);
  ctx.font = f(26, 500);
  const host = location.host;
  ctx.fillText(host, W - PAD - ctx.measureText(host).width, H - PAD - 26);
  ctx.globalAlpha = 1;

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}
