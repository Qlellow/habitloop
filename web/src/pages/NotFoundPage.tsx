import { Link } from 'react-router-dom';
import { Page } from '../components/Layout';
import { ui } from '../components/ui';
import { cn } from '../lib/cn';

export default function NotFoundPage({ message = '페이지를 찾을 수 없어요', hint = '주소가 맞는지 확인해 주세요.' }: { message?: string; hint?: string }) {
  return (
    <Page variant="single">
      <div className={cn(ui.card, ui.empty)} style={{ padding: '80px 20px' }}>
        <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 8px' }}>{message}</p>
        <p style={{ margin: '0 0 24px' }}>{hint}</p>
        <Link to="/" className={cn(ui.button, ui.primary)}>
          홈으로 가기
        </Link>
      </div>
    </Page>
  );
}
