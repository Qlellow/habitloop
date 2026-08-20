import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HabitLoop',
  description: '습관 트래커 + 소셜',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#0f1115', color: '#f2f2f2' }}>
        <nav style={{ display: 'flex', gap: 16, padding: '16px 24px', borderBottom: '1px solid #262933' }}>
          <a href="/" style={{ color: '#f2f2f2', fontWeight: 700, textDecoration: 'none' }}>🔁 HabitLoop</a>
          <a href="/habits" style={{ color: '#9aa0ac', textDecoration: 'none' }}>내 습관</a>
          <a href="/feed" style={{ color: '#9aa0ac', textDecoration: 'none' }}>피드</a>
          <a href="/login" style={{ color: '#9aa0ac', textDecoration: 'none', marginLeft: 'auto' }}>로그인</a>
        </nav>
        <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>{children}</main>
      </body>
    </html>
  );
}
