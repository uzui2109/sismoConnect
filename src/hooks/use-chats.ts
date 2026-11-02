import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import {
  createDirectChat,
  createGroup as createGroupRequest,
  fetchEmergencyState,
  joinGroupByCode,
  markChatRead,
  sendChatMessage,
  socialErrorMessage,
  subscribeToChat,
  subscribeToChatIndex,
  subscribeToMessages,
} from '@/services/social';
import type { Chat, ChatMessage, ChatSummary } from '@/types/social';

export function useChats() {
  const { user, isConfigured, isLocalGuest } = useAuth();
  const enabled = isConfigured && user !== null && !isLocalGuest;
  const uid = enabled && user ? user.uid : null;
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) {
      setChats([]);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeToChatIndex(
      uid,
      (next) => {
        if (!active) return;
        setChats(next);
        setLoading(false);
      },
      (listenerError) => {
        console.error('[useChats] subscribeToChatIndex error:', listenerError);
        if (!active) return;
        setError((prev) => prev ?? socialErrorMessage(listenerError));
        setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [uid]);

  const openDirect = useCallback(async (otherUid: string) => {
    setBusy(true);
    try {
      const result = await createDirectChat(otherUid);
      return result.chatId;
    } finally {
      setBusy(false);
    }
  }, []);

  const createGroup = useCallback(async (title: string) => {
    setBusy(true);
    try {
      return await createGroupRequest(title);
    } finally {
      setBusy(false);
    }
  }, []);

  const joinGroup = useCallback(async (inviteCode: string) => {
    setBusy(true);
    try {
      return await joinGroupByCode(inviteCode);
    } finally {
      setBusy(false);
    }
  }, []);

  return { enabled, chats, loading, error, busy, openDirect, createGroup, joinGroup };
}

export function useChat(chatId: string | null) {
  const { user, isConfigured, isLocalGuest } = useAuth();
  const enabled = isConfigured && user !== null && !isLocalGuest;
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(chatId && enabled));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!chatId || !enabled) {
      setChat(null);
      setMessages([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    const fail = (listenerError: Error) => {
      console.error('[useChat] subscription error:', listenerError);
      if (active) {
        setError((prev) => prev ?? socialErrorMessage(listenerError));
        setLoading(false);
      }
    };

    const unsubscribeChat = subscribeToChat(
      chatId,
      (next) => {
        if (!active) return;
        setChat(next);
        setLoading(false);
      },
      fail
    );
    const unsubscribeMessages = subscribeToMessages(
      chatId,
      (next) => {
        if (active) setMessages(next);
      },
      fail
    );

    return () => {
      active = false;
      unsubscribeChat();
      unsubscribeMessages();
    };
  }, [chatId, enabled]);

  const send = useCallback(
    async (text: string, emergency = false) => {
      if (!chatId) throw new Error('Chat inválido.');
      setSending(true);
      try {
        const result = await sendChatMessage({
          chatId,
          text,
          emergency,
          clientId: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        });
        setError(null);
        return result;
      } catch (sendError) {
        setError(socialErrorMessage(sendError));
        throw sendError;
      } finally {
        setSending(false);
      }
    },
    [chatId]
  );

  const markRead = useCallback(async () => {
    if (!chatId) return;
    try {
      await markChatRead(chatId);
    } catch {
      // A missing chat index is a cache problem, not a reading blocker.
    }
  }, [chatId]);

  const emergencyStatus = useCallback(async () => {
    if (!chatId) return null;
    try {
      return await fetchEmergencyState(chatId);
    } catch {
      return null;
    }
  }, [chatId]);

  return {
    enabled,
    chat,
    messages,
    loading,
    error,
    sending,
    send,
    markRead,
    emergencyStatus,
    clearError: () => setError(null),
  };
}
