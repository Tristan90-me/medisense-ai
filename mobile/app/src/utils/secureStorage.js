// Adapts expo-secure-store's API to the { getItem, setItem, removeItem }
// shape zustand/middleware's createJSONStorage expects, so persisted auth
// state (including the JWT) lives in the platform Keychain/Keystore rather
// than AsyncStorage's plain-file storage.
import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
