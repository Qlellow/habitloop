import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';

type Habit = { id: number; title: string; emoji: string | null };

export default function HabitsScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [streaks, setStreaks] = useState<Record<number, number>>({});
  const [title, setTitle] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get<Habit[]>('/habits');
    setHabits(data);
    const entries = await Promise.all(
      data.map(async (h) => {
        const res = await api.get(`/habits/${h.id}/checkins/streak`);
        return [h.id, res.data.streak] as const;
      }),
    );
    setStreaks(Object.fromEntries(entries));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function addHabit() {
    if (!title.trim()) return;
    await api.post('/habits', { title });
    setTitle('');
    load();
  }

  async function checkIn(habitId: number) {
    try {
      await api.post(`/habits/${habitId}/checkins`, {});
      load();
    } catch {
      // 이미 오늘 체크인한 경우 무시
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="새 습관"
          placeholderTextColor="#888"
          value={title}
          onChangeText={setTitle}
        />
        <TouchableOpacity style={styles.addButton} onPress={addHabit}>
          <Text style={{ color: '#0f1115', fontWeight: '700' }}>추가</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={habits}
        keyExtractor={(h) => String(h.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View>
              <Text style={styles.cardTitle}>{item.emoji ?? '🔁'} {item.title}</Text>
              <Text style={styles.cardSub}>🔥 {streaks[item.id] ?? 0}일 연속</Text>
            </View>
            <TouchableOpacity style={styles.checkButton} onPress={() => checkIn(item.id)}>
              <Text style={{ color: '#0f1115', fontWeight: '700' }}>체크인</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115', padding: 16 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: { backgroundColor: '#1b1e26', color: '#fff', borderRadius: 10, padding: 12 },
  addButton: { backgroundColor: '#7ce0c6', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  card: {
    backgroundColor: '#1b1e26',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { color: '#fff', fontSize: 16 },
  cardSub: { color: '#9aa0ac', fontSize: 13, marginTop: 4 },
  checkButton: { backgroundColor: '#7ce0c6', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
});
