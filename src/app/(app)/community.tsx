<<<<<<< HEAD
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
=======
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { useChats } from '@/hooks/use-chats';
import { useFriends } from '@/hooks/use-friends';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
<<<<<<< HEAD
import { joinGlobalChat, searchPublicProfiles, socialErrorMessage } from '@/services/social';
import type { PublicProfile } from '@/types/social';
=======
import { socialErrorMessage } from '@/services/social';
import type { PublicProfile } from '@/types/social';
import { timeAgo } from '@/utils/format';
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/themed-text';

<<<<<<< HEAD
type Tab = 'global' | 'chats' | 'friends' | 'requests' | 'groups' | 'discover';

const TABS: { key: Tab; label: string }[] = [
  { key: 'global', label: 'Sala Global' },
  { key: 'chats', label: 'Chats' },
  { key: 'friends', label: 'Amistades' },
  { key: 'requests', label: 'Solicitudes' },
  { key: 'groups', label: 'Grupos' },
  { key: 'discover', label: 'Descubrir' },
];

function formatMMSS(msLeft: number) {
  if (msLeft <= 0) return '00:00';
  const totalSec = Math.ceil(msLeft / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

=======
type CommunityTab = 'chats' | 'friends' | 'requests' | 'discover';

const TABS: { key: CommunityTab; label: string }[] = [
  { key: 'chats', label: 'Chats' },
  { key: 'friends', label: 'Amistades' },
  { key: 'requests', label: 'Solicitudes' },
  { key: 'discover', label: 'Descubrir' },
];

>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
export default function CommunityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const profileState = useProfile();
  const friendsState = useFriends();
  const chatsState = useChats();
<<<<<<< HEAD

  const [tab, setTab] = useState<Tab>('global');
  const [bannerErr, setBannerErr] = useState<string | null>(null);
  const [globalBusy, setGlobalBusy] = useState(false);

  const [now, setNow] = useState(() => Date.now());
  const [globalNextAllowedAt] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const globalMsLeft = globalNextAllowedAt ? Math.max(0, globalNextAllowedAt - now) : 0;
  const globalCanWrite = globalMsLeft <= 0;

  const [groupMode, setGroupMode] = useState<'create' | 'join' | null>(null);
  const [groupTitle, setGroupTitle] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupErr, setGroupErr] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const enabled = profileState.enabled;
  const incomingCount = friendsState.incoming.length;
  const friendUids = useMemo(() => new Set(friendsState.friends.map((f) => f.uid)), [friendsState.friends]);
  const outgoingUids = useMemo(() => new Set(friendsState.outgoing.map((r) => r.toUid)), [friendsState.outgoing]);

  async function openGlobal() {
    if (globalBusy) return;
    setBannerErr(null);
    setGlobalBusy(true);
    try {
      const { chatId } = await joinGlobalChat();
      router.push({ pathname: '/chat/[chatId]', params: { chatId } });
    } catch (e) {
      console.error('[Community][openGlobal]', e);
      haptics.error();
      setBannerErr(socialErrorMessage(e));
    } finally {
      setGlobalBusy(false);
    }
  }

  async function onCreateOrJoinGroup() {
    if (!chatsState.enabled) return;
    const titleTrim = groupTitle.trim();
    const codeTrim = inviteCode.trim().toUpperCase();

    if (groupMode === 'create' && titleTrim.length < 2) {
      setGroupErr('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (groupMode === 'join' && codeTrim.length < 4) {
      setGroupErr('Introduce un código válido.');
      return;
    }

    setGroupBusy(true);
    setGroupErr(null);
    try {
      const res =
        groupMode === 'create'
          ? await chatsState.createGroup(titleTrim)
          : await chatsState.joinGroup(codeTrim);
=======
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
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
      setGroupMode(null);
      setGroupTitle('');
      setInviteCode('');
      haptics.success();
<<<<<<< HEAD
      router.push({ pathname: '/chat/[chatId]', params: { chatId: res.chatId } });
    } catch (e) {
      console.error('[Community][group]', e);
      haptics.error();
      setGroupErr(socialErrorMessage(e));
=======
      router.push({ pathname: '/chat/[chatId]', params: { chatId: result.chatId } });
    } catch (error) {
      haptics.error();
      setGroupError(socialErrorMessage(error));
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
    } finally {
      setGroupBusy(false);
    }
  }

  async function onSearch() {
<<<<<<< HEAD
    const term = search.trim();
    if (term.length < 2) return;
    setSearching(true);
    setBannerErr(null);
    try {
      const list = await searchPublicProfiles(term);
      setResults(list);
    } catch (e) {
      console.error('[Community][search]', e);
      setBannerErr(socialErrorMessage(e));
      setResults([]);
=======
    if (search.trim().length < 2) return;
    setSearching(true);
    setActionError(null);
    try {
      setResults(await friendsState.search(search));
    } catch (error) {
      setActionError(socialErrorMessage(error));
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
    } finally {
      setSearching(false);
    }
  }

<<<<<<< HEAD
  async function onAdd(uid: string) {
    try {
      setBannerErr(null);
      await friendsState.addFriend(uid);
      haptics.success();
    } catch (e) {
      console.error('[Community][addFriend]', e);
      haptics.error();
      setBannerErr(socialErrorMessage(e));
    }
  }

  async function onRespond(id: string, accept: boolean) {
    try {
      setBannerErr(null);
      await friendsState.respond(id, accept);
      haptics.success();
    } catch (e) {
      console.error('[Community][respond]', e);
      haptics.error();
      setBannerErr(socialErrorMessage(e));
    }
  }

  async function onMessage(uid: string) {
    try {
      setBannerErr(null);
      const cid = await chatsState.openDirect(uid);
      router.push({ pathname: '/chat/[chatId]', params: { chatId: cid } });
    } catch (e) {
      console.error('[Community][openDirect]', e);
      haptics.error();
      setBannerErr(socialErrorMessage(e));
    }
  }

=======
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
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
<<<<<<< HEAD
            Perfiles, amistades, grupos y chats.
=======
            Perfiles, amistades y chats privados.
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
          </ThemedText>
        </View>
        <Card variant="raised" style={styles.authCard}>
          <ThemedText type="smallBold">Inicia sesión para participar</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
<<<<<<< HEAD
            Necesitas una cuenta para crear grupos, enviar solicitudes y chatear.
=======
            La sesión de invitado es local y no puede crear perfiles ni conversaciones.
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
          </ThemedText>
          <Button label="Iniciar sesión" onPress={() => void signOut()} />
        </Card>
      </ScrollView>
    );
  }

<<<<<<< HEAD
  const globalErr = bannerErr || friendsState.error || chatsState.error || profileState.error;

=======
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
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
<<<<<<< HEAD
            : 'Completa tu perfil para que te encuentren'}
=======
            : 'Elige un nombre de usuario para que te encuentren.'}
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
        </ThemedText>
      </View>

      {!profileState.profile?.username ? (
        <Card style={[styles.notice, { borderColor: theme.secondary }]}>
          <ThemedText type="smallBold">Completa tu perfil</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
<<<<<<< HEAD
            Elige un nombre de usuario único para enviar y recibir solicitudes.
=======
            Un nombre de usuario único permite enviar y recibir solicitudes de amistad.
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
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
<<<<<<< HEAD
            label={
              item.key === 'requests' && incomingCount > 0
                ? `${item.label} (${incomingCount})`
                : item.label
            }
=======
            label={item.key === 'requests' && incomingCount > 0 ? `${item.label} (${incomingCount})` : item.label}
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
            selected={tab === item.key}
            onPress={() => setTab(item.key)}
          />
        ))}
      </View>

<<<<<<< HEAD
      {globalErr ? (
        <Card style={[styles.notice, { borderColor: theme.error }]}>
          <ThemedText type="small" style={{ color: theme.error }}>
            {globalErr}
=======
      {actionError || friendsState.error || chatsState.error || profileState.error ? (
        <Card style={[styles.notice, { borderColor: theme.error }]}>
          <ThemedText type="small" style={{ color: theme.error }}>
            {actionError ?? friendsState.error ?? chatsState.error ?? profileState.error}
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
          </ThemedText>
        </Card>
      ) : null}

<<<<<<< HEAD
      {tab === 'global' ? (
        <View style={styles.section}>
          <ThemedText type="subtitle">Sala Global</ThemedText>
          <Card style={styles.globalCard}>
            <View style={styles.globalRow}>
              <Avatar uri={null} name="GLOBAL" />
              <View style={styles.body}>
                <ThemedText style={styles.name}>Sala Comunitaria</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Lugar grande para hablar con toda la comunidad
                </ThemedText>
                <ThemedText type="small" style={{ color: globalCanWrite ? theme.success : theme.textSecondary }}>
                  {globalCanWrite
                    ? 'Disponible para escribir'
                    : `Espera para volver a escribir: ${formatMMSS(globalMsLeft)}`}
                </ThemedText>
              </View>
            </View>
            <Button label="Abrir sala" loading={globalBusy} onPress={() => void openGlobal()} />
            <ThemedText type="small" themeColor="textSecondary">
              El contador de 1 minuto se aplica al enviar mensajes desde la sala.
            </ThemedText>
          </Card>
        </View>
      ) : null}

      {tab === 'chats' ? (
        <View style={styles.section}>
          <ThemedText type="subtitle">Conversaciones</ThemedText>
          {chatsState.loading ? (
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                Cargando conversaciones...
              </ThemedText>
            </Card>
          ) : chatsState.chats.length === 0 ? (
            <EmptyState title="Sin conversaciones" description="Abre el perfil de un amigo para iniciar un chat." />
=======
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
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
          ) : (
            chatsState.chats.map((chat) => (
              <Card
                key={chat.chatId}
<<<<<<< HEAD
                style={styles.row}
                onPress={() =>
                  router.push({ pathname: '/chat/[chatId]', params: { chatId: chat.chatId } })
                }>
                <Avatar uri={chat.photoURL} name={chat.title} />
                <View style={styles.body}>
                  <ThemedText style={styles.name} numberOfLines={1}>
                    {chat.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {chat.lastMessageText || 'Sin mensajes'}
                  </ThemedText>
                </View>
                {chat.unreadCount > 0 ? (
                  <View style={[styles.badge, { backgroundColor: theme.secondary }]}>
=======
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
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
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
<<<<<<< HEAD
                Cargando amistades...
              </ThemedText>
            </Card>
          ) : friendsState.friends.length === 0 ? (
            <EmptyState title="Aún no tienes amistades" description="Busca personas en 'Descubrir' y envía una solicitud." />
          ) : (
            friendsState.friends.map((f) => (
              <Card key={f.uid} style={styles.row}>
                <Avatar uri={f.photoURL} name={f.displayName} />
                <Pressable
                  style={styles.body}
                  onPress={() => router.push({ pathname: '/user/[uid]', params: { uid: f.uid } })}>
                  <ThemedText style={styles.name}>{f.displayName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {f.username ? `@${f.username}` : 'Sin usuario'}
=======
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
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
                  </ThemedText>
                </Pressable>
                <Button
                  label="Mensaje"
                  variant="tonal"
                  fullWidth={false}
                  disabled={chatsState.busy}
<<<<<<< HEAD
                  onPress={() => void onMessage(f.uid)}
=======
                  onPress={() => void onMessage(friend.uid)}
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
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
<<<<<<< HEAD
            <EmptyState title="Sin solicitudes" description="Cuando alguien te envíe una solicitud, aparecerá aquí." />
          ) : (
            friendsState.incoming.map((r) => (
              <Card key={r.id} style={styles.row}>
                <Avatar uri={r.profile?.photoURL} name={r.profile?.displayName || 'Usuario'} />
                <View style={styles.body}>
                  <ThemedText style={styles.name}>{r.profile?.displayName || 'Usuario'}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {r.profile?.username ? `@${r.profile.username}` : 'Perfil'}
                  </ThemedText>
                </View>
                <View style={styles.actions}>
=======
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
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
                  <Button
                    label="Aceptar"
                    fullWidth={false}
                    disabled={friendsState.busy}
<<<<<<< HEAD
                    onPress={() => void onRespond(r.id, true)}
=======
                    onPress={() => void onRespond(request.id, true)}
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
                  />
                  <Button
                    label="Rechazar"
                    variant="text"
                    fullWidth={false}
                    disabled={friendsState.busy}
<<<<<<< HEAD
                    onPress={() => void onRespond(r.id, false)}
=======
                    onPress={() => void onRespond(request.id, false)}
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
                  />
                </View>
              </Card>
            ))
          )}

          {friendsState.outgoing.length > 0 ? (
            <>
<<<<<<< HEAD
              <ThemedText type="subtitle" style={{ marginTop: Spacing.three }}>
                Enviadas
              </ThemedText>
              {friendsState.outgoing.map((r) => (
                <Card key={r.id} style={styles.row}>
                  <Avatar uri={r.profile?.photoURL} name={r.profile?.displayName || 'Usuario'} />
                  <View style={styles.body}>
                    <ThemedText style={styles.name}>{r.profile?.displayName || 'Usuario'}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Pendiente de respuesta
=======
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
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
                    </ThemedText>
                  </View>
                </Card>
              ))}
            </>
          ) : null}
<<<<<<< HEAD
        </View>
      ) : null}

      {tab === 'groups' ? (
        <View style={styles.section}>
          <ThemedText type="subtitle">Grupos</ThemedText>
          <View style={styles.inlineRow}>
            <Button
              label="Crear grupo"
              fullWidth={false}
              onPress={() => {
                setGroupMode('create');
                setGroupErr(null);
                setGroupTitle('');
                setInviteCode('');
              }}
            />
            <Button
              label="Unirme con código"
              variant="tonal"
              fullWidth={false}
              onPress={() => {
                setGroupMode('join');
                setGroupErr(null);
                setGroupTitle('');
                setInviteCode('');
              }}
            />
          </View>
          <Card>
            <ThemedText type="small" themeColor="textSecondary">
              Crea un grupo para hablar con varias personas o únete con un código de invitación.
            </ThemedText>
          </Card>
=======

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
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
        </View>
      ) : null}

      {tab === 'discover' ? (
        <View style={styles.section}>
          <ThemedText type="subtitle">Descubrir personas</ThemedText>
          <View style={styles.searchRow}>
            <TextInput
<<<<<<< HEAD
              value={search}
              onChangeText={setSearch}
              placeholder="Nombre o @usuario"
              placeholderTextColor={theme.textSecondary}
=======
              accessibilityLabel="Buscar por nombre o usuario"
              placeholder="Nombre o @usuario…"
              placeholderTextColor={theme.textSecondary}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => void onSearch()}
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.searchInput,
<<<<<<< HEAD
                { color: theme.text, backgroundColor: theme.surface, borderColor: theme.outlineVariant },
              ]}
              onSubmitEditing={() => void onSearch()}
=======
                {
                  color: theme.text,
                  backgroundColor: theme.surface,
                  borderColor: theme.outlineVariant,
                },
              ]}
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
            />
            <Button
              label="Buscar"
              fullWidth={false}
              loading={searching}
              disabled={search.trim().length < 2}
              onPress={() => void onSearch()}
            />
          </View>
<<<<<<< HEAD
          {results.length === 0 ? (
            <EmptyState title="Encuentra personas" description="Escribe al menos 2 letras para buscar." />
          ) : (
            results.map((r) => {
              const isFriend = friendUids.has(r.uid);
              const isPending = outgoingUids.has(r.uid);
              const isSelf = r.uid === user?.uid;
              return (
                <Card key={r.uid} style={styles.row}>
                  <Avatar uri={r.photoURL} name={r.displayName} />
                  <Pressable
                    style={styles.body}
                    onPress={() => router.push({ pathname: '/user/[uid]', params: { uid: r.uid } })}>
                    <ThemedText style={styles.name}>{r.displayName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {r.username ? `@${r.username}` : 'Sin usuario'}
                    </ThemedText>
                  </Pressable>
                  {isSelf ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Tú
                    </ThemedText>
                  ) : isFriend ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Amistad
                    </ThemedText>
                  ) : isPending ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Pendiente
                    </ThemedText>
                  ) : (
=======

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
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
                    <Button
                      label="Agregar"
                      variant="tonal"
                      fullWidth={false}
                      disabled={friendsState.busy}
<<<<<<< HEAD
                      onPress={() => void onAdd(r.uid)}
                    />
=======
                      onPress={() => void onAdd(result.uid)}
                    />
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      {isSelf ? 'Tú' : isFriend ? 'Amistad' : 'Pendiente'}
                    </ThemedText>
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
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
<<<<<<< HEAD
              {groupMode === 'create' ? 'Crear grupo' : 'Unirse a un grupo'}
=======
              {groupMode === 'create' ? 'Crear grupo' : 'Unirme a un grupo'}
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
            </ThemedText>
            {groupMode === 'create' ? (
              <TextField
                label="Nombre del grupo"
<<<<<<< HEAD
                placeholder="Mi grupo"
                value={groupTitle}
                onChangeText={setGroupTitle}
                hint="Entre 2 y 60 caracteres"
=======
                placeholder="Sismos de la costa"
                value={groupTitle}
                onChangeText={setGroupTitle}
                hint="Entre 2 y 60 caracteres."
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
              />
            ) : (
              <TextField
                label="Código de invitación"
<<<<<<< HEAD
                placeholder="ABC12345"
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="characters"
                hint="Pídele el código al creador"
              />
            )}
            {groupErr ? (
              <ThemedText type="small" style={{ color: theme.error }}>
                {groupErr}
              </ThemedText>
            ) : null}
            <Button
              label={groupMode === 'create' ? 'Crear y abrir' : 'Unirme'}
              loading={groupBusy}
              onPress={() => void onCreateOrJoinGroup()}
=======
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
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
            />
            <Button label="Cancelar" variant="text" onPress={() => setGroupMode(null)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  screen: { flex: 1 },
=======
  screen: {
    flex: 1,
  },
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
  content: {
    paddingHorizontal: Spacing.four,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
<<<<<<< HEAD
  heading: { gap: 2 },
  title: { fontSize: 30, lineHeight: 36 },
  notice: { gap: Spacing.two, borderWidth: 2 },
  authCard: { gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  section: { gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  body: { flex: 1, gap: 1 },
  name: { fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  globalCard: { gap: Spacing.three },
  globalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  badge: {
=======
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
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
<<<<<<< HEAD
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
=======
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
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
  searchInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
<<<<<<< HEAD
  modalScrim: { flex: 1, justifyContent: 'center', padding: Spacing.four },
=======
  modalScrim: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
  modalCard: {
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
<<<<<<< HEAD
  modalTitle: { fontSize: 24, lineHeight: 30 },
=======
  modalTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
});
