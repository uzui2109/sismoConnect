export type NotificationPrefs = {
  earthquakes: boolean;
  social: boolean;
  messages: boolean;
  friends: boolean;
  groups: boolean;
};

export type UserProfile = {
  uid: string;
  displayName: string;
  username: string | null;
  bio: string;
  photoURL: string | null;
  coverURL: string | null;
  countryCode: string | null;
  language: string;
  isPublic: boolean;
  notificationsEnabled: boolean;
  notificationPrefs: NotificationPrefs;
  unlocks: number;
  lastMessageAt: number;
  lastEmergencyAt: number;
  createdAt: number;
  updatedAt: number;
};

export type PublicProfile = {
  uid: string;
  displayName: string;
  username: string | null;
  bio: string;
  photoURL: string | null;
  coverURL: string | null;
  countryCode: string | null;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
};

export type FriendRequest = {
  id: string;
  fromUid: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'declined' | 'removed' | 'blocked' | 'unknown';
  createdAt: number;
  profile: PublicProfile | null;
};

export type Friendship = {
  id: string;
  memberIds: string[];
  createdAt: number;
  profile: PublicProfile | null;
};

export type ChatSummary = {
  chatId: string;
  type: 'direct' | 'group';
  title: string;
  photoURL: string | null;
  lastMessageText: string;
  lastMessageSenderId: string | null;
  lastMessageAt: number;
  unreadCount: number;
  updatedAt: number;
};

export type Chat = {
  id: string;
  type: 'direct' | 'group';
  title: string;
  description: string;
  photoURL: string | null;
  memberIds: string[];
  inviteCode: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  lastMessageText: string;
  lastMessageSenderId: string | null;
  lastMessageAt: number;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  emergency: boolean;
  createdAt: number;
  clientId: string | null;
};

export type RewardState = {
  unlocks: number;
  lastMessageAt: number;
  lastEmergencyAt: number;
};
