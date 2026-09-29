// ═══════════════════════════════════════════════════════════════
//  Nova AI Studio — FINAL App shell (Batch 5)
//  • No API key  → OnboardingScreen (skip = limited mode)
//  • With key    → full studio: Sidebar, ChatWindow, mode pills,
//    ModelSelector, Web toggle, ChatInput, Artifact banner +
//    ArtifactPanel (project preview / images / research),
//    Settings modal, keyboard shortcuts.
//  Debug routes kept: /?lab (chat harness) · /?engine (engine lab)
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, BookOpen, FolderTree, Globe, Image as ImageIcon, KeyRound,
  Plus, RotateCcw, Settings as SettingsIcon, X,
} from 'lucide-react';

import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import ModelSelector from './components/ModelSelector';
import SettingsModal from './components/SettingsModal';
import ArtifactPanel from './components/ArtifactPanel';
import OnboardingScreen from './components/OnboardingScreen';
import ChatLab from './components/ChatLab';
import EngineLab from './components/EngineLab';
import { ModeIcon } from './components/ModeBadge';

import { useSettings } from './hooks/useSettings';
import { useChats } from './hooks/useChats';
import { useChat } from './hooks/useChat';

import { MODES, MODE_LIST, OPENROUTER_KEYS_URL } from './config/constants';
import { parseProject } from './lib/project';
import { cn } from './lib/utils';

const ARTIFACT_ICONS = { project: FolderTree, images: ImageIcon, research: BookOpen };

const ARTIFACT_TEXT = {
  project: (a) => `Project ready — ${a.project.stats.count} files · ${a.project.stats.previewable ? 'live preview available' : 'download ZIP to run'}`,
  images: (a) => `${a.message?.images?.length || 0} image(s) generated — open the gallery`,
  research: () => 'Research report ready — open the reader',
};

// ── Artifact banner ───────────────────────────────────────────

function ArtifactBanner({ artifact, hidden, onOpen, onDismiss }) {
  if (!artifact || hidden) return null;
  const Icon = ARTIFACT_ICONS[artifact.type];
  return (
    <div className="mx-auto mb-2 flex w-full max-w-3xl animate-slide-up items-center gap-2.5 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600">
        <Icon size={15} className="text-white" />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-violet-100">
        {ARTIFACT_TEXT[artifact.type]?.(artifact) || 'Artifact ready'}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white shadow-glow-sm transition hover:brightness-110"
      >
        Open
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-lg p-1 text-violet-300/60 transition hover:text-white"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────

export default function App() {
  // Static route flags (set at load, never change)
  const routes = useMemo(() => {
    if (typeof window === 'undefined') return { lab: false, engine: false };
    const p = new URLSearchParams(window.location.search);
    return { lab: p.has('lab'), engine: p.has('engine') };
  }, []);

  // ── Core state & hooks ─────────────────────────────────────
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

  const [entered, setEntered] = useState(false); // "continue without key"
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 768
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [pendingText, setPendingText] = useState(null);
  const [pendingAttachments, setPendingAttachments] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => new Set());
  const [draft, setDraft] = useState({
    mode: 'chat',
    model: MODES.chat.defaultModel,
    webSearch: false,
  });

  const modelWrapRef = useRef(null);

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

  // Close the artifact panel automatically when it disappears
  useEffect(() => {
    if (!artifactRef.current) setPanelOpen(false);
  });

  // Keep a ref so the effect above can check the latest value
  const artifactRef = useRef(null);

  // ── Artifact detection (latest finished assistant message) ──
  const artifact = useMemo(() => {
    artifactRef.current = null;
    const msgs = activeChat?.messages || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role !== 'assistant') continue;
      if (m.status === 'streaming') continue;
      const content = m.content || '';
      if (!content) continue;

      // Project artifact (build mode, or explicit FILE markers)
      if (activeChat?.mode === 'build' || /###\s*FILE:/i.test(content)) {
        const proj = parseProject(content);
        const meaningful =
          proj.files.length >= 2 ||
          (proj.files.length === 1 && /FILE:/i.test(content));
        if (meaningful && proj.stats.bytes > 80) {
          const a = { type: 'project', message: m, project: proj };
          artifactRef.current = a;
          return a;
        }
      }

      // Generated images
      if (m.images?.length) {
        const a = { type: 'images', message: m };
        artifactRef.current = a;
        return a;
      }

      // Research report
      if (
        activeChat?.mode === 'research' &&
        (m.annotations?.length || content.length > 2000)
      ) {
        const a = { type: 'research', message: m };
        artifactRef.current = a;
        return a;
      }

      break; // only inspect the latest finished assistant message
    }
    return null;
  }, [activeChat?.messages, activeChat?.mode]);

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'k') {
        e.preventDefault();
        modelWrapRef.current?.querySelector('button')?.click();
      } else if (k === 'b') {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      } else if (k === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      } else if (k === 'o' && e.shiftKey) {
        e.preventDefault();
        clearError();
        newChat(draft);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, newChat, clearError]);

  // ── Toolbar handlers ───────────────────────────────────────
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
    setPanelOpen(false);
    sendMessage({ text, attachments, ...draft });
  };

  const attachImageForEdit = (dataUrl) => {
    import('./lib/files').then(({ createImageAttachment }) => {
      setPendingAttachments([createImageAttachment(dataUrl, `edit-${Date.now()}.png`)]);
    });
  };

  const canRegenerate =
    !isStreaming &&
    !!activeChat &&
    activeChat.messages.length > 0 &&
    activeChat.messages[activeChat.messages.length - 1].role === 'assistant';

  // ── Routes ─────────────────────────────────────────────────
  if (routes.lab) return <ChatLab />;
  if (routes.engine) return <EngineLab />;

  // Onboarding (skippable)
  if (!hasApiKey && !entered) {
    return (
      <OnboardingScreen
        settingsApi={settingsApi}
        onDone={() => setEntered(true)}
        onSkip={() => setEntered(true)}
      />
    );
  }

  // ── Studio ─────────────────────────────────────────────────
  return (
    <div className="app-h relative flex overflow-hidden bg-surface text-zinc-100">
      {/* ── Ambient scene (aurora + grid, purely decorative) ── */}
      <div aria-hidden="true" className="ambient" />
      <div aria-hidden="true" className="ambient-grid" />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        chats={sortedChats}
        activeChatId={activeChatId}
        onSelectChat={(id) => {
          selectChat(id);
          setPanelOpen(false);
          if (window.innerWidth < 768) setSidebarOpen(false);
        }}
        onNewChat={() => {
          clearError();
          setPanelOpen(false);
          newChat(draft);
          if (window.innerWidth < 768) setSidebarOpen(false);
        }}
        onDeleteChat={deleteChat}
        onClearAll={clearAllChats}
        hasApiKey={hasApiKey}
      />

      {/* ── Main column ── */}
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatWindow
          chat={activeChat}
          isStreaming={isStreaming}
          onOpenMenu={() => setSidebarOpen(true)}
          onRegenerate={regenerate}
          onEditMessage={editMessage}
          onPrompt={(p) => setPendingText(p)}
        />

        {/* Artifact banner */}
        <div className="px-4 pt-2">
          <ArtifactBanner
            artifact={artifact}
            hidden={dismissed.has(artifact?.message?.id)}
            onOpen={() => setPanelOpen(true)}
            onDismiss={() =>
              setDismissed((prev) => new Set([...prev, artifact.message.id]))
            }
          />
        </div>

        {/* Error banner */}
        {lastError && (
          <div className="mx-auto mt-2 flex w-full max-w-3xl items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
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
              /* Limited-mode key guard */
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
                {/* Toolbar — single scrollable row on phones, wrap on desktop */}
                <div className="no-scrollbar mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-x-visible sm:pb-0">
                  {MODE_LIST.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleModeChange(m.id)}
                      title={m.description}
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-medium transition sm:px-2 sm:py-1.5',
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

                  <div ref={modelWrapRef} className="shrink-0">
                    <ModelSelector value={draft.model} onChange={handleModelChange} />
                  </div>

                  <button
                    type="button"
                    onClick={toggleWeb}
                    title="Toggle live web search"
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-medium transition sm:px-2 sm:py-1.5',
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
                      className="shrink-0 rounded-lg border border-white/10 bg-surface-2 p-2 text-zinc-400 transition hover:text-white sm:p-1.5"
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      clearError();
                      setPanelOpen(false);
                      newChat(draft);
                    }}
                    title="New chat (Ctrl+Shift+O)"
                    className="shrink-0 rounded-lg border border-white/10 bg-surface-2 p-2 text-zinc-400 transition hover:text-white sm:p-1.5"
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    title="Settings (Ctrl+,)"
                    className="shrink-0 rounded-lg border border-white/10 bg-surface-2 p-2 text-zinc-400 transition hover:text-white sm:p-1.5"
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
                  injectedAttachments={pendingAttachments}
                  onInjectedAttachmentsConsumed={() => setPendingAttachments(null)}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Artifact slide-over ── */}
      <ArtifactPanel
        artifact={artifact}
        open={panelOpen && !!artifact && !dismissed.has(artifact?.message?.id)}
        onClose={() => setPanelOpen(false)}
        chat={activeChat}
        onAttachImage={attachImageForEdit}
      />

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