/** User-Agent 를 "Chrome · Windows" 처럼 사람이 알아볼 이름으로 (로그인한 기기 목록에 보여 준다) */
export function describeDevice(ua: string): string {
  if (!ua) return '알 수 없는 기기';
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X|Macintosh/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : undefined;
  // 앱은 브라우저가 아니라 기기 기본 HTTP 라이브러리로 요청한다
  if (/okhttp/i.test(ua)) return '루프 앱 · Android';
  if (/CFNetwork|Darwin/.test(ua) && !/Mozilla/.test(ua)) return '루프 앱 · iOS';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? '삼성 인터넷'
        : /Whale\//.test(ua)
          ? '웨일'
          : /Firefox\/|FxiOS/.test(ua)
            ? 'Firefox'
            : /Chrome\/|CriOS/.test(ua)
              ? 'Chrome'
              : /Safari\//.test(ua)
                ? 'Safari'
                : undefined;
  if (browser && os) return `${browser} · ${os}`;
  return browser ?? os ?? '알 수 없는 기기';
}
