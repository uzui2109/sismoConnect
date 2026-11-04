import { router } from 'expo-router';
import type { Href } from 'expo-router';

export function goBack(): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/' as Href);
}