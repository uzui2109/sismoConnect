import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useChat } from '@/hooks/use-chats';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { haptics } from '@/lib/haptics';
import {
  deleteGroup,
  getPublicProfiles,
  leaveGroup,
  regenerateInviteCode,
  removeGroupMember,
  socialErrorMessage,
  updateGroup,
} from '@/services/social';
import type { PublicProfile } from '@/types/social';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/themed-text';

export default function GroupSettingsScreen() {
  const params = useLocalSearchParams<{ chatId: string | string[] }>();
  const chatId = Array.isArray(params.chatId) ? params.chatId[0] : params.chatId;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { chat, loading, error } = useChat(chatId ?? null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!chat) return;
      setTitle(chat.title);
      setDescription(chat.description);
    }, 0);
    return () => clearTimeout(timer);
  }, [chat]);

  useEffect(() => {
    if (!chat || chat.memberIds.length === 0) return;
    let active = true;
    void getPublicProfiles(chat.memberIds).then((next) => {
      if (active) setProfiles(next);
    });
    return () => {
      active = false;
    };
  }, [chat]);

  if (!chatId) {
    return (
      <EmptyState
        title="Grupo no encontrado"
        description="Falta el identificador del grupo."
      />
    );
  }

  if (loading && !chat) {
    return (
      <View style={[styles.screen, styles.centered, { backgroundColor: theme.background }]}>
        <ThemedText themeColor="textSecondary">Cargando grupo…</ThemedText>
      </View>
    );
  }

  if (!chat) {
    return (
      <ErrorState
        title="Grupo no disponible"
        message={error ?? 'No pudimos cargar este grupo.'}
        onRetry={() => router.back()}
      />
    );
  }

  const isOwner = chat.createdBy === user?.uid;
  const canSave =
    isOwner &&
    title.trim().length >= 2 &&
    (title.trim() !== chat.title || description.trim() !== chat.description);

  function shareInvite() {
    if (!chat?.inviteCode) return;
    haptics.tap();
    void Share.share({
      message: `Únete a mi grupo «${chat.title}» en SismoConnect con el código ${chat.inviteCode}.`,
    });
  }

  async function onSave() {
    if (!chatId || !canSave) return;
    setBusy(true);
    setLocalError(null);
    try {
      await updateGroup(chatId, title.trim(), description.trim());
      haptics.success();
    } catch (saveError) {
      haptics.error();
      setLocalError(socialErrorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function onRegenerate() {
    if (!chatId) return;
    setBusy(true);
    setLocalError(null);
    try {
      const result = await regenerateInviteCode(chatId);
      haptics.success();
      Alert.alert('Nuevo código', result.inviteCode);
    } catch (codeError) {
      haptics.error();
      setLocalError(socialErrorMessage(codeError));
    } finally {
      setBusy(false);
    }
  }

  function confirmLeave() {
    if (!chatId) return;
    Alert.alert('Salir del grupo', 'Dejarás de recibir mensajes de este grupo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          void leaveGroup(chatId)
            .then(() => {
              haptics.success();
              router.dismissAll();
            })
            .catch((leaveError) => {
              haptics.error();
              Alert.alert('No se pudo salir', socialErrorMessage(leaveError));
            })
            .finally(() => setBusy(false));
        },
      },
    ]);
  }

  function confirmDelete() {
    if (!chatId) return;
    Alert.alert('Eliminar grupo', 'Se borrará el grupo para todos sus miembros.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          void deleteGroup(chatId)
            .then(() => {
              haptics.success();
              router.dismissAll();
            })
            .catch((deleteError) => {
              haptics.error();
              Alert.alert('No se pudo eliminar', socialErrorMessage(deleteError));
            })
            .finally(() => setBusy(false));
        },
      },
    ]);
  }

  function confirmRemove(memberUid: string, name: string) {
    if (!chatId) return;
    Alert.alert('Expulsar miembro', `¿Expulsar a ${name} del grupo?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Expulsar',
        style: 'destructive',
        onPress: () => {
          void removeGroupMember(chatId, memberUid)
            .then(() => haptics.success())
            .catch((removeError) => {
              haptics.error();
              Alert.alert('No se pudo expulsar', socialErrorMessage(removeError));
            });
        },
      },
    ]);
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
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver al chat"
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={({ pressed }) => [
            styles.back,
            { borderColor: theme.outlineVariant, opacity: pressed ? 0.7 : 1 },
          ]}>
          <ThemedText type="linkPrimary">Volver</ThemedText>
        </Pressable>
        <ThemedText type="title">Ajustes del grupo</ThemedText>
      </View>

      <Card style={styles.card}>
        <ThemedText type="subtitle">Información</ThemedText>
        {isOwner ? (
          <>
            <TextField
              label="Nombre"
              value={title}
              onChangeText={setTitle}
              maxLength={60}
              hint="Entre 2 y 60 caracteres."
            />
            <TextField
              label="Descripción"
              value={description}
              onChangeText={setDescription}
              maxLength={280}
              multiline
              numberOfLines={3}
              style={styles.descriptionInput}
              hint={`${description.length}/280 caracteres.`}
            />
            <Button
              label="Guardar cambios"
              onPress={() => void onSave()}
              disabled={!canSave}
              loading={busy}
            />
            {localError ? (
              <ThemedText type="small" style={{ color: theme.error }}>
                {localError}
              </ThemedText>
            ) : null}
          </>
        ) : (
          <ThemedText themeColor="textSecondary">
            {chat.description || 'Este grupo no tiene descripción.'}
          </ThemedText>
        )}
      </Card>

      <Card style={styles.card}>
        <ThemedText type="subtitle">Invitación</ThemedText>
        <View style={[styles.codeBox, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="code">{chat.inviteCode ?? 'Sin código'}</ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Comparte este código para que más personas se unan al grupo.
        </ThemedText>
        <View style={styles.row}>
          <Button
            label="Compartir"
            variant="tonal"
            onPress={shareInvite}
            disabled={!chat.inviteCode}
            style={styles.rowButton}
          />
          {isOwner ? (
            <Button
              label="Regenerar"
              variant="outlined"
              onPress={() => void onRegenerate()}
              disabled={busy}
              style={styles.rowButton}
            />
          ) : null}
        </View>
      </Card>

      <Card style={styles.card}>
        <ThemedText type="subtitle">Miembros ({chat.memberIds.length})</ThemedText>
        {chat.memberIds.map((memberUid) => {
          const profile = profiles.find((item) => item.uid === memberUid);
          const name =
            memberUid === user?.uid
              ? user?.displayName ?? 'Tú'
              : profile?.displayName ?? 'Miembro';
          const isGroupOwner = memberUid === chat.createdBy;
          return (
            <View key={memberUid} style={styles.member}>
              <Avatar uri={profile?.photoURL} name={name} />
              <View style={styles.memberText}>
                <ThemedText type="smallBold">{name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {isGroupOwner ? 'Creador del grupo' : 'Miembro'}
                </ThemedText>
              </View>
              {isOwner && !isGroupOwner ? (
                <Button
                  label="Expulsar"
                  variant="text"
                  fullWidth={false}
                  onPress={() => confirmRemove(memberUid, name)}
                />
              ) : null}
            </View>
          );
        })}
      </Card>

      <Card style={styles.card}>
        <ThemedText type="subtitle">Zona de salida</ThemedText>
        <Button
          label="Salir del grupo"
          variant="outlined"
          onPress={confirmLeave}
          disabled={busy}
        />
        {isOwner ? (
          <Button
            label="Eliminar grupo"
            variant="text"
            onPress={confirmDelete}
            loading={busy}
          />
        ) : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    minHeight: 40,
    justifyContent: 'center',
  },
  card: {
    gap: Spacing.two,
  },
  descriptionInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  codeBox: {
    borderRadius: Radius.md,
    padding: Spacing.three,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rowButton: {
    flex: 1,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
  },
  memberText: {
    flex: 1,
    gap: 2,
  },
});
