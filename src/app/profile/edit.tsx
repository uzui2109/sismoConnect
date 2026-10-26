import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { haptics } from '@/lib/haptics';
import { getCountries, getCountryByCode } from '@/services/countries';
import { pickAndUploadProfileImage, type ProfileImageKind } from '@/services/profile-images';
import { socialErrorMessage } from '@/services/social';
import type { Country } from '@/types/country';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ThemedText } from '@/components/themed-text';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export default function EditProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isConfigured, isLocalGuest } = useAuth();
  const { profile, loading, error, refresh, updateProfile, claimUsername } = useProfile();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [coverURL, setCoverURL] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [imageBusy, setImageBusy] = useState<ProfileImageKind | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  useEffect(() => {
    if (!profile || hydrated) return;
    setDisplayName(profile.displayName);
    setBio(profile.bio);
    setCountryCode(profile.countryCode);
    setIsPublic(profile.isPublic);
    setPhotoURL(profile.photoURL);
    setCoverURL(profile.coverURL);
    setUsername(profile.username ?? '');
    setUsernameDraft(profile.username ?? '');
    setHydrated(true);
  }, [profile, hydrated]);

  const countries = useMemo(
    () =>
      getCountries()
        .filter((country) => /^[A-Z]{2}$/.test(country.code))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    []
  );

  const filteredCountries = useMemo(() => {
    const term = countrySearch.trim().toLocaleLowerCase('es');
    if (!term) return countries;
    return countries.filter((country) => country.name.toLocaleLowerCase('es').includes(term));
  }, [countries, countrySearch]);

  const selectedCountry = getCountryByCode(countryCode);
  const canSave = displayName.trim().length > 0 && bio.length <= 280 && !saving;

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    setLocalError(null);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        countryCode,
        language: profile?.language ?? 'es',
        isPublic,
        notificationsEnabled: profile?.notificationsEnabled ?? false,
        photoURL,
        coverURL,
      });
      haptics.success();
      Alert.alert('Perfil actualizado', 'Tus cambios ya están visibles.');
      router.back();
    } catch (saveError) {
      haptics.error();
      setLocalError(socialErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function onClaimUsername() {
    const candidate = usernameDraft.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(candidate)) {
      setLocalError('Usa de 3 a 20 caracteres: letras minúsculas, números o guion bajo.');
      return;
    }
    setClaiming(true);
    setLocalError(null);
    try {
      const claimed = await claimUsername(candidate);
      setUsername(claimed);
      setUsernameDraft(claimed);
      haptics.success();
    } catch (claimError) {
      haptics.error();
      setLocalError(socialErrorMessage(claimError));
    } finally {
      setClaiming(false);
    }
  }

  async function onChangeImage(kind: ProfileImageKind) {
    if (!profile) return;
    setImageBusy(kind);
    setLocalError(null);
    try {
      const url = await pickAndUploadProfileImage(profile.uid, kind);
      if (!url) return;
      const nextPhoto = kind === 'avatar' ? url : photoURL;
      const nextCover = kind === 'cover' ? url : coverURL;
      await updateProfile({
        displayName: displayName.trim() || profile.displayName,
        bio: bio.trim(),
        countryCode,
        language: profile.language,
        isPublic,
        notificationsEnabled: profile.notificationsEnabled,
        photoURL: nextPhoto,
        coverURL: nextCover,
      });
      if (kind === 'avatar') setPhotoURL(url);
      else setCoverURL(url);
      haptics.success();
    } catch (imageError) {
      haptics.error();
      setLocalError(socialErrorMessage(imageError));
    } finally {
      setImageBusy(null);
    }
  }

  if (!isConfigured || isLocalGuest) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <EmptyState
          title="Perfil social no disponible"
          description={
            isLocalGuest
              ? 'La sesión de invitado guarda el historial solo en este dispositivo. Crea una cuenta para tener perfil, amistades y chats.'
              : 'Configura Firebase para activar los perfiles sociales.'
          }
        />
        <Button label="Volver" variant="tonal" fullWidth={false} onPress={() => router.back()} />
      </View>
    );
  }

  if (loading || !hydrated) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText type="small" themeColor="textSecondary">
          Cargando perfil…
        </ThemedText>
      </View>
    );
  }

  if (!profile || error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <EmptyState
          title="No se pudo cargar el perfil"
          description={error ?? 'Comprueba que las funciones de Firebase estén desplegadas.'}
        />
        <Button label="Reintentar" fullWidth={false} onPress={() => void refresh()} />
        <Button label="Volver" variant="text" fullWidth={false} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.two,
          paddingBottom: insets.bottom + Spacing.five,
          maxWidth: MaxContentWidth,
        },
      ]}
      keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <Button label="Cancelar" variant="text" fullWidth={false} onPress={() => router.back()} />
      </View>

      <View style={styles.heading}>
        <ThemedText type="title" style={styles.title}>
          Editar perfil
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Tu nombre público, usuario y país ayudan a encontrarte en la comunidad.
        </ThemedText>
      </View>

      <View style={styles.images}>
        <View style={[styles.cover, { backgroundColor: theme.primaryContainer }]}>
          {coverURL ? (
            <Image source={{ uri: coverURL }} style={styles.coverImage} contentFit="cover" />
          ) : (
            <ThemedText type="small" style={{ color: theme.onPrimaryContainer }}>
              Portada
            </ThemedText>
          )}
          <View style={styles.coverActions}>
            <Button
              label={coverURL ? 'Cambiar portada' : 'Añadir portada'}
              variant="tonal"
              fullWidth={false}
              loading={imageBusy === 'cover'}
              onPress={() => void onChangeImage('cover')}
            />
          </View>
        </View>
        <View style={styles.avatarRow}>
          <Avatar uri={photoURL} name={displayName || profile.displayName} size={84} />
          <Button
            label={photoURL ? 'Cambiar foto' : 'Añadir foto'}
            variant="outlined"
            fullWidth={false}
            loading={imageBusy === 'avatar'}
            onPress={() => void onChangeImage('avatar')}
          />
        </View>
      </View>

      {!imageBusy ? (
        <ThemedText type="small" themeColor="textSecondary">
          Las imágenes se recortan y comprimen antes de subirse. Límite: 2 MB.
        </ThemedText>
      ) : null}

      {localError ? (
        <Card style={[styles.notice, { borderColor: theme.error }]}>
          <ThemedText type="small" style={{ color: theme.error }}>
            {localError}
          </ThemedText>
        </Card>
      ) : null}

      <View style={styles.field}>
        <ThemedText type="smallBold">Nombre visible</ThemedText>
        <TextInput
          accessibilityLabel="Nombre visible"
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={60}
          placeholder="Tu nombre"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.surface,
              borderColor: theme.outlineVariant,
            },
          ]}
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="smallBold">Nombre de usuario</ThemedText>
        <View style={styles.usernameRow}>
          <TextInput
            accessibilityLabel="Nombre de usuario"
            value={usernameDraft}
            onChangeText={(value) => setUsernameDraft(value.toLowerCase())}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ejemplo_123"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              styles.usernameInput,
              {
                color: theme.text,
                backgroundColor: theme.surface,
                borderColor: theme.outlineVariant,
              },
            ]}
          />
          <Button
            label={username ? 'Cambiar' : 'Reservar'}
            variant="tonal"
            fullWidth={false}
            loading={claiming}
            onPress={() => void onClaimUsername()}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {username ? `Actual: @${username}` : 'Aún no tienes nombre de usuario.'} Solo minúsculas,
          números y guion bajo.
        </ThemedText>
      </View>

      <View style={styles.field}>
        <ThemedText type="smallBold">Descripción</ThemedText>
        <TextInput
          accessibilityLabel="Descripción del perfil"
          value={bio}
          onChangeText={setBio}
          maxLength={280}
          multiline
          placeholder="Cuéntanos qué te interesa de los sismos…"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            styles.bio,
            {
              color: theme.text,
              backgroundColor: theme.surface,
              borderColor: theme.outlineVariant,
            },
          ]}
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>
          {bio.length}/280
        </ThemedText>
      </View>

      <View style={styles.field}>
        <ThemedText type="smallBold">País</ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Elegir país"
          onPress={() => {
            haptics.tap();
            setCountryOpen(true);
          }}
          style={[
            styles.select,
            { backgroundColor: theme.surface, borderColor: theme.outlineVariant },
          ]}>
          <ThemedText>{selectedCountry?.name ?? 'Sin país'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Cambiar
          </ThemedText>
        </Pressable>
      </View>

      <Card style={styles.switchCard}>
        <View style={styles.switchText}>
          <ThemedText type="smallBold">Perfil público</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Si lo desactivas, otras personas verán un aviso de perfil privado.
          </ThemedText>
        </View>
        <Switch
          accessibilityLabel="Perfil público"
          value={isPublic}
          onValueChange={(value) => {
            haptics.select();
            setIsPublic(value);
          }}
          trackColor={{ false: theme.outlineVariant, true: theme.primaryContainer }}
          thumbColor={isPublic ? theme.primary : theme.outline}
        />
      </Card>

      <Button label="Guardar cambios" loading={saving} disabled={!canSave} onPress={() => void onSave()} />
      <Button label="Cancelar" variant="text" onPress={() => router.back()} />

      <Modal
        visible={countryOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCountryOpen(false)}>
        <View style={[styles.modalScrim, { backgroundColor: theme.scrim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCountryOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.background }]}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Elegir país
            </ThemedText>
            <TextInput
              accessibilityLabel="Buscar país"
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Buscar país…"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.surface,
                  borderColor: theme.outlineVariant,
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sin país"
              onPress={() => {
                setCountryCode(null);
                setCountryOpen(false);
              }}
              style={[styles.countryRow, { borderColor: theme.outlineVariant }]}>
              <ThemedText>Sin país</ThemedText>
            </Pressable>
            <FlatList
              data={filteredCountries}
              keyExtractor={(item: Country) => item.code}
              keyboardShouldPersistTaps="handled"
              style={styles.countryList}
              initialNumToRender={16}
              windowSize={7}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  onPress={() => {
                    setCountryCode(item.code);
                    setCountryOpen(false);
                  }}
                  style={[
                    styles.countryRow,
                    {
                      borderColor: theme.outlineVariant,
                      backgroundColor:
                        countryCode === item.code ? theme.backgroundSelected : 'transparent',
                    },
                  ]}>
                  <ThemedText>{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.code}
                  </ThemedText>
                </Pressable>
              )}
              ListEmptyComponent={
                <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                  Sin resultados.
                </ThemedText>
              }
            />
            <Button label="Cerrar" variant="tonal" onPress={() => setCountryOpen(false)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  content: {
    paddingHorizontal: Spacing.four,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  topBar: {
    flexDirection: 'row',
  },
  heading: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  images: {
    gap: Spacing.three,
  },
  cover: {
    height: 160,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverActions: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: -Spacing.five,
    paddingHorizontal: Spacing.two,
  },
  notice: {
    borderWidth: 2,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 50,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  bio: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  counter: {
    textAlign: 'right',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  usernameInput: {
    flex: 1,
  },
  select: {
    minHeight: 50,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: 520,
    maxHeight: '86%',
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  countryList: {
    flexGrow: 0,
    maxHeight: 420,
  },
  countryRow: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  empty: {
    paddingVertical: Spacing.four,
    textAlign: 'center',
  },
});
