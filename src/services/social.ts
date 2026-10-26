import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { getFirebaseFirestore, getFirebaseFunctions } from '@/lib/firebase';
import type {
  Chat,
  ChatMessage,
  ChatSummary,
  FriendRequest,
  NotificationPrefs,
  PublicProfile,
  RewardState,
  UserProfile,
} from '@/types/social';

export function toMillis(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function publicProfileFromData(uid: string, data: DocumentData): PublicProfile {
  return {
    uid,
    displayName: stringValue(data.displayName, 'Explorador sísmico'),
    username: nullableString(data.username),
    bio: stringValue(data.bio),
    photoURL: nullableString(data.photoURL),
    coverURL: nullableString(data.coverURL),
    countryCode: nullableString(data.countryCode),
    isPublic: data.isPublic !== false,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

function userProfileFromData(uid: string, data: DocumentData): UserProfile {
  return {
    uid,
    displayName: stringValue(data.displayName, 'Explorador sísmico'),
    username: nullableString(data.username),
    bio: stringValue(data.bio),
    photoURL: nullableString(data.photoURL),
    coverURL: nullableString(data.coverURL),
    countryCode: nullableString(data.countryCode),
    language: stringValue(data.language, 'es'),
    isPublic: data.isPublic !== false,
    notificationsEnabled: data.notificationsEnabled === true,
    notificationPrefs: {
      earthquakes: data.notificationPrefs?.earthquakes !== false,
      social: data.notificationPrefs?.social !== false,
      messages: data.notificationPrefs?.messages !== false,
      friends: data.notificationPrefs?.friends !== false,
      groups: data.notificationPrefs?.groups !== false,
    },
    unlocks: Math.max(0, Math.floor(Number(data.unlocks) || 0)),
    lastMessageAt: toMillis(data.lastMessageAt),
    lastEmergencyAt: toMillis(data.lastEmergencyAt),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

export function subscribeToOwnProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    doc(getFirebaseFirestore(), 'users', uid),
    (snapshot) => onData(snapshot.exists() ? userProfileFromData(uid, snapshot.data()) : null),
    (error) => onError?.(error)
  );
}

export function subscribeToPublicProfile(
  uid: string,
  onData: (profile: PublicProfile | null) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    doc(getFirebaseFirestore(), 'publicProfiles', uid),
    (snapshot) => onData(snapshot.exists() ? publicProfileFromData(uid, snapshot.data()) : null),
    (error) => onError?.(error)
  );
}

export async function getPublicProfiles(uids: string[]): Promise<PublicProfile[]> {
  const unique = [...new Set(uids)].filter(Boolean);
  if (unique.length === 0) return [];
  const db = getFirebaseFirestore();
  const snapshots = await Promise.all(
    unique.map((uid) => getDoc(doc(db, 'publicProfiles', uid)))
  );
  return snapshots
    .map((snapshot, index) =>
      snapshot.exists() ? publicProfileFromData(unique[index], snapshot.data()) : null
    )
    .filter((profile): profile is PublicProfile => profile !== null);
}

export async function getPublicProfile(uid: string): Promise<PublicProfile | null> {
  const snapshot = await getDoc(doc(getFirebaseFirestore(), 'publicProfiles', uid));
  return snapshot.exists() ? publicProfileFromData(uid, snapshot.data()) : null;
}

export async function searchPublicProfiles(term: string): Promise<PublicProfile[]> {
  const normalized = term.trim().toLowerCase();
  if (normalized.length < 2) return [];
  const db = getFirebaseFirestore();
  const found = new Map<string, PublicProfile>();

  if (/^[a-z0-9_]{3,20}$/.test(normalized)) {
    const usernameSnap = await getDoc(doc(db, 'usernames', normalized));
    const uid = usernameSnap.exists() ? stringValue(usernameSnap.data().uid) : '';
    if (uid) {
      const profile = await getPublicProfile(uid);
      if (profile) found.set(profile.uid, profile);
    }
  }

  const usernameQuery = query(
    collection(db, 'publicProfiles'),
    orderBy('username'),
    where('username', '>=', normalized),
    where('username', '<=', `${normalized}\uf8ff`),
    limit(8)
  );
  const displayQuery = query(
    collection(db, 'publicProfiles'),
    orderBy('displayName'),
    where('displayName', '>=', normalized),
    where('displayName', '<=', `${normalized}\uf8ff`),
    limit(8)
  );

  const [usernameResults, displayResults] = await Promise.all([
    getDocs(usernameQuery),
    getDocs(displayQuery),
  ]);
  for (const snapshot of [...usernameResults.docs, ...displayResults.docs]) {
    if (!found.has(snapshot.id)) {
      found.set(snapshot.id, publicProfileFromData(snapshot.id, snapshot.data()));
    }
  }

  return [...found.values()].slice(0, 12);
}

export function subscribeToFriendships(
  uid: string,
  onData: (friends: PublicProfile[]) => void,
  onError?: (error: Error) => void
) {
  const db = getFirebaseFirestore();
  let active = true;
  const stop = onSnapshot(
    query(collection(db, 'friendships'), where('memberIds', 'array-contains', uid)),
    (snapshot) => {
      const otherUids = snapshot.docs
        .map((document) => (document.data().memberIds as string[] | undefined) ?? [])
        .map((members) => members.find((member) => member !== uid))
        .filter((value): value is string => Boolean(value));
      void getPublicProfiles(otherUids).then((friends) => {
        if (active) onData(friends);
      });
    },
    (error) => onError?.(error)
  );

  return () => {
    active = false;
    stop();
  };
}

function subscribeToRequests(
  uid: string,
  field: 'fromUid' | 'toUid',
  onData: (requests: FriendRequest[]) => void,
  onError?: (error: Error) => void
) {
  const db = getFirebaseFirestore();
  let active = true;
  const unsubscribe = onSnapshot(
    query(collection(db, 'friendRequests'), where(field, '==', uid)),
    (snapshot) => {
      const pending = snapshot.docs
        .map((document) => {
          const data = document.data();
          return {
            id: document.id,
            fromUid: stringValue(data.fromUid),
            toUid: stringValue(data.toUid),
            status: stringValue(data.status, 'unknown') as FriendRequest['status'],
            createdAt: toMillis(data.createdAt),
          };
        })
        .filter((request) => request.status === 'pending');
      const profileUids = pending.map((request) =>
        field === 'toUid' ? request.fromUid : request.toUid
      );
      void getPublicProfiles(profileUids).then((profiles) => {
        if (!active) return;
        const byUid = new Map(profiles.map((profile) => [profile.uid, profile]));
        onData(
          pending
            .map((request) => ({
              ...request,
              profile:
                byUid.get(field === 'toUid' ? request.fromUid : request.toUid) ?? null,
            }))
            .sort((a, b) => b.createdAt - a.createdAt)
        );
      });
    },
    (error) => onError?.(error)
  );

  return () => {
    active = false;
    unsubscribe();
  };
}

export function subscribeToIncomingRequests(
  uid: string,
  onData: (requests: FriendRequest[]) => void,
  onError?: (error: Error) => void
) {
  return subscribeToRequests(uid, 'toUid', onData, onError);
}

export function subscribeToOutgoingRequests(
  uid: string,
  onData: (requests: FriendRequest[]) => void,
  onError?: (error: Error) => void
) {
  return subscribeToRequests(uid, 'fromUid', onData, onError);
}

export function subscribeToBlockedProfiles(
  uid: string,
  onData: (profiles: PublicProfile[]) => void,
  onError?: (error: Error) => void
) {
  const db = getFirebaseFirestore();
  let active = true;
  const unsubscribe = onSnapshot(
    query(collection(db, 'blocks'), where('blockerUid', '==', uid)),
    (snapshot) => {
      const blockedUids = snapshot.docs
        .map((document) => stringValue(document.data().blockedUid))
        .filter(Boolean);
      void getPublicProfiles(blockedUids).then((profiles) => {
        if (active) onData(profiles);
      });
    },
    (error) => onError?.(error)
  );

  return () => {
    active = false;
    unsubscribe();
  };
}

export function subscribeToChatIndex(
  uid: string,
  onData: (chats: ChatSummary[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    query(
      collection(getFirebaseFirestore(), 'users', uid, 'chatIndex'),
      orderBy('lastMessageAt', 'desc'),
      limit(50)
    ),
    (snapshot) => {
      onData(
        snapshot.docs.map((document) => {
          const data = document.data();
          return {
            chatId: stringValue(data.chatId, document.id),
            type: data.type === 'direct' ? 'direct' : 'group',
            title: stringValue(data.title, 'Chat'),
            photoURL: nullableString(data.photoURL),
            lastMessageText: stringValue(data.lastMessageText),
            lastMessageSenderId: nullableString(data.lastMessageSenderId),
            lastMessageAt: toMillis(data.lastMessageAt),
            unreadCount: Math.max(0, Number(data.unreadCount) || 0),
            updatedAt: toMillis(data.updatedAt),
          };
        })
      );
    },
    (error) => onError?.(error)
  );
}

function chatFromData(id: string, data: DocumentData): Chat {
  return {
    id,
    type: data.type === 'direct' ? 'direct' : 'group',
    title: stringValue(data.title, 'Chat'),
    description: stringValue(data.description),
    photoURL: nullableString(data.photoURL),
    memberIds: Array.isArray(data.memberIds)
      ? data.memberIds.filter((value): value is string => typeof value === 'string')
      : [],
    inviteCode: nullableString(data.inviteCode),
    createdBy: stringValue(data.createdBy),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    lastMessageText: stringValue(data.lastMessageText),
    lastMessageSenderId: nullableString(data.lastMessageSenderId),
    lastMessageAt: toMillis(data.lastMessageAt),
  };
}

export function subscribeToChat(
  chatId: string,
  onData: (chat: Chat | null) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    doc(getFirebaseFirestore(), 'chats', chatId),
    (snapshot) => onData(snapshot.exists() ? chatFromData(chatId, snapshot.data()) : null),
    (error) => onError?.(error)
  );
}

export function subscribeToMessages(
  chatId: string,
  onData: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    query(
      collection(getFirebaseFirestore(), 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(200)
    ),
    (snapshot) => {
      onData(
        snapshot.docs.map((document) => {
          const data = document.data();
          return {
            id: document.id,
            senderId: stringValue(data.senderId),
            text: stringValue(data.text),
            emergency: data.emergency === true,
            createdAt: toMillis(data.createdAt),
            clientId: nullableString(data.clientId),
          };
        })
      );
    },
    (error) => onError?.(error)
  );
}

async function invoke<TInput extends Record<string, unknown>, TOutput>(
  name: string,
  data: TInput
): Promise<TOutput> {
  const callable = httpsCallable<TInput, TOutput>(getFirebaseFunctions(), name);
  const result = await callable(data);
  return result.data;
}

export function bootstrapProfile() {
  return invoke<Record<string, never>, UserProfile>('bootstrapProfile', {});
}

export function claimUsername(username: string) {
  return invoke<{ username: string }, { username: string }>('claimUsername', { username });
}

export function saveProfile(input: {
  displayName: string;
  bio: string;
  countryCode: string | null;
  language: string;
  isPublic: boolean;
  notificationsEnabled: boolean;
  photoURL: string | null;
  coverURL: string | null;
}) {
  return invoke<typeof input & Record<string, unknown>, UserProfile>('updateProfile', input);
}

export function updateNotificationPrefs(prefs: Partial<NotificationPrefs>) {
  return invoke<Partial<NotificationPrefs>, NotificationPrefs>('updateNotificationPrefs', prefs);
}

export function sendFriendRequest(uid: string) {
  return invoke<{ uid: string }, { requestId: string; status: string }>('sendFriendRequest', {
    uid,
  });
}

export function respondFriendRequest(requestId: string, accept: boolean) {
  return invoke<{ requestId: string; accept: boolean }, { status: string }>(
    'respondFriendRequest',
    { requestId, accept }
  );
}

export function removeFriend(uid: string) {
  return invoke<{ uid: string }, { removed: boolean }>('removeFriend', { uid });
}

export function blockUser(uid: string) {
  return invoke<{ uid: string }, { blocked: boolean }>('blockUser', { uid });
}

export function unblockUser(uid: string) {
  return invoke<{ uid: string }, { blocked: boolean }>('unblockUser', { uid });
}

export function reportUser(uid: string, reason: string, details: string) {
  return invoke<{ uid: string; reason: string; details: string }, { reportId: string }>(
    'reportUser',
    { uid, reason, details }
  );
}

export function createDirectChat(uid: string) {
  return invoke<{ uid: string }, { chatId: string }>('createDirectChat', { uid });
}

export function createGroup(title: string) {
  return invoke<{ title: string }, { chatId: string; inviteCode: string }>('createGroup', {
    title,
  });
}

export function joinGroupByCode(inviteCode: string) {
  return invoke<{ inviteCode: string }, { chatId: string }>('joinGroupByCode', { inviteCode });
}

export function leaveGroup(chatId: string) {
  return invoke<{ chatId: string }, { left: boolean }>('leaveGroup', { chatId });
}

export function updateGroup(chatId: string, title: string, description: string) {
  return invoke<
    { chatId: string; title: string; description: string },
    { title: string; description: string }
  >('updateGroup', { chatId, title, description });
}

export function regenerateInviteCode(chatId: string) {
  return invoke<{ chatId: string }, { inviteCode: string }>('regenerateInviteCode', {
    chatId,
  });
}

export function removeGroupMember(chatId: string, uid: string) {
  return invoke<{ chatId: string; uid: string }, { removed: boolean }>('removeGroupMember', {
    chatId,
    uid,
  });
}

export function deleteGroup(chatId: string) {
  return invoke<{ chatId: string }, { deleted: boolean }>('deleteGroup', { chatId });
}

export function sendChatMessage(input: {
  chatId: string;
  text: string;
  emergency: boolean;
  clientId: string;
}) {
  return invoke<
    typeof input & Record<string, unknown>,
    { messageId: string; usedUnlock: boolean; nextAllowedAt: number }
  >('sendMessage', input);
}

export function markChatRead(chatId: string) {
  return invoke<{ chatId: string }, { read: boolean }>('markChatRead', { chatId });
}

export function fetchRewardState() {
  return invoke<Record<string, never>, RewardState>('rewardState', {});
}

export function fetchEmergencyState(chatId: string) {
  return invoke<
    { chatId: string },
    { lastEmergencyAt: number; nextAllowedAt: number }
  >('emergencyState', { chatId });
}

export function socialErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.replace(/^Firebase:\s*/i, '').replace(/\s*\(.*\)\.?$/, '');
    }
  }
  return 'No se pudo completar la operación.';
}

export { chatFromData };
