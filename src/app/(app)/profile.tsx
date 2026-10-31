import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, quakeColor, Radius, Spacing } from '@/constants/theme';
import { useEarthquakes } from '@/hooks/use-earthquakes';
import { useProfile } from '@/hooks/use-profile';
import { useViewedHistory } from '@/hooks/use-storage';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { useThemePreference, type ThemePreference } from '@/hooks/use-theme-preference';
import { haptics } from '@/lib/haptics';
import { getCountryByCode } from '@/services/countries';
import { disablePushNotifications, enablePushNotifications } from '@/services/push';
import type { NotificationPrefs } from '@/types/social';
import { formatMagnitude, shortenPlace, timeAgo } from '@/utils/format';
import { Avatar } from '@/components/ui/avatar';
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

const PREF_OPTIONS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: 'earthquakes', label: 'Sismos según mis alertas' },
  { key: 'messages', label: 'Mensajes de chat' },
  { key: 'friends', label: 'Solicitudes y amistades' },
  { key: 'groups', label: 'Actividad de grupos' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const { user, signOut, resendVerification } = useAuth();
  const { preference, setPreference } = useThemePreference();
  const { viewed, clear } = useViewedHistory();
  const { data } = useEarthquakes('all_week', false);
  const social = useProfile();

  const [verifying, setVerifying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [languageBusy, setLanguageBusy] = useState(false);

  async function onSelectLanguage(language: string) {
    if (!social.profile || language !== 'es' || social.profile.language === language) return;
    setLanguageBusy(true);
    try {
      await social.updateProfile({
        displayName: social.profile.displayName,
        bio: social.profile.bio,
        countryCode: social.profile.countryCode,
        language,
        isPublic: social.profile.isPublic,
        notificationsEnabled: social.profile.notificationsEnabled,
        photoURL: social.profile.photoURL,
        coverURL: social.profile.coverURL,
      });
      haptics.success();
    } catch {
      haptics.error();
    } finally {
      setLanguageBusy(false);
    }
  }

  async function onTogglePref(key: keyof NotificationPrefs, value: boolean) {
    try {
      await social.updateNotificationPrefs({ [key]: value });
      haptics.select();
    } catch {
      haptics.error();
    }
  }

  async function onTogglePush() {
    setPushBusy(true);
    try {
      if (social.profile?.notificationsEnabled) {
        await disablePushNotifications();
        setPushBusy(false);
        Alert.alert('Avisos desactivados', 'Puedes volver a activarlos cuando quieras.');
        return;
      }

      const result = await enablePushNotifications();
      if (result.status !== 'granted') {
        Alert.alert(
          result.status === 'denied' ? 'Permiso denegado' : 'Avisos no disponibles',
          result.message
        );
        return;
      }
      haptics.success();
      Alert.alert('Avisos activados', 'Recibirás sismos según tus alertas y actividad social.');
    } catch (pushError) {
      haptics.error();
      Alert.alert(
        'No se pudieron activar los avisos',
        pushError instanceof Error ? pushError.message : 'Intenta de nuevo más tarde.'
      );
    } finally {
      setPushBusy(false);
    }
  }

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
        <Avatar
          uri={social.profile?.photoURL}
          name={social.profile?.displayName ?? user?.displayName ?? user?.email ?? '?'}
          size={72}
        />
        <View style={styles.headerText}>
          <ThemedText type="title" style={styles.title} numberOfLines={1}>
            {isAnonymous ? 'Sesión de invitado' : social.profile?.displayName ?? user?.displayName ?? 'Tu perfil'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {isAnonymous
              ? 'Historial local en este dispositivo'
              : social.profile?.username
                ? `@${social.profile.username}`
                : (user?.email ?? '')}
          </ThemedText>
        </View>
      </View>

      {!isAnonymous && social.enabled ? (
        <Card>
          <ThemedText type="smallBold">Perfil social</ThemedText>
          {social.loading ? (
            <ThemedText type="small" themeColor="textSecondary">
              Cargando tu perfil…
            </ThemedText>
          ) : social.profile ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {social.profile.bio || 'Añade una descripción para que te conozcan en la comunidad.'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {getCountryByCode(social.profile.countryCode)?.name ?? 'Sin país'} ·{' '}
                {social.profile.isPublic ? 'Perfil público' : 'Perfil privado'}
                {social.profile.unlocks > 0 ? ' · 1 envío extra disponible' : ''}
              </ThemedText>
            </>
          ) : (
            <ThemedText type="small" style={{ color: theme.error }}>
              {social.error ?? 'Perfil social no disponible.'}
            </ThemedText>
          )}
          <View style={styles.socialActions}>
            <Button
              label="Editar perfil"
              variant="tonal"
              fullWidth={false}
              disabled={!social.profile}
              onPress={() => router.push('/profile/edit')}
            />
            <Button
              label="Comunidad"
              variant="text"
              fullWidth={false}
              onPress={() => router.push('/community')}
            />
          </View>
        </Card>
      ) : null}

      {!isAnonymous && social.enabled && social.profile ? (
        <Card>
          <ThemedText type="smallBold">Avisos en este dispositivo</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {Platform.OS === 'web'
              ? 'Los avisos push están disponibles en la app Android. En web puedes consultar el historial dentro de la app.'
              : social.profile.notificationsEnabled
                ? 'Sismos según tus alertas, mensajes, amistades y grupos.'
                : 'Activa los avisos para recibir sismos y actividad social incluso con la app cerrada.'}
          </ThemedText>
          {Platform.OS !== 'web' ? (
            <Button
              label={social.profile.notificationsEnabled ? 'Desactivar avisos' : 'Activar avisos'}
              variant={social.profile.notificationsEnabled ? 'text' : 'tonal'}
              fullWidth={false}
              loading={pushBusy}
              onPress={() => void onTogglePush()}
            />
          ) : null}

          {social.profile.notificationsEnabled ? (
            <View style={styles.prefs}>
              {PREF_OPTIONS.map((option) => (
                <View key={option.key} style={styles.prefRow}>
                  <ThemedText type="small" style={styles.prefLabel}>
                    {option.label}
                  </ThemedText>
                  <Switch
                    accessibilityLabel={option.label}
                    value={social.profile?.notificationPrefs?.[option.key] !== false}
                    onValueChange={(value) => void onTogglePref(option.key, value)}
                    trackColor={{ false: theme.outlineVariant, true: theme.primary }}
                    thumbColor={theme.surface}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {!isAnonymous && social.enabled ? (
        <Card>
          <ThemedText type="smallBold">Idioma</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            La interfaz está en español. El inglés se activará cuando la traducción esté completa.
          </ThemedText>
          <View style={styles.chips}>
            <Chip
              label="Español"
              selected={(social.profile?.language ?? 'es') === 'es'}
              onPress={() => void onSelectLanguage('es')}
            />
            <Chip label="English · próximamente" selected={false} onPress={() => undefined} />
          </View>
          {languageBusy ? (
            <ThemedText type="small" themeColor="textSecondary">
              Guardando idioma…
            </ThemedText>
          ) : null}
        </Card>
      ) : null}

      {user?.isAdmin ? (
        <Card>
          <ThemedText type="smallBold">Moderación</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Revisa reportes de usuarios, mensajes y grupos.
          </ThemedText>
          <Button
            label="Abrir panel de moderación"
            variant="tonal"
            fullWidth={false}
            onPress={() => router.push('/admin/reports' as Href)}
          />
        </Card>
      ) : null}

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
  socialActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
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
  prefs: {
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 44,
  },
  prefLabel: {
    flex: 1,
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