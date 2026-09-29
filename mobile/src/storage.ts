import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthStorage } from '@loop/shared';

/** 로그인 토큰은 기기 보안 저장소(iOS Keychain / Android Keystore)에 둔다 */
export const secureStorage: AuthStorage =
  Platform.OS === 'web'
    ? {
        // 브라우저 미리보기용
        getItem: (k) => globalThis.localStorage?.getItem(k) ?? null,
        setItem: (k, v) => globalThis.localStorage?.setItem(k, v),
        removeItem: (k) => globalThis.localStorage?.removeItem(k),
      }
    : {
        getItem: (k) => SecureStore.getItemAsync(k),
        setItem: (k, v) => SecureStore.setItemAsync(k, v),
        removeItem: (k) => SecureStore.deleteItemAsync(k),
      };
