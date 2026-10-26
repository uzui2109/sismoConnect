import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import {
  blockUser,
  removeFriend,
  reportUser,
  respondFriendRequest,
  searchPublicProfiles,
  sendFriendRequest,
  socialErrorMessage,
  subscribeToBlockedProfiles,
  subscribeToFriendships,
  subscribeToIncomingRequests,
  subscribeToOutgoingRequests,
  unblockUser,
} from '@/services/social';
import type { FriendRequest, PublicProfile } from '@/types/social';

export function useFriends() {
  const { user, isConfigured, isLocalGuest } = useAuth();
  const enabled = isConfigured && user !== null && !isLocalGuest;
  const uid = enabled && user ? user.uid : null;

  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [blocked, setBlocked] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) {
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
      setBlocked([]);
      setLoading(false);
      return;
    }

    let active = true;
    const fail = (listenerError: Error) => {
      if (active) {
        setError(socialErrorMessage(listenerError));
        setLoading(false);
      }
    };

    setLoading(true);
    setError(null);
    const unsubscribeFriends = subscribeToFriendships(uid, (next) => {
      if (!active) return;
      setFriends(next.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es')));
      setLoading(false);
    }, fail);
    const unsubscribeIncoming = subscribeToIncomingRequests(uid, (next) => {
      if (active) setIncoming(next);
    }, fail);
    const unsubscribeOutgoing = subscribeToOutgoingRequests(uid, (next) => {
      if (active) setOutgoing(next);
    }, fail);
    const unsubscribeBlocked = subscribeToBlockedProfiles(uid, (next) => {
      if (active) setBlocked(next);
    }, fail);

    return () => {
      active = false;
      unsubscribeFriends();
      unsubscribeIncoming();
      unsubscribeOutgoing();
      unsubscribeBlocked();
    };
  }, [uid]);

  const search = useCallback(async (term: string) => {
    setBusy(true);
    try {
      return await searchPublicProfiles(term);
    } finally {
      setBusy(false);
    }
  }, []);

  const addFriend = useCallback(async (otherUid: string) => {
    setBusy(true);
    try {
      return await sendFriendRequest(otherUid);
    } finally {
      setBusy(false);
    }
  }, []);

  const respond = useCallback(async (requestId: string, accept: boolean) => {
    setBusy(true);
    try {
      return await respondFriendRequest(requestId, accept);
    } finally {
      setBusy(false);
    }
  }, []);

  const remove = useCallback(async (otherUid: string) => {
    setBusy(true);
    try {
      return await removeFriend(otherUid);
    } finally {
      setBusy(false);
    }
  }, []);

  const block = useCallback(async (otherUid: string) => {
    setBusy(true);
    try {
      return await blockUser(otherUid);
    } finally {
      setBusy(false);
    }
  }, []);

  const unblock = useCallback(async (otherUid: string) => {
    setBusy(true);
    try {
      return await unblockUser(otherUid);
    } finally {
      setBusy(false);
    }
  }, []);

  const report = useCallback(async (otherUid: string, reason: string, details: string) => {
    setBusy(true);
    try {
      return await reportUser(otherUid, reason, details);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    enabled,
    friends,
    incoming,
    outgoing,
    blocked,
    loading,
    error,
    busy,
    search,
    addFriend,
    respond,
    remove,
    block,
    unblock,
    report,
  };
}
