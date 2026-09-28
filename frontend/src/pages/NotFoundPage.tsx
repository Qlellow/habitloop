import { Link } from 'react-router-dom';
import { SubHeader } from '../components/Layout';
import ui from '../components/ui.module.css';

export default function NotFoundPage({ message = '페이지를 찾을 수 없어요' }: { message?: string }) {
  return (
    <>
      <SubHeader backTo="/" />
      <div className={ui.empty} style={{ paddingTop: 120 }}>
        <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 20px' }}>{message}</p>
        <Link to="/" className={`${ui.button} ${ui.secondary}`}>
          홈으로 가기
        </Link>
      </div>
    </>
  );
}
