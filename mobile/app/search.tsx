import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useFeed } from '@loop/shared';
import { PostFeed } from '../src/PostList';
import { Empty, Input } from '../src/ui';

export default function SearchScreen() {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  // 타이핑할 때마다 요청하지 않도록 300ms 디바운스
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);
  const feed = useFeed({ q }, q.length > 0);

  const box = (
    <View className="p-4 bg-surface">
      <Input
        placeholder="글 제목으로 검색"
        value={input}
        onChangeText={setInput}
        autoFocus
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );

  if (!q) {
    return (
      <View className="flex-1 bg-surface">
        {box}
        <Empty>찾고 싶은 글 제목을 입력해 주세요</Empty>
      </View>
    );
  }
  return <PostFeed query={feed} header={box} empty={`'${q}'에 대한 검색 결과가 없어요`} />;
}
