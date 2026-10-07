import type { Persistence } from 'firebase/auth';

/**
 * `@firebase/auth` ships a React Native build (selected through the
 * `react-native` export condition) that adds an AsyncStorage-backed persistence.
 * It is absent from the `browser` typings TypeScript picks by default, so the
 * module is augmented here instead of reaching into internal dist paths.
 */
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}