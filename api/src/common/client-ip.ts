import type { Request } from 'express';

/**
 * 요청한 사람의 IP. 프록시(Vercel · nginx)가 넣어 주는 X-Real-IP 를 먼저 본다
 * (X-Forwarded-For 의 첫 값은 브라우저가 지어낼 수 있어서 마지막 수단)
 */
export function clientIp(req: Request): string {
  const real = req.header('x-real-ip');
  if (real) return real.trim();
  return String(req.header('x-forwarded-for') ?? req.socket.remoteAddress ?? '').split(',')[0]!.trim();
}
