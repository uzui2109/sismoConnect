import '../global.css';

import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { navigationTheme } from '@/lib/navigation-theme';
import { ThemePreferenceProvider, useThemePreference } from '@/hooks/use-theme-preference';
import { useNotificationObserver } from '@/hooks/use-notification-observer';
import { ThemedText } from '@/components/themed-text';

// Hold the native splash until Firebase has restored any persisted session.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemePreferenceProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { user, isLoading } = useAuth();
  const { resolved } = useThemePreference();
  const theme = navigationTheme(resolved === 'dark');
  const [ready, setReady] = useState(false);
  useNotificationObserver();

  // One extra frame so the navigator has mounted before the splash is released,
  // otherwise Android shows a blank frame between splash and first screen.
  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator color={theme.colors.primary} />
        <ThemedText themeColor="textSecondary">Cargando actividad sísmica…</ThemedText>
      </View>
    );
  }

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}>
        {/* Guards run on every auth-state change; no manual redirect needed. */}
        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="chat/[chatId]" />
          <Stack.Screen name="group/[chatId]" />
          <Stack.Screen name="user/[uid]" />
          <Stack.Screen name="profile/edit" />
          <Stack.Screen name="reports" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="admin/reports" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});