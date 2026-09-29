// ═══════════════════════════════════════════════════════════════
//  ChatLab — the full app at /?lab  (upgraded in Batch 4)
//  Sidebar + ChatWindow + mode pills + ModelSelector + ChatInput
//  (files, camera, drag & drop, paste) + Settings modal.
//  Batch 5 replaces the lab router with the final App shell.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import {
  AlertTriangle, Globe, KeyRound, Plus, RotateCcw, Settings as SettingsIcon, X,
} from 'lucide-react';

import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import ChatInput from './ChatInput';
import ModelSelector from './ModelSelector';
import SettingsModal from './SettingsModal';
import { ModeIcon } from './ModeBadge';

import { useSettings } from '../hooks/useSettings';
import { useChats } from '../hooks/useChats';
import { useChat } from '../hooks/useChat';
import { MODES, MODE_LIST, OPENROUTER_KEYS_URL } from '../config/constants';
import { cn } from '../lib/utils';

export default function ChatLab() {
  const settingsApi = useSettings();
  const { apiKey, hasApiKey, saveApiKey, settings } = settingsApi;

  const chatsApi = useChats();
  const {
    sortedChats, activeChat, activeChatId,
    selectChat, newChat, updateChat, deleteChat, clearAllChats,
  } = chatsApi;

  const {
    sendMessage, stopGeneration, regenerate, editMessage,
    isStreaming, lastError, clearError,
  } = useChat(chatsApi, settingsApi);

  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 768
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [pendingText, setPendingText] = useState(null);
  const [draft, setDraft] = useState({
    mode: 'chat',
    model: MODES.chat.defaultModel,
    webSearch: false,
  });

  // Sync toolbar when switching chats
  useEffect(() => {
    if (activeChat) {
      setDraft({
        mode: activeChat.mode || 'chat',
        model: activeChat.model,
        webSearch: !!activeChat.webSearch,
      });
    }
  }, [activeChat?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toolbar handlers ─────────────────────────────────────────
  const handleModeChange = (mode) => {
    setDraft((d) => {
      const wasDefaultModel = d.model === MODES[d.mode]?.defaultModel;
      const nextModel = wasDefaultModel ? MODES[mode].defaultModel : d.model;
      if (activeChat) updateChat(activeChat.id, { mode, model: nextModel });
      return { ...d, mode, model: nextModel };
    });
  };

  const handleModelChange = (model) => {
    setDraft((d) => ({ ...d, model }));
    if (activeChat) updateChat(activeChat.id, { model });
  };

  const toggleWeb = () => {
    setDraft((d) => {
      const webSearch = !d.webSearch;
      if (activeChat) updateChat(activeChat.id, { webSearch });
      return { ...d, webSearch };
    });
  };

  const handleSend = ({ text, attachments }) => {
    sendMessage({ text, attachments, ...draft });
  };

  const canRegenerate =
    !isStreaming &&
    !!activeChat &&
    activeChat.messages.length > 0 &&
    activeChat.messages[activeChat.messages.length - 1].role === 'assistant';

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-zinc-100">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        chats={sortedChats}
        activeChatId={activeChatId}
        onSelectChat={(id) => {
          selectChat(id);
          if (window.innerWidth < 768) setSidebarOpen(false);
        }}
        onNewChat={() => {
          clearError();
          newChat(draft);
          if (window.innerWidth < 768) setSidebarOpen(false);
        }}
        onDeleteChat={deleteChat}
        onClearAll={clearAllChats}
        hasApiKey={hasApiKey}
      />

      {/* ── Main column ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatWindow
          chat={activeChat}
          isStreaming={isStreaming}
          onOpenMenu={() => setSidebarOpen(true)}
          onRegenerate={regenerate}
          onEditMessage={editMessage}
          onPrompt={(p) => setPendingText(p)}
        />

        {/* ── Error banner ── */}
        {lastError && (
          <div className="mx-auto mt-2 flex w-[calc(100%-2rem)] max-w-3xl items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1 break-words">
              {lastError.message}
              {lastError.hint ? ` — ${lastError.hint}` : ''}
            </span>
            <button
              type="button"
              onClick={regenerate}
              className="shrink-0 rounded-lg border border-red-500/30 px-2 py-1 text-xs font-medium text-red-200 hover:bg-red-500/20"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss error"
              className="shrink-0 rounded-lg p-1 hover:bg-red-500/20"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Input area ── */}
        <div className="hairline" />
        <div className="glass pb-safe p-3">
          <div className="mx-auto max-w-3xl">
            {!hasApiKey ? (
              /* API key guard */
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
                  <KeyRound size={15} /> Add your OpenRouter API key to start
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="password"
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveApiKey(keyDraft)}
                    placeholder="sk-or-v1-..."
                    spellCheck={false}
                    className="flex-1 rounded-xl border border-white/10 bg-surface-2 px-3.5 py-2.5 font-mono text-sm outline-none focus:border-amber-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => saveApiKey(keyDraft)}
                    className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400"
                  >
                    Save key
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-amber-200/60">
                  Get one at{' '}
                  <a href={OPENROUTER_KEYS_URL} target="_blank" rel="noreferrer" className="underline">
                    openrouter.ai/keys
                  </a>{' '}
                  · stored only in this browser
                </p>
              </div>
            ) : (
              <>
                {/* Toolbar */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {MODE_LIST.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleModeChange(m.id)}
                      title={m.description}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition',
                        draft.mode === m.id
                          ? cn('border-transparent bg-gradient-to-r text-white shadow-glow-sm', m.gradient)
                          : 'border-white/10 bg-surface-2 text-zinc-500 hover:text-zinc-300'
                      )}
                    >
                      <ModeIcon mode={m.id} size={12} />
                      <span className="hidden sm:inline">{m.name}</span>
                    </button>
                  ))}

                  <div className="mx-0.5 hidden h-5 w-px bg-white/10 sm:block" />

                  <ModelSelector value={draft.model} onChange={handleModelChange} />

                  <button
                    type="button"
                    onClick={toggleWeb}
                    title="Toggle live web search"
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition',
                      draft.webSearch
                        ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300'
                        : 'border-white/10 bg-surface-2 text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    <Globe size={12} /> Web
                  </button>

                  <div className="flex-1" />

                  {canRegenerate && (
                    <button
                      type="button"
                      onClick={regenerate}
                      title="Regenerate last response"
                      className="rounded-lg border border-white/10 bg-surface-2 p-1.5 text-zinc-400 transition hover:text-white"
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      clearError();
                      newChat(draft);
                    }}
                    title="New chat"
                    className="rounded-lg border border-white/10 bg-surface-2 p-1.5 text-zinc-400 transition hover:text-white"
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    title="Settings"
                    className="rounded-lg border border-white/10 bg-surface-2 p-1.5 text-zinc-400 transition hover:text-white"
                  >
                    <SettingsIcon size={13} />
                  </button>
                </div>

                {/* Composer */}
                <ChatInput
                  onSend={handleSend}
                  onStop={stopGeneration}
                  isStreaming={isStreaming}
                  mode={draft.mode}
                  sendOnEnter={settings.sendOnEnter}
                  injected={pendingText}
                  onInjectedConsumed={() => setPendingText(null)}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Settings ── */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settingsApi={settingsApi}
        onClearAllChats={clearAllChats}
      />
    </div>
  );
}