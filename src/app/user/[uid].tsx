import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useChats } from '@/hooks/use-chats';
import { useFriends } from '@/hooks/use-friends';
import { usePublicProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { haptics } from '@/lib/haptics';
import { socialErrorMessage } from '@/services/social';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ThemedText } from '@/components/themed-text';

const REPORT_REASONS = [
  { key: 'spam', label: 'Spam' },
  { key: 'abuso', label: 'Abuso' },
  { key: 'acoso', label: 'Acoso' },
  { key: 'contenido', label: 'Contenido' },
  { key: 'otro', label: 'Otro' },
];

export default function PublicProfileScreen() {
  const params = useLocalSearchParams<{ uid: string | string[] }>();
  const uid = Array.isArray(params.uid) ? params.uid[0] : params.uid;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile, loading, error } = usePublicProfile(uid ?? null);
  const friendsState = useFriends();
  const chatsState = useChats();
  const [actionError, setActionError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);

  const isSelf = uid === user?.uid;
  const isFriend = friendsState.friends.some((friend) => friend.uid === uid);
  const isPending = friendsState.outgoing.some((request) => request.toUid === uid);
  const isBlocked = friendsState.blocked.some((blocked) => blocked.uid === uid);
  const isPrivate = profile ? !profile.isPublic && !isFriend && !isSelf : false;

  async function onMessage() {
    if (!uid) return;
    try {
      setActionError(null);
      const chatId = await chatsState.openDirect(uid);
      router.push({ pathname: '/chat/[chatId]', params: { chatId } });
    } catch (messageError) {
      haptics.error();
      setActionError(socialErrorMessage(messageError));
    }
  }

  async function onAdd() {
    if (!uid) return;
    try {
      setActionError(null);
      await friendsState.addFriend(uid);
      haptics.success();
    } catch (addError) {
      haptics.error();
      setActionError(socialErrorMessage(addError));
    }
  }

  function confirmRemove() {
    if (!uid) return;
    Alert.alert('Eliminar amistad', 'Dejarán de poder escribirse en chats directos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setActionError(null);
          void friendsState.remove(uid).catch((removeError) => {
            setActionError(socialErrorMessage(removeError));
          });
        },
      },
    ]);
  }

  function confirmBlock() {
    if (!uid) return;
    Alert.alert('Bloquear usuario', 'Se eliminará la amistad y no podrá enviarte solicitudes.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Bloquear',
        style: 'destructive',
        onPress: () => {
          setActionError(null);
          void friendsState.block(uid).catch((blockError) => {
            setActionError(socialErrorMessage(blockError));
          });
        },
      },
    ]);
  }

  async function submitReport() {
    if (!uid) return;
    setReportBusy(true);
    setActionError(null);
    try {
      await friendsState.report(uid, reportReason, reportDetails);
      setReportOpen(false);
      setReportDetails('');
      haptics.success();
      Alert.alert('Reporte enviado', 'El equipo revisará el caso.');
    } catch (reportError) {
      haptics.error();
      setActionError(socialErrorMessage(reportError));
    } finally {
      setReportBusy(false);
    }
  }

  if (loading) {
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
          title="Perfil no disponible"
          description={error ?? 'Este perfil no existe o ya no es público.'}
        />
        <Button label="Volver" variant="tonal" fullWidth={false} onPress={() => router.back()} />
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
      ]}>
      <View style={styles.topBar}>
        <Button label="Volver" variant="text" fullWidth={false} onPress={() => router.back()} />
      </View>

      <View style={[styles.cover, { backgroundColor: theme.primaryContainer }]}>
        {profile.coverURL ? (
          <Image source={{ uri: profile.coverURL }} style={styles.coverImage} contentFit="cover" />
        ) : null}
      </View>

      <View style={styles.identity}>
        <Avatar uri={profile.photoURL} name={profile.displayName} size={84} />
        <View style={styles.identityText}>
          <ThemedText type="title" style={styles.name}>
            {profile.displayName}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {profile.username ? `@${profile.username}` : 'Sin nombre de usuario'}
            {profile.countryCode ? ` · ${profile.countryCode}` : ''}
          </ThemedText>
        </View>
      </View>

      {isPrivate ? (
        <Card>
          <ThemedText type="smallBold">Perfil privado</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Esta persona limita la visibilidad de su perfil. Puedes enviarle una solicitud o
            reportar el perfil.
          </ThemedText>
        </Card>
      ) : (
        <>
          <Card>
            <ThemedText type="smallBold">Sobre mí</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {profile.bio || 'Sin descripción.'}
            </ThemedText>
          </Card>

          <View style={styles.stats}>
            <Card style={styles.stat}>
              <ThemedText type="small" themeColor="textSecondary">
                Miembro desde
              </ThemedText>
              <ThemedText type="smallBold">
                {profile.createdAt
                  ? new Intl.DateTimeFormat('es', { month: 'short', year: 'numeric' }).format(
                      new Date(profile.createdAt)
                    )
                  : '—'}
              </ThemedText>
            </Card>
            <Card style={styles.stat}>
              <ThemedText type="small" themeColor="textSecondary">
                Visibilidad
              </ThemedText>
              <ThemedText type="smallBold">{profile.isPublic ? 'Pública' : 'Privada'}</ThemedText>
            </Card>
          </View>
        </>
      )}

      {actionError ? (
        <Card style={[styles.notice, { borderColor: theme.error }]}>
          <ThemedText type="small" style={{ color: theme.error }}>
            {actionError}
          </ThemedText>
        </Card>
      ) : null}

      <View style={styles.actions}>
        {isSelf ? (
          <Button label="Editar mi perfil" onPress={() => router.push('/profile/edit')} />
        ) : isBlocked ? (
          <Button
            label="Desbloquear"
            variant="tonal"
            disabled={friendsState.busy}
            onPress={() => {
              if (!uid) return;
              setActionError(null);
              void friendsState.unblock(uid).catch((unblockError) => {
                setActionError(socialErrorMessage(unblockError));
              });
            }}
          />
        ) : (
          <>
            {isFriend ? (
              <Button
                label="Enviar mensaje"
                loading={chatsState.busy}
                onPress={() => void onMessage()}
              />
            ) : isPending ? (
              <Button label="Solicitud enviada" variant="tonal" disabled />
            ) : (
              <Button
                label="Agregar amistad"
                loading={friendsState.busy}
                onPress={() => void onAdd()}
              />
            )}
            {isFriend ? (
              <Button
                label="Eliminar amistad"
                variant="outlined"
                disabled={friendsState.busy}
                onPress={confirmRemove}
              />
            ) : null}
            <Button
              label="Bloquear"
              variant="text"
              disabled={friendsState.busy}
              onPress={confirmBlock}
            />
            <Button label="Reportar" variant="text" onPress={() => setReportOpen(true)} />
          </>
        )}
      </View>

      <Modal
        visible={reportOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReportOpen(false)}>
        <View style={[styles.modalScrim, { backgroundColor: theme.scrim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setReportOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.background }]}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Reportar perfil
            </ThemedText>
            <View style={styles.chips}>
              {REPORT_REASONS.map((reason) => (
                <Chip
                  key={reason.key}
                  label={reason.label}
                  selected={reportReason === reason.key}
                  onPress={() => setReportReason(reason.key)}
                />
              ))}
            </View>
            <TextInput
              accessibilityLabel="Detalles del reporte"
              placeholder="Detalles opcionales…"
              placeholderTextColor={theme.textSecondary}
              value={reportDetails}
              onChangeText={setReportDetails}
              multiline
              maxLength={500}
              style={[
                styles.details,
                {
                  color: theme.text,
                  backgroundColor: theme.surface,
                  borderColor: theme.outlineVariant,
                },
              ]}
            />
            <Button label="Enviar reporte" loading={reportBusy} onPress={() => void submitReport()} />
            <Button label="Cancelar" variant="text" onPress={() => setReportOpen(false)} />
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
  cover: {
    height: 150,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.three,
    marginTop: -Spacing.five,
    paddingHorizontal: Spacing.two,
  },
  identityText: {
    flex: 1,
    gap: 2,
    paddingBottom: Spacing.two,
  },
  name: {
    fontSize: 28,
    lineHeight: 34,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  notice: {
    borderWidth: 2,
  },
  actions: {
    gap: Spacing.two,
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
    maxWidth: 440,
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  details: {
    minHeight: 96,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
