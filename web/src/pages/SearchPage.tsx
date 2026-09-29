import { useSearchParams } from 'react-router-dom';
import { useFeed } from '@loop/shared';
import { Footer, Page } from '../components/Layout';
import { PostList } from '../components/PostList';
import { PopularCard } from '../components/Sidebar';
import ui from '../components/ui.module.css';

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const feed = useFeed({ q }, q.length > 0);

  return (
    <Page
      variant="twoRight"
      right={
        <>
          <PopularCard />
          <Footer />
        </>
      }
    >
      <section className={ui.card}>
        <div className={ui.cardHead}>
          <h1 className={ui.sectionTitle}>{q ? `'${q}' 검색 결과` : '검색'}</h1>
        </div>
        {q ? (
          <PostList query={feed} empty={`'${q}'에 대한 검색 결과가 없어요`} />
        ) : (
          <div className={ui.empty}>위 검색창에 찾고 싶은 글 제목을 입력해 주세요</div>
        )}
      </section>
    </Page>
  );
}
