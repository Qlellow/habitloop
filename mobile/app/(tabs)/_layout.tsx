import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '../../src/theme';

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.textStrong,
        headerTitleStyle: { fontWeight: '700', fontSize: 20 },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        tabBarActiveTintColor: c.textStrong,
        tabBarInactiveTintColor: c.weak,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '루프',
          tabBarLabel: '홈',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="channels"
        options={{
          title: '채널',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: '내 정보',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={23} color={color} />,
        }}
      />
    </Tabs>
  );
}
