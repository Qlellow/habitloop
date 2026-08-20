import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';

type FeedItem = {
  id: number;
  date: string;
  habit: { title: string; emoji: string | null };
  user: { nickname: string };
  likes: { id: number }[];
};

export default function FeedScreen() {
  const [items, setItems] = useState<FeedItem[]>([]);

  const load = useCallback(async () => {
    const { data } = await api.get<FeedItem[]>('/feed');
    setItems(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function like(id: number) {
    await api.post(`/checkins/${id}/like`);
    load();
  }

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(i) => String(i.id)}
      ListEmptyComponent={<Text style={styles.empty}>피드가 비어있어요.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.name}>{item.user.nickname}</Text>
          <Text style={styles.body}>
            {item.habit.emoji ?? '🔁'} {item.habit.title} · {item.date}
          </Text>
          <TouchableOpacity onPress={() => like(item.id)}>
            <Text style={styles.like}>👏 {item.likes?.length ?? 0}</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115', padding: 16 },
  empty: { color: '#9aa0ac', textAlign: 'center', marginTop: 32 },
  card: { backgroundColor: '#1b1e26', borderRadius: 12, padding: 16, marginBottom: 10 },
  name: { color: '#fff', fontWeight: '700' },
  body: { color: '#c8ccd6', marginTop: 4 },
  like: { color: '#7ce0c6', marginTop: 8 },
});
