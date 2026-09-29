// src/hooks/useChat.js
// Streaming engine: send/stop/regenerate/edit, ':online', titles (~280 lines) [Batch 2+5 -- B5 patch: enhanceImagePrompts toggle]
// ═══════════════════════════════════════════════════════════════
//  useChat — the streaming engine.
//  send / stop / regenerate / edit-and-resend, mode system prompts,
//  ':online' web search, image generation, auto chat titles.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { MODES, SYSTEM_PROMPTS } from '../config/constants';
import {
  streamChat,
  generateImage,
  generateChatTitle,
  applyWebSearch,
  OpenRouterError,
} from '../lib/openrouter';
import { buildUserApiMessage } from '../lib/files';
import { uid } from '../lib/utils';

const MAX_HISTORY_MESSAGES = 60;

// Perplexity Sonar models search the web natively — no ':online' suffix.
const isNativeSearchModel = (id = '') => (id || '').startsWith('perplexity/');

function buildSystemPrompt({ mode, settings, webSearch }) {
  const parts = [SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.chat];
  parts.push(`Today's date: ${new Date().toISOString().slice(0, 10)}.`);
  if (webSearch) {
    parts.push(
      'Live web search is ENABLED for this reply (via OpenRouter). Ground factual claims in fresh results and cite sources as markdown links.'
    );
  }
  const override = settings?.systemPromptOverride?.trim();
  if (override) {
    parts.push(`Additional instructions from the user (highest priority):\n${override}`);
  }
  return parts.join('\n\n');
}

function historyToApiMessages(history, systemPrompt) {
  const out = [{ role: 'system', content: systemPrompt }];
  for (const m of history.slice(-MAX_HISTORY_MESSAGES)) {
    if (m.role === 'user') {
      out.push(buildUserApiMessage(m.content, m.attachments || []));
    } else if (m.role === 'assistant') {
      const text = (m.content || '').trim();
      const note = m.images?.length ? `\n\n[You generated ${m.images.length} image(s) for the user.]` : '';
      if (text || note) out.push({ role: 'assistant', content: text + note });
    }
  }
  // Some providers reject histories starting with an assistant turn
  while (out.length > 1 && out[1].role === 'assistant') out.splice(1, 1);
  return out;
}

function findImageAttachment(userMsg) {
  return (
    (userMsg?.attachments || []).find(
      (a) => a.status === 'ready' && a.kind === 'image' && a.dataUrl
    ) || null
  );
}

export function useChat(chatsApi, settingsApi) {
  const { apiKey, hasApiKey, settings } = settingsApi;
  const {
    activeChat,
    appendMessage,
    updateMessage,
    getMessage,
    setMessages,
    updateChat,
    newChat,
    renameChat,
    getChat,
  } = chatsApi;

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingChatId, setStreamingChatId] = useState(null);
  const [lastError, setLastError] = useState(null);
  const abortRef = useRef(null);
  const streamingRef = useRef(false);

  // Abort any in-flight request if the app unmounts
  useEffect(() => () => abortRef.current?.abort(), []);

  const stopGeneration = useCallback(() => abortRef.current?.abort(), []);

  const maybeAutoTitle = useCallback(
    (chatId, userText) => {
      if (!settings.autoTitle || !userText) return;
      const chat = getChat(chatId);
      if (!chat || chat.autoTitled) return;
      generateChatTitle(apiKey, userText).then((title) => renameChat(chatId, title));
    },
    [settings.autoTitle, apiKey, getChat, renameChat]
  );

  const runAssistant = useCallback(
    async ({ chatId, mode, model, webSearch, history, userTextForTitle }) => {
      if (!hasApiKey) {
        setLastError({ message: 'No OpenRouter API key set.', hint: 'Add your key in Settings first.' });
        return;
      }

      const assistantId = uid('msg');
      appendMessage(chatId, {
        id: assistantId,
        role: 'assistant',
        content: '',
        reasoning: '',
        images: [],
        annotations: [],
        attachments: [],
        model,
        createdAt: new Date().toISOString(),
        status: 'streaming',
      });

      const controller = new AbortController();
      abortRef.current = controller;
      streamingRef.current = true;
      setIsStreaming(true);
      setStreamingChatId(chatId);
      setLastError(null);

      const effectiveModel =
        webSearch && !isNativeSearchModel(model) ? applyWebSearch(model, true) : model;
      const modeConfig = MODES[mode] || MODES.chat;
      const maxTokens = settings.maxTokens || undefined;

      try {
        if (mode === 'image') {
          // ── Image generation / editing (non-streaming, image modality) ──
          const lastUser = [...history].reverse().find((m) => m.role === 'user');
          const editImg = findImageAttachment(lastUser);
          const { images, text } = await generateImage({
            apiKey,
            model,
            prompt: lastUser?.content || '',
            images: editImg ? [editImg.dataUrl] : [],
            signal: controller.signal,
            systemPrompt: SYSTEM_PROMPTS.image,
          });
          updateMessage(chatId, assistantId, {
            content: text || (images.length ? 'Here is your generated image.' : 'No image was returned — try another model.'),
            images,
            status: 'done',
          });
        } else {
          // ── Streaming chat / research / search / build ──
          const messages = historyToApiMessages(
            history,
            buildSystemPrompt({ mode, settings, webSearch })
          );
          const result = await streamChat({
            apiKey,
            model: effectiveModel,
            messages,
            temperature: modeConfig.temperature ?? 0.7,
            maxTokens,
            signal: controller.signal,
            onText: (_delta, full) => updateMessage(chatId, assistantId, { content: full }),
            onReasoning: (_delta, full) => updateMessage(chatId, assistantId, { reasoning: full }),
            onImages: (imgs) => updateMessage(chatId, assistantId, { images: [...imgs] }),
            onAnnotations: (ann) => updateMessage(chatId, assistantId, { annotations: [...ann] }),
          });
          updateMessage(chatId, assistantId, {
            status: 'done',
            usage: result.usage || null,
            finishReason: result.finishReason || null,
          });
        }
        maybeAutoTitle(chatId, userTextForTitle);
      } catch (err) {
        if (err?.name === 'AbortError') {
          const partial = getMessage(chatId, assistantId);
          const hasContent = !!partial && (!!partial.content || !!partial.images?.length);
          updateMessage(chatId, assistantId, {
            status: hasContent ? 'done' : 'error',
            stopped: true,
            error: hasContent ? null : 'Generation stopped before any output.',
          });
        } else {
          const message = err?.message || 'Request failed.';
          setLastError({ message, hint: err?.hint || '' });
          updateMessage(chatId, assistantId, {
            status: 'error',
            error: err?.hint ? `${message} — ${err.hint}` : message,
          });
        }
      } finally {
        streamingRef.current = false;
        setIsStreaming(false);
        setStreamingChatId(null);
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [apiKey, hasApiKey, settings, appendMessage, updateMessage, getMessage, maybeAutoTitle]
  );

  const sendMessage = useCallback(
    async ({ text, attachments = [], mode, model, webSearch }) => {
      if (streamingRef.current) return;
      let chat = activeChat;
      if (!chat) chat = newChat({ mode, model, webSearch });

      const useMode = mode || chat.mode || 'chat';
      const useModel = model || chat.model;
      const useWebSearch = webSearch ?? chat.webSearch ?? false;
      if (useMode !== chat.mode || useModel !== chat.model || useWebSearch !== chat.webSearch) {
        updateChat(chat.id, { mode: useMode, model: useModel, webSearch: useWebSearch });
      }

      const userMsg = {
        id: uid('msg'),
        role: 'user',
        content: text,
        attachments,
        createdAt: new Date().toISOString(),
        status: 'done',
      };
      const history = [...chat.messages, userMsg];
      appendMessage(chat.id, userMsg);

      await runAssistant({
        chatId: chat.id,
        mode: useMode,
        model: useModel,
        webSearch: useWebSearch,
        history,
        userTextForTitle: text,
      });
    },
    [activeChat, newChat, updateChat, appendMessage, runAssistant]
  );

  /** Re-run the last exchange (drops trailing assistant messages). */
  const regenerate = useCallback(async () => {
    if (streamingRef.current || !activeChat?.messages?.length) return;
    const msgs = [...activeChat.messages];
    while (msgs.length && msgs[msgs.length - 1].role !== 'user') msgs.pop();
    const lastUser = msgs[msgs.length - 1];
    if (!lastUser) return;
    setMessages(activeChat.id, msgs);
    await runAssistant({
      chatId: activeChat.id,
      mode: activeChat.mode || 'chat',
      model: activeChat.model,
      webSearch: activeChat.webSearch,
      history: msgs,
      userTextForTitle: lastUser.content,
    });
  }, [activeChat, setMessages, runAssistant]);

  /** Edit a user message and re-run everything after it. */
  const editMessage = useCallback(
    async (messageId, newText) => {
      if (streamingRef.current || !activeChat) return;
      const idx = activeChat.messages.findIndex((m) => m.id === messageId);
      if (idx === -1 || activeChat.messages[idx].role !== 'user') return;
      const history = [
        ...activeChat.messages.slice(0, idx),
        { ...activeChat.messages[idx], content: newText },
      ];
      setMessages(activeChat.id, history);
      await runAssistant({
        chatId: activeChat.id,
        mode: activeChat.mode || 'chat',
        model: activeChat.model,
        webSearch: activeChat.webSearch,
        history,
        userTextForTitle: newText,
      });
    },
    [activeChat, setMessages, runAssistant]
  );

  const clearError = useCallback(() => setLastError(null), []);

  return {
    sendMessage,
    stopGeneration,
    regenerate,
    editMessage,
    isStreaming,
    streamingChatId,
    lastError,
    clearError,
  };
}