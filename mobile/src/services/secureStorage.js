import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const hasLocalStorage =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export async function setItemAsync(key, value) {
  if (Platform.OS === 'web') {
    if (hasLocalStorage) {
      window.localStorage.setItem(key, value);
    }
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function getItemAsync(key) {
  if (Platform.OS === 'web') {
    return hasLocalStorage ? window.localStorage.getItem(key) : null;
  }
  return SecureStore.getItemAsync(key);
}

export async function deleteItemAsync(key) {
  if (Platform.OS === 'web') {
    if (hasLocalStorage) {
      window.localStorage.removeItem(key);
    }
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
