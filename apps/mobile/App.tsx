import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import HabitsScreen from './src/screens/HabitsScreen';
import FeedScreen from './src/screens/FeedScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0f1115' }, headerTintColor: '#fff' }}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'HabitLoop' }} />
        <Stack.Screen name="Habits" component={HabitsScreen} options={{ title: '내 습관' }} />
        <Stack.Screen name="Feed" component={FeedScreen} options={{ title: '피드' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
