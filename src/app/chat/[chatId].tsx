import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useChat } from '@/hooks/use-chats';
import { useRewards } from '@/hooks/use-rewards';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { haptics } from '@/lib/haptics';
import { reportContent } from '@/services/moderation';
import { getPublicProfiles, socialErrorMessage } from '@/services/social';
import type { ChatMessage } from '@/types/social';
import { formatTime } from '@/utils/format';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ThemedText } from '@/components/themed-text';

export default function ChatScreen() {
  const params = useLocalSearchParams<{ chatId: string | string[] }>();
  const chatId = Array.isArray(params.chatId) ? params.chatId[0] : params.chatId;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    chat,
    messages,
    loading,
    error,
    sending,
    send,
    markRead,
    emergencyStatus,
    clearError,
  } = useChat(chatId ?? null);
  const rewards = useRewards();
  const [text, setText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [emergencyUntil, setEmergencyUntil] = useState(0);
  const [now, setNow] = useState(0);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!chat || chat.memberIds.length === 0) return;
    let active = true;
    void getPublicProfiles(chat.memberIds).then((profiles) => {
      if (!active) return;
      const next: Record<string, string> = {};
      for (const profile of profiles) next[profile.uid] = profile.displayName;
      if (user) next[user.uid] = user.displayName ?? 'Tú';
      setSenderNames(next);
    });
    return () => {
      active = false;
    };
  }, [chat, user]);

  useEffect(() => {
    if (messages.length > 0) void markRead();
  }, [messages.length, markRead]);

  useEffect(() => {
    if (!chatId) return;
    let active = true;
    void emergencyStatus().then((status) => {
      if (active && status && status.nextAllowedAt > Date.now()) {
        setEmergencyUntil(status.nextAllowedAt);
      }
    });
    return () => {
      active = false;
    };
  }, [chatId, emergencyStatus]);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const emergencyLeft = Math.max(0, Math.ceil((emergencyUntil - now) / 1000));
  const canSend = text.trim().length > 0 && !sending;

  const title = useMemo(() => chat?.title || 'Chat', [chat?.title]);

  async function onSend(emergency = false) {
    const body = text.trim() || (emergency ? 'Necesito ayuda.' : '');
    if (!body) return;
    setLocalError(null);
    clearError();
    try {
      const result = await send(body, emergency);
      setText('');
      setCooldownUntil(result.nextAllowedAt);
      if (emergency) setEmergencyUntil(result.nextAllowedAt);
      haptics.success();
    } catch (sendError) {
      const details = (sendError as { details?: { nextAllowedAt?: number } }).details;
      if (typeof details?.nextAllowedAt === 'number') {
        setCooldownUntil(details.nextAllowedAt);
      }
      haptics.error();
      setLocalError(socialErrorMessage(sendError));
    }
  }

  function shareInvite() {
    if (!chat?.inviteCode) return;
    haptics.tap();
    void Share.share({
      message: `Únete a mi grupo «${chat.title}» en SismoConnect con el código ${chat.inviteCode}.`,
    });
  }

  function openGroupMenu() {
    if (!chat || chat.type !== 'group' || !chatId) return;
    Alert.alert(chat.title, 'Opciones del grupo', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Ajustes del grupo',
        onPress: () => router.push(`/group/${chatId}` as Href),
      },
      { text: 'Compartir invitación', onPress: shareInvite },
    ]);
  }

  function confirmReport(message: ChatMessage) {
    if (!chatId || message.senderId === user?.uid) return;
    Alert.alert(
      'Reportar mensaje',
      'El mensaje se enviará al equipo de moderación junto con el contexto del chat.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reportar',
          style: 'destructive',
          onPress: () => {
            void reportContent({
              targetType: 'message',
              targetId: message.id,
              chatId,
              reason: 'contenido',
            })
              .then(() => {
                haptics.success();
                Alert.alert('Reporte enviado', 'Gracias. Revisaremos el mensaje.');
              })
              .catch((reportError) => {
                haptics.error();
                setLocalError(socialErrorMessage(reportError));
              });
          },
        },
      ]
    );
  }

  function confirmEmergency() {
    Alert.alert(
      'Enviar alerta de emergencia',
      'Se enviará un mensaje marcado como emergencia. Úsalo solo si necesitas ayuda real. El servidor limita una alerta cada 10 minutos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar', style: 'destructive', onPress: () => void onSend(true) },
      ]
    );
  }

  async function unlockWithAd() {
    setLocalError(null);
    try {
      const result = await rewards.watchAd();
      if (result.unlocks > 0) {
        setCooldownUntil(0);
        Alert.alert('Envío desbloqueado', 'Ya puedes enviar tu mensaje. Se consumirá al enviarlo.');
      } else {
        Alert.alert(
          'Sin recompensa todavía',
          'El anuncio se cerró o el servidor aún está validando la recompensa. Intenta actualizar en unos segundos.'
        );
      }
    } catch (adError) {
      setLocalError(socialErrorMessage(adError));
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText type="small" themeColor="textSecondary">
          Abriendo conversación…
        </ThemedText>
      </View>
    );
  }

  if (!chat) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <EmptyState
          title="Chat no disponible"
          description={error ?? 'No perteneces a esta conversación o ya no existe.'}
        />
        <Button label="Volver" variant="tonal" fullWidth={false} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          style={styles.back}>
          <ThemedText type="smallBold">‹</ThemedText>
        </Pressable>
        <View style={styles.headerText}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {chat.type === 'group'
              ? `${chat.memberIds.length} miembros`
              : 'Chat privado'}
            {cooldownLeft > 0 ? ` · espera ${cooldownLeft}s` : ''}
          </ThemedText>
        </View>
        {chat.type === 'group' && chat.inviteCode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Compartir código de invitación"
            onPress={shareInvite}
            style={[styles.code, { borderColor: theme.outline }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {chat.inviteCode}
            </ThemedText>
          </Pressable>
        ) : null}
        {chat.type === 'group' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Opciones del grupo"
            onPress={openGroupMenu}
            style={[styles.code, { borderColor: theme.outline }]}>
            <ThemedText type="smallBold">⋯</ThemedText>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(message) => message.id}
        contentContainerStyle={[styles.messages, { paddingBottom: Spacing.three }]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <Card>
            <ThemedText type="small" themeColor="textSecondary">
              Todavía no hay mensajes. Escribe el primero.
            </ThemedText>
          </Card>
        }
        renderItem={({ item }) => {
          const own = item.senderId === user?.uid;
          const senderName = senderNames[item.senderId] ?? 'Miembro';
          return (
            <View style={[styles.messageRow, own ? styles.messageRowOwn : null]}>
              {!own ? (
                <Avatar uri={null} name={senderName} size={30} />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={own ? 'Tu mensaje' : `Mensaje de ${senderName}`}
                onLongPress={() => confirmReport(item)}
                delayLongPress={450}
                style={[
                  styles.bubble,
                  {
                    backgroundColor: item.emergency
                      ? theme.error
                      : own
                        ? theme.primary
                        : theme.surfaceContainer,
                    borderColor: theme.outlineVariant,
                  },
                ]}>
                {chat.type === 'group' && !own ? (
                  <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>
                    {senderName}
                  </ThemedText>
                ) : null}
                {item.emergency ? (
                  <ThemedText type="smallBold" style={{ color: theme.onError }}>
                    EMERGENCIA
                  </ThemedText>
                ) : null}
                <ThemedText
                  style={{
                    color: item.emergency
                      ? theme.onError
                      : own
                        ? theme.onPrimary
                        : theme.text,
                  }}>
                  {item.text}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{
                    color: item.emergency
                      ? theme.onError
                      : own
                        ? theme.onPrimary
                        : theme.textSecondary,
                    opacity: 0.8,
                  }}>
                  {formatTime(item.createdAt)}
                </ThemedText>
              </Pressable>
            </View>
          );
        }}
      />

      {localError || error ? (
        <ThemedText type="small" style={[styles.error, { color: theme.error }]}>
          {localError ?? error}
        </ThemedText>
      ) : null}

      {cooldownLeft > 0 && rewards.enabled ? (
        <View style={[styles.unlock, { backgroundColor: theme.secondaryContainer }]}>
          <ThemedText type="small" style={{ color: theme.onSecondaryContainer }}>
            {rewards.unlocks > 0
              ? 'Tienes 1 envío extra. Escribe y pulsa enviar.'
              : `Espera ${cooldownLeft}s o mira un anuncio para enviar ahora.`}
          </ThemedText>
          {rewards.unlocks < 1 ? (
            <Button
              label="Ver anuncio"
              variant="tonal"
              fullWidth={false}
              loading={rewards.busy}
              onPress={() => void unlockWithAd()}
            />
          ) : null}
        </View>
      ) : null}

      {emergencyLeft > 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.emergencyNote}>
          Emergencia disponible de nuevo en {emergencyLeft}s.
        </ThemedText>
      ) : null}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
        <TextInput
          accessibilityLabel="Escribir mensaje"
          placeholder="Escribe un mensaje…"
          placeholderTextColor={theme.textSecondary}
          value={text}
          onChangeText={setText}
          maxLength={1000}
          multiline
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
          accessibilityLabel="Enviar alerta de emergencia"
          disabled={sending || emergencyLeft > 0}
          onPress={confirmEmergency}
          style={[
            styles.emergencyButton,
            {
              borderColor: theme.error,
              opacity: sending || emergencyLeft > 0 ? 0.4 : 1,
            },
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.error }}>
            !
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
          disabled={!canSend}
          onPress={() => void onSend(false)}
          style={[
            styles.sendButton,
            {
              backgroundColor: canSend ? theme.primary : theme.backgroundElement,
              opacity: sending ? 0.6 : 1,
            },
          ]}>
          <ThemedText type="smallBold" style={{ color: canSend ? theme.onPrimary : theme.textSecondary }}>
            Enviar
          </ThemedText>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.24)',
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  code: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  messages: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    maxWidth: '92%',
  },
  messageRowOwn: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  bubble: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 2,
    flexShrink: 1,
  },
  error: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  unlock: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  emergencyNote: {
    textAlign: 'center',
    paddingBottom: Spacing.two,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.24)',
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  emergencyButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    minHeight: 46,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
