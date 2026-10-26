import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { useChats } from '@/hooks/use-chats';
import { useFriends } from '@/hooks/use-friends';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { socialErrorMessage } from '@/services/social';
import type { PublicProfile } from '@/types/social';
import { timeAgo } from '@/utils/format';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/themed-text';

type CommunityTab = 'chats' | 'friends' | 'requests' | 'discover';

const TABS: { key: CommunityTab; label: string }[] = [
  { key: 'chats', label: 'Chats' },
  { key: 'friends', label: 'Amistades' },
  { key: 'requests', label: 'Solicitudes' },
  { key: 'discover', label: 'Descubrir' },
];

export default function CommunityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const profileState = useProfile();
  const friendsState = useFriends();
  const chatsState = useChats();
  const [tab, setTab] = useState<CommunityTab>('chats');
  const [groupMode, setGroupMode] = useState<'create' | 'join' | null>(null);
  const [groupTitle, setGroupTitle] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupBusy, setGroupBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const enabled = profileState.enabled;
  const incomingCount = friendsState.incoming.length;
  const outgoingUids = useMemo(
    () => new Set(friendsState.outgoing.map((request) => request.toUid)),
    [friendsState.outgoing]
  );
  const friendUids = useMemo(
    () => new Set(friendsState.friends.map((friend) => friend.uid)),
    [friendsState.friends]
  );

  async function onMessage(otherUid: string) {
    try {
      setActionError(null);
      const chatId = await chatsState.openDirect(otherUid);
      router.push({ pathname: '/chat/[chatId]', params: { chatId } });
    } catch (error) {
      haptics.error();
      setActionError(socialErrorMessage(error));
    }
  }

  async function onAdd(otherUid: string) {
    try {
      setActionError(null);
      await friendsState.addFriend(otherUid);
      haptics.success();
    } catch (error) {
      haptics.error();
      setActionError(socialErrorMessage(error));
    }
  }

  async function onRespond(requestId: string, accept: boolean) {
    try {
      setActionError(null);
      await friendsState.respond(requestId, accept);
      haptics.success();
    } catch (error) {
      haptics.error();
      setActionError(socialErrorMessage(error));
    }
  }

  async function onSubmitGroup() {
    setGroupBusy(true);
    setGroupError(null);
    try {
      const result =
        groupMode === 'create'
          ? await chatsState.createGroup(groupTitle)
          : await chatsState.joinGroup(inviteCode);
      setGroupMode(null);
      setGroupTitle('');
      setInviteCode('');
      haptics.success();
      router.push({ pathname: '/chat/[chatId]', params: { chatId: result.chatId } });
    } catch (error) {
      haptics.error();
      setGroupError(socialErrorMessage(error));
    } finally {
      setGroupBusy(false);
    }
  }

  async function onSearch() {
    if (search.trim().length < 2) return;
    setSearching(true);
    setActionError(null);
    try {
      setResults(await friendsState.search(search));
    } catch (error) {
      setActionError(socialErrorMessage(error));
    } finally {
      setSearching(false);
    }
  }

  if (!enabled) {
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.background }]}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + 96 },
        ]}>
        <View style={styles.heading}>
          <ThemedText type="title" style={styles.title}>
            Comunidad
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Perfiles, amistades y chats privados.
          </ThemedText>
        </View>
        <Card variant="raised" style={styles.authCard}>
          <ThemedText type="smallBold">Inicia sesión para participar</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            La sesión de invitado es local y no puede crear perfiles ni conversaciones.
          </ThemedText>
          <Button label="Iniciar sesión" onPress={() => void signOut()} />
        </Card>
      </ScrollView>
    );
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
      <View style={styles.heading}>
        <ThemedText type="title" style={styles.title}>
          Comunidad
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {profileState.profile?.username
            ? `@${profileState.profile.username}`
            : 'Elige un nombre de usuario para que te encuentren.'}
        </ThemedText>
      </View>

      {!profileState.profile?.username ? (
        <Card style={[styles.notice, { borderColor: theme.secondary }]}>
          <ThemedText type="smallBold">Completa tu perfil</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Un nombre de usuario único permite enviar y recibir solicitudes de amistad.
          </ThemedText>
          <Button
            label="Editar perfil"
            variant="tonal"
            fullWidth={false}
            onPress={() => router.push('/profile/edit')}
          />
        </Card>
      ) : null}

      <View style={styles.chips}>
        {TABS.map((item) => (
          <Chip
            key={item.key}
            label={item.key === 'requests' && incomingCount > 0 ? `${item.label} (${incomingCount})` : item.label}
            selected={tab === item.key}
            onPress={() => setTab(item.key)}
          />
        ))}
      </View>

      {actionError || friendsState.error || chatsState.error || profileState.error ? (
        <Card style={[styles.notice, { borderColor: theme.error }]}>
          <ThemedText type="small" style={{ color: theme.error }}>
            {actionError ?? friendsState.error ?? chatsState.error ?? profileState.error}
          </ThemedText>
        </Card>
      ) : null}

      {tab === 'chats' ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Conversaciones</ThemedText>
            <View style={styles.inlineActions}>
              <Button
                label="Crear grupo"
                variant="tonal"
                fullWidth={false}
                onPress={() => {
                  setGroupMode('create');
                  setGroupError(null);
                }}
              />
              <Button
                label="Unirme"
                variant="text"
                fullWidth={false}
                onPress={() => {
                  setGroupMode('join');
                  setGroupError(null);
                }}
              />
            </View>
          </View>

          {chatsState.loading ? (
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                Cargando conversaciones…
              </ThemedText>
            </Card>
          ) : chatsState.chats.length === 0 ? (
            <EmptyState
              title="Sin conversaciones"
              description="Abre el perfil de una amistad para iniciar un chat o crea un grupo con un código de invitación."
            />
          ) : (
            chatsState.chats.map((chat) => (
              <Card
                key={chat.chatId}
                style={styles.chatRow}
                onPress={() =>
                  router.push({ pathname: '/chat/[chatId]', params: { chatId: chat.chatId } })
                }>
                <View
                  style={[
                    styles.chatIcon,
                    { backgroundColor: chat.unreadCount > 0 ? theme.primary : theme.backgroundElement },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: chat.unreadCount > 0 ? theme.onPrimary : theme.text }}>
                    {chat.type === 'group' ? '#' : '@'}
                  </ThemedText>
                </View>
                <View style={styles.chatBody}>
                  <View style={styles.chatTitleRow}>
                    <ThemedText style={styles.chatTitle} numberOfLines={1}>
                      {chat.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {chat.lastMessageAt ? timeAgo(chat.lastMessageAt) : ''}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {chat.lastMessageText || 'Sin mensajes todavía'}
                  </ThemedText>
                </View>
                {chat.unreadCount > 0 ? (
                  <View style={[styles.unread, { backgroundColor: theme.secondary }]}>
                    <ThemedText type="smallBold" style={{ color: theme.onSecondary }}>
                      {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                    </ThemedText>
                  </View>
                ) : null}
              </Card>
            ))
          )}
        </View>
      ) : null}

      {tab === 'friends' ? (
        <View style={styles.section}>
          <ThemedText type="subtitle">Amistades</ThemedText>
          {friendsState.loading ? (
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                Cargando amistades…
              </ThemedText>
            </Card>
          ) : friendsState.friends.length === 0 ? (
            <EmptyState
              title="Aún no tienes amistades"
              description="Busca a alguien por su nombre de usuario en Descubrir."
            />
          ) : (
            friendsState.friends.map((friend) => (
              <Card key={friend.uid} style={styles.personRow}>
                <Avatar uri={friend.photoURL} name={friend.displayName} />
                <Pressable
                  style={styles.personBody}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir perfil de ${friend.displayName}`}
                  onPress={() =>
                    router.push({ pathname: '/user/[uid]', params: { uid: friend.uid } })
                  }>
                  <ThemedText style={styles.personName}>{friend.displayName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {friend.username ? `@${friend.username}` : 'Sin usuario'}
                  </ThemedText>
                </Pressable>
                <Button
                  label="Mensaje"
                  variant="tonal"
                  fullWidth={false}
                  disabled={chatsState.busy}
                  onPress={() => void onMessage(friend.uid)}
                />
              </Card>
            ))
          )}
        </View>
      ) : null}

      {tab === 'requests' ? (
        <View style={styles.section}>
          <ThemedText type="subtitle">Solicitudes recibidas</ThemedText>
          {friendsState.incoming.length === 0 ? (
            <EmptyState
              title="Sin solicitudes"
              description="Cuando alguien quiera agregarte, aparecerá aquí."
            />
          ) : (
            friendsState.incoming.map((request) => (
              <Card key={request.id} style={styles.personRow}>
                <Avatar
                  uri={request.profile?.photoURL}
                  name={request.profile?.displayName ?? 'Solicitud'}
                />
                <View style={styles.personBody}>
                  <ThemedText style={styles.personName}>
                    {request.profile?.displayName ?? 'Solicitud de amistad'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {request.profile?.username ? `@${request.profile.username}` : 'Perfil privado'}
                  </ThemedText>
                </View>
                <View style={styles.inlineActions}>
                  <Button
                    label="Aceptar"
                    fullWidth={false}
                    disabled={friendsState.busy}
                    onPress={() => void onRespond(request.id, true)}
                  />
                  <Button
                    label="Rechazar"
                    variant="text"
                    fullWidth={false}
                    disabled={friendsState.busy}
                    onPress={() => void onRespond(request.id, false)}
                  />
                </View>
              </Card>
            ))
          )}

          {friendsState.outgoing.length > 0 ? (
            <>
              <ThemedText type="subtitle" style={styles.subheading}>
                Enviadas
              </ThemedText>
              {friendsState.outgoing.map((request) => (
                <Card key={request.id} style={styles.personRow}>
                  <Avatar
                    uri={request.profile?.photoURL}
                    name={request.profile?.displayName ?? 'Solicitud'}
                  />
                  <View style={styles.personBody}>
                    <ThemedText style={styles.personName}>
                      {request.profile?.displayName ?? 'Solicitud pendiente'}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Esperando respuesta
                    </ThemedText>
                  </View>
                </Card>
              ))}
            </>
          ) : null}

          {friendsState.blocked.length > 0 ? (
            <>
              <ThemedText type="subtitle" style={styles.subheading}>
                Bloqueados
              </ThemedText>
              {friendsState.blocked.map((blocked) => (
                <Card key={blocked.uid} style={styles.personRow}>
                  <Avatar uri={blocked.photoURL} name={blocked.displayName} />
                  <View style={styles.personBody}>
                    <ThemedText style={styles.personName}>{blocked.displayName}</ThemedText>
                  </View>
                  <Button
                    label="Desbloquear"
                    variant="text"
                    fullWidth={false}
                    disabled={friendsState.busy}
                    onPress={() => {
                      setActionError(null);
                      void friendsState.unblock(blocked.uid).catch((error) => {
                        setActionError(socialErrorMessage(error));
                      });
                    }}
                  />
                </Card>
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      {tab === 'discover' ? (
        <View style={styles.section}>
          <ThemedText type="subtitle">Descubrir personas</ThemedText>
          <View style={styles.searchRow}>
            <TextInput
              accessibilityLabel="Buscar por nombre o usuario"
              placeholder="Nombre o @usuario…"
              placeholderTextColor={theme.textSecondary}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => void onSearch()}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.searchInput,
                {
                  color: theme.text,
                  backgroundColor: theme.surface,
                  borderColor: theme.outlineVariant,
                },
              ]}
            />
            <Button
              label="Buscar"
              fullWidth={false}
              loading={searching}
              disabled={search.trim().length < 2}
              onPress={() => void onSearch()}
            />
          </View>

          {results.length === 0 ? (
            <EmptyState
              title="Encuentra personas"
              description="Escribe al menos dos letras de un nombre o nombre de usuario."
            />
          ) : (
            results.map((result) => {
              const isFriend = friendUids.has(result.uid);
              const isPending = outgoingUids.has(result.uid);
              const isSelf = result.uid === user?.uid;
              return (
                <Card key={result.uid} style={styles.personRow}>
                  <Avatar uri={result.photoURL} name={result.displayName} />
                  <Pressable
                    style={styles.personBody}
                    onPress={() =>
                      router.push({ pathname: '/user/[uid]', params: { uid: result.uid } })
                    }>
                    <ThemedText style={styles.personName}>{result.displayName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {result.username ? `@${result.username}` : 'Sin usuario'}
                    </ThemedText>
                  </Pressable>
                  {!isSelf && !isFriend && !isPending ? (
                    <Button
                      label="Agregar"
                      variant="tonal"
                      fullWidth={false}
                      disabled={friendsState.busy}
                      onPress={() => void onAdd(result.uid)}
                    />
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      {isSelf ? 'Tú' : isFriend ? 'Amistad' : 'Pendiente'}
                    </ThemedText>
                  )}
                </Card>
              );
            })
          )}
        </View>
      ) : null}

      <Modal
        visible={groupMode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setGroupMode(null)}>
        <View style={[styles.modalScrim, { backgroundColor: theme.scrim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setGroupMode(null)} />
          <View style={[styles.modalCard, { backgroundColor: theme.background }]}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              {groupMode === 'create' ? 'Crear grupo' : 'Unirme a un grupo'}
            </ThemedText>
            {groupMode === 'create' ? (
              <TextField
                label="Nombre del grupo"
                placeholder="Sismos de la costa"
                value={groupTitle}
                onChangeText={setGroupTitle}
                hint="Entre 2 y 60 caracteres."
              />
            ) : (
              <TextField
                label="Código de invitación"
                placeholder="A1B2C3D4"
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="characters"
                hint="Pídelo a quien creó el grupo."
              />
            )}
            {groupError ? (
              <ThemedText type="small" style={{ color: theme.error }}>
                {groupError}
              </ThemedText>
            ) : null}
            <Button
              label={groupMode === 'create' ? 'Crear y abrir' : 'Entrar'}
              loading={groupBusy}
              onPress={() => void onSubmitGroup()}
            />
            <Button label="Cancelar" variant="text" onPress={() => setGroupMode(null)} />
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
  content: {
    paddingHorizontal: Spacing.four,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  heading: {
    gap: 2,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  notice: {
    gap: Spacing.two,
    borderWidth: 2,
  },
  authCard: {
    gap: Spacing.three,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  chatIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBody: {
    flex: 1,
    gap: 2,
  },
  chatTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  chatTitle: {
    flex: 1,
    fontWeight: '700',
  },
  unread: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  personBody: {
    flex: 1,
    gap: 1,
  },
  personName: {
    fontWeight: '700',
  },
  subheading: {
    marginTop: Spacing.three,
    fontSize: 22,
    lineHeight: 28,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
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
});
