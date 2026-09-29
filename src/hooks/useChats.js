// src/hooks/useChats.js
// Chat CRUD, debounced persist, quota fallbacks, reload sanitize (~200 lines) [Batch 2]
// ═══════════════════════════════════════════════════════════════
//  useChats — chat list CRUD + persistence with quota-safe
//  fallbacks (strips image data automatically if storage fills).
//
//  Chat shape: { id, title, mode, model, webSearch, messages[],
//                createdAt, updatedAt, autoTitled }
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MODES, STORAGE_KEYS } from '../config/constants';
import { getChats, getActiveChatId, setActiveChatId } from '../lib/storage';
import { uid } from '../lib/utils';

const MAX_STORED_CHATS = 200;
const PERSIST_DEBOUNCE_MS = 400;

// After a reload, finish any message that was mid-stream.
function sanitizeLoadedChats(raw) {
  return (raw || []).map((chat) => ({
    ...chat,
    messages: (chat.messages || [])
      .filter((m) => !(m.role === 'assistant' && !(m.content || '').trim() && !(m.images?.length)))
      .map((m) => {
        if (m.status !== 'streaming') return m;
        const hasContent = !!m.content || !!m.images?.length;
        return {
          ...m,
          status: hasContent ? 'done' : 'error',
          stopped: true,
          error: hasContent ? null : 'Interrupted by page reload.',
        };
      }),
  }));
}

/** Fallback serializer: drop image data so text survives quota errors. */
function stripHeavy(chat) {
  return {
    ...chat,
    messages: (chat.messages || []).map((m) => {
      const hadImages = (m.images?.length || 0) > 0;
      return {
        ...m,
        images: hadImages ? [] : m.images,
        imageCount: hadImages ? m.images.length : m.imageCount || 0,
        attachments: m.attachments?.length
          ? m.attachments.map((a) => (a.dataUrl ? { ...a, dataUrl: null, stripped: true } : a))
          : m.attachments,
      };
    }),
  };
}

function persistChats(chats) {
  const trimmed = chats.slice(0, MAX_STORED_CHATS);
  try {
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(trimmed));
    return true;
  } catch {
    /* quota exceeded → retry without images */
  }
  const lite = trimmed.map(stripHeavy);
  try {
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(lite));
    console.warn('[nova] Storage full — chats saved without image data.');
    return true;
  } catch {
    /* still full → keep the 20 most recent */
  }
  try {
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(lite.slice(0, 20)));
    console.warn('[nova] Storage full — kept the 20 most recent chats.');
    return true;
  } catch {
    console.warn('[nova] Could not persist chats (storage unavailable).');
    return false;
  }
}

export function useChats() {
  const [chats, setChats] = useState(() => sanitizeLoadedChats(getChats()));
  const [activeChatId, setActiveId] = useState(() => getActiveChatId());

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  // Debounced persistence (coalesces streaming updates)
  useEffect(() => {
    const t = setTimeout(() => persistChats(chats), PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [chats]);

  useEffect(() => {
    setActiveChatId(activeChatId);
  }, [activeChatId]);

  const sortedChats = useMemo(
    () => [...chats].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [chats]
  );

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || null,
    [chats, activeChatId]
  );

  // ── Readers (ref-backed → always fresh inside async flows) ──
  const getChat = useCallback((id) => chatsRef.current.find((c) => c.id === id) || null, []);

  const getMessage = useCallback(
    (chatId, messageId) => getChat(chatId)?.messages.find((m) => m.id === messageId) || null,
    [getChat]
  );

  // ── Writers ──────────────────────────────────────────────────
  const newChat = useCallback(({ mode = 'chat', model, webSearch = false } = {}) => {
    const now = new Date().toISOString();
    const chat = {
      id: uid('chat'),
      title: 'New chat',
      mode,
      model: model || MODES[mode]?.defaultModel || MODES.chat.defaultModel,
      webSearch,
      messages: [],
      createdAt: now,
      updatedAt: now,
      autoTitled: false,
    };
    setChats((prev) => [chat, ...prev]);
    setActiveId(chat.id);
    return chat;
  }, []);

  const selectChat = useCallback((id) => setActiveId(id), []);

  const updateChat = useCallback((id, patch) => {
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c))
    );
  }, []);

  const renameChat = useCallback(
    (id, title) => updateChat(id, { title: String(title).slice(0, 60), autoTitled: true }),
    [updateChat]
  );

  const deleteChat = useCallback((id) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
    setActiveId((cur) => {
      if (cur !== id) return cur;
      const remaining = chatsRef.current.filter((c) => c.id !== id);
      return remaining[0]?.id ?? null;
    });
  }, []);

  const clearAllChats = useCallback(() => {
    setChats([]);
    setActiveId(null);
  }, []);

  const appendMessage = useCallback((chatId, message) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, messages: [...c.messages, message], updatedAt: new Date().toISOString() }
          : c
      )
    );
  }, []);

  const setMessages = useCallback((chatId, messages) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, messages, updatedAt: new Date().toISOString() } : c))
    );
  }, []);

  const updateMessage = useCallback((chatId, messageId, patch) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              updatedAt: new Date().toISOString(),
              messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
            }
          : c
      )
    );
  }, []);

  return {
    chats,
    sortedChats,
    activeChat,
    activeChatId,
    selectChat,
    newChat,
    updateChat,
    renameChat,
    deleteChat,
    clearAllChats,
    appendMessage,
    setMessages,
    updateMessage,
    getChat,
    getMessage,
  };
}