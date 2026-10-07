import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, quakeColor, Radius, Spacing } from '@/constants/theme';
import { useEarthquakes } from '@/hooks/use-earthquakes';
import { useViewedHistory } from '@/hooks/use-storage';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { useThemePreference, type ThemePreference } from '@/hooks/use-theme-preference';
import { haptics } from '@/lib/haptics';
import { formatMagnitude, shortenPlace, timeAgo } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ThemedText } from '@/components/themed-text';

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'system', label: 'Sistema' },
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Oscuro' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const { user, signOut, resendVerification } = useAuth();
  const { preference, setPreference } = useThemePreference();
  const { viewed, clear } = useViewedHistory();
  const { data } = useEarthquakes('all_week', false);

  const [verifying, setVerifying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const history = useMemo(
    () => viewed.map((id) => data.find((quake) => quake.id === id)).filter((q) => q !== undefined),
    [viewed, data]
  );

  const isAnonymous = user?.isAnonymous ?? false;
  const needsVerification = user !== null && !isAnonymous && !user.emailVerified;

  async function onResend() {
    setVerifying(true);
    try {
      await resendVerification();
      haptics.success();
    } catch {
      haptics.error();
    } finally {
      setVerifying(false);
    }
  }

  async function onSignOut() {
    setSigningOut(true);
    try {
      // The root guard returns the user to the login screen automatically.
      await signOut();
      clear();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.two,
          paddingBottom: insets.bottom + 96,
          maxWidth: MaxContentWidth,
        },
      ]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: theme.primaryContainer }]}>
          <ThemedText style={[styles.avatarMark, { color: theme.onPrimaryContainer }]}>
            {(user?.displayName ?? user?.email ?? '?').charAt(0).toUpperCase()}
          </ThemedText>
        </View>
        <View style={styles.headerText}>
          <ThemedText type="title" style={styles.title} numberOfLines={1}>
            {isAnonymous ? 'Sesión de invitado' : (user?.displayName ?? 'Tu perfil')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {isAnonymous ? 'Historial local en este dispositivo' : (user?.email ?? '')}
          </ThemedText>
        </View>
      </View>

      {needsVerification && (
        <Card style={[styles.notice, { borderColor: theme.warning }]}>
          <ThemedText type="smallBold">Verifica tu correo</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Confirma tu dirección para no perder el acceso a tu cuenta.
          </ThemedText>
          <Button label="Reenviar correo" variant="tonal" fullWidth={false} onPress={onResend} loading={verifying} />
        </Card>
      )}

      <View style={styles.section}>
        <ThemedText type="subtitle">Apariencia</ThemedText>
        <View style={styles.chips}>
          {THEME_OPTIONS.map((option) => (
            <Chip
              key={option.key}
              label={option.label}
              selected={preference === option.key}
              onPress={() => {
                haptics.select();
                setPreference(option.key);
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle">Historial</ThemedText>
          {viewed.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Borrar historial"
              onPress={() => {
                haptics.tap();
                clear();
              }}
              style={styles.clearButton}>
              <ThemedText type="small" themeColor="textSecondary">
                Borrar
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {history.length === 0 ? (
          <EmptyState
            title="Sin historial"
            description="Los sismos que abras desde el monitor aparecerán aquí."
          />
        ) : (
          history.slice(0, 20).map((quake) => (
            <Pressable
              key={quake.id}
              accessibilityRole="button"
              accessibilityLabel={`${formatMagnitude(quake.magnitude)}, ${shortenPlace(quake.place)}`}
              onPress={() => {
                haptics.tap();
                router.push('/');
              }}
              style={({ pressed }) => [
                styles.historyRow,
                {
                  backgroundColor: pressed ? theme.backgroundSelected : theme.surface,
                  borderColor: theme.outlineVariant,
                },
              ]}>
              <View style={[styles.historyDot, { backgroundColor: quakeColor(quake.magnitude, isDark) }]} />
              <View style={styles.historyBody}>
                <ThemedText numberOfLines={1} style={styles.historyPlace}>
                  {shortenPlace(quake.place)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatMagnitude(quake.magnitude)} · {timeAgo(quake.time)}
                </ThemedText>
              </View>
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.section}>
        <ThemedText type="subtitle">Sesión</ThemedText>
        <Button
          label="Cerrar sesión"
          variant="outlined"
          onPress={() => void onSignOut()}
          loading={signingOut}
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
          Al cerrar sesión se borra el historial guardado en este dispositivo.
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMark: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
  notice: {
    gap: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 2,
  },
  section: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    minHeight: 40,
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  historyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  historyBody: {
    flex: 1,
    gap: 2,
  },
  historyPlace: {
    fontSize: 15,
    fontWeight: '600',
  },
  footnote: {
    textAlign: 'center',
  },
});