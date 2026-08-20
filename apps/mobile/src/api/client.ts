import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 실기기/에뮬레이터에서 테스트할 땐 localhost 대신 PC의 LAN IP로 바꿔주세요.
export const API_URL = 'http://localhost:3001';

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password });
  await AsyncStorage.setItem('token', data.accessToken);
  return data.user;
}

export async function signup(email: string, password: string, nickname: string) {
  const { data } = await api.post('/auth/signup', { email, password, nickname });
  await AsyncStorage.setItem('token', data.accessToken);
  return data.user;
}

export async function logout() {
  await AsyncStorage.removeItem('token');
}
