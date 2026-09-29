// src/components/ChatWindow.jsx
// Header, windowed message list, date separators, MD/PDF export
// ═══════════════════════════════════════════════════════════════
//  ChatWindow — center column: header (title, mode/model badges,
//  message count, MD/PDF export) + auto-scrolling message list.
//  Long-chat engine:
//   • Pagination — only the newest PAGE_SIZE messages mount;
//     older ones load on demand with scroll position preserved.
//   • Auto-load — an IntersectionObserver sentinel fetches the
//     previous page when the user reads near the top.
//   • Date separators between day groups.
//   • Unread badge — counts messages that arrive while the user
//     is scrolled away from the bottom.
//   • rAF-throttled stream-following (no layout thrash per token).
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowDown, ChevronsUp, FileDown, FileText, Globe, Loader2, Menu,
} from 'lucide-react';

import Message from './Message';
import WelcomeScreen from './WelcomeScreen';
import { ModeBadge } from './ModeBadge';
import { APP_NAME, APP_TAGLINE } from '../config/constants';
import { getModelLabel, modelHasWebSearch } from '../config/models';
import { exportChatMarkdown, exportChatPdf } from '../lib/exports';
import { cn } from '../lib/utils';

const NEAR_BOTTOM_PX = 90;
const PAGE_SIZE = 50;      // messages mounted at once
const LOAD_COOLDOWN = 350; // ms between sentinel-triggered page loads

// ── Date separators ───────────────────────────────────────────
function startOfDay(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function dayLabel(ts) {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(ts).toLocaleDateString([], {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}
function DateSeparator({ ts }) {
  if (!ts || Number.isNaN(new Date(ts).getTime())) return null;
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-white/10" />
      <span className="rounded-full border border-white/10 bg-surface-1 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {dayLabel(ts)}
      </span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

export default function ChatWindow({
  chat,
  isStreaming = false,
  onOpenMenu,
  onRegenerate,
  onEditMessage,
  onPrompt,
}) {
  const messages = chat?.messages || [];
  const scrollRef = useRef(null);
  const stickRef = useRef(true);
  const rafRef = useRef(0);
  const prevLenRef = useRef(0);
  const restoreRef = useRef(null);   // {prevHeight, prevTop} while paging
  const lastLoadRef = useRef(0);
  const topSentinelRef = useRef(null);
  const [showJump, setShowJump] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [exporting, setExporting] = useState(null); // 'md' | 'pdf'
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // rAF-throttled so streaming updates can't thrash layout
  const scrollToBottom = useCallback((smooth = false) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }, []);

  useEffect(() => () => rafRef.current && cancelAnimationFrame(rafRef.current), []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = dist < NEAR_BOTTOM_PX;
    setShowJump(dist > 300);
    if (stickRef.current) setUnseen(0);
  }, []);

  // Follow the stream while near the bottom; count new msgs otherwise
  useEffect(() => {
    const prev = prevLenRef.current;
    prevLenRef.current = messages.length;
    const added = messages.length - prev;
    if (stickRef.current) {
      scrollToBottom();
    } else if (added > 0 && prev > 0) {
      setUnseen((u) => u + added);
    }
  }, [messages, scrollToBottom]);

  // Reset window + scroll state when switching chats
  useEffect(() => {
    stickRef.current = true;
    setShowJump(false);
    setUnseen(0);
    setVisibleCount(PAGE_SIZE);
    prevLenRef.current = messages.length;
    requestAnimationFrame(() => scrollToBottom());
  }, [chat?.id, scrollToBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Long-chat pagination ─────────────────────────────────────
  const hiddenCount = Math.max(0, messages.length - visibleCount);
  const paged = hiddenCount > 0 ? messages.slice(hiddenCount) : messages;

  const loadEarlier = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    lastLoadRef.current = Date.now();
    restoreRef.current = { prevHeight: el.scrollHeight, prevTop: el.scrollTop };
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, messages.length));
  }, [messages.length]);

  // Keep the viewport anchored on the same content after prepending
  useLayoutEffect(() => {
    if (!restoreRef.current) return;
    const el = scrollRef.current;
    if (el) {
      const { prevHeight, prevTop } = restoreRef.current;
      el.scrollTop = el.scrollHeight - prevHeight + prevTop;
    }
    restoreRef.current = null;
  }, [visibleCount]);

  // Auto-load the previous page when the user reads near the top
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = topSentinelRef.current;
    if (!root || !sentinel || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hiddenCount > 0 &&
          Date.now() - lastLoadRef.current > LOAD_COOLDOWN
        ) {
          loadEarlier();
        }
      },
      { root, rootMargin: '240px 0px 0px 0px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hiddenCount, loadEarlier]);

  // ── Exports ─────────────────────────────────────────────────
  const handleExportMd = async () => {
    if (!chat || exporting) return;
    setExporting('md');
    try {
      exportChatMarkdown(chat, { includeReasoning: true });
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (!chat || exporting) return;
    setExporting('pdf');
    try {
      await exportChatPdf(chat, { includeReasoning: false });
    } finally {
      setExporting(null);
    }
  };

  const lastMsg = messages[messages.length - 1];

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {/* ── Header ── */}
      <header className="glass flex items-center gap-2 border-b border-white/10 px-3 py-2.5 pt-safe">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white md:hidden"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0 flex-1">
          {chat ? (
            <>
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold text-white">{chat.title}</h1>
                <ModeBadge mode={chat.mode} className="hidden shrink-0 sm:inline-flex" />
              </div>
              <p className="truncate text-[11px] text-zinc-500">
                {getModelLabel(chat.model)}
                {messages.length > 0 && (
                  <span className="text-zinc-600">
                    {' '}· {messages.length} message{messages.length === 1 ? '' : 's'}
                  </span>
                )}
                {modelHasWebSearch(chat.model) && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-cyan-400">
                    <Globe size={9} /> live web
                  </span>
                )}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-sm font-semibold text-white">{APP_NAME}</h1>
              <p className="truncate text-[11px] text-zinc-500">{APP_TAGLINE}</p>
            </>
          )}
        </div>

        {messages.length > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={handleExportMd}
              disabled={!!exporting || isStreaming}
              title="Export as Markdown"
              className="rounded-lg p-2.5 text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40 sm:p-2"
            >
              {exporting === 'md' ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={!!exporting || isStreaming}
              title="Export as PDF"
              className="rounded-lg p-2.5 text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40 sm:p-2"
            >
              {exporting === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
            </button>
          </div>
        )}
      </header>

      {/* Gradient hairline accent under the header */}
      <div className="hairline opacity-60" />

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scrollbar-thin overscroll-contain relative min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto max-w-3xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6">
          {messages.length === 0 ? (
            <WelcomeScreen onPrompt={onPrompt} />
          ) : (
            <>
              {/* Load earlier messages (long-chat pagination) */}
              {hiddenCount > 0 && (
                <div className="flex justify-center pb-2">
                  <button
                    type="button"
                    onClick={loadEarlier}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-surface-1 px-3.5 py-2 text-[11px] font-medium text-zinc-400 transition hover:border-violet-500/40 hover:text-white"
                  >
                    <ChevronsUp size={13} />
                    Load {Math.min(PAGE_SIZE, hiddenCount)} earlier message
                    {Math.min(PAGE_SIZE, hiddenCount) === 1 ? '' : 's'}
                    <span className="text-zinc-600">· {hiddenCount} hidden</span>
                  </button>
                </div>
              )}
              <div ref={topSentinelRef} aria-hidden="true" className="h-px w-full" />

              {paged.map((m, i) => {
                const prev = paged[i - 1];
                const showDay =
                  !prev || startOfDay(prev.createdAt || 0) !== startOfDay(m.createdAt || 0);
                return (
                  <div key={m.id}>
                    {showDay && <DateSeparator ts={m.createdAt} />}
                    <Message
                      message={m}
                      mode={chat?.mode || 'chat'}
                      isLast={i === paged.length - 1}
                      streaming={isStreaming && i === paged.length - 1 && m.role === 'assistant'}
                      onRegenerate={onRegenerate}
                      onEditMessage={onEditMessage}
                    />
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Scroll-to-bottom + unread badge */}
      {showJump && (
        <button
          type="button"
          onClick={() => {
            stickRef.current = true;
            setUnseen(0);
            scrollToBottom(true);
          }}
          aria-label={unseen > 0 ? `Scroll to bottom — ${unseen} new messages` : 'Scroll to bottom'}
          className="glass animate-pop-in absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 scale-100 items-center gap-1.5 rounded-full border border-white/10 py-3 pl-3 pr-3.5 text-zinc-300 shadow-glow transition ease-spring hover:border-violet-500/40 hover:text-white active:scale-95 sm:py-2.5"
        >
          <ArrowDown size={15} />
          {unseen > 0 && (
            <span className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {unseen > 99 ? '99+' : unseen}
            </span>
          )}
        </button>
      )}

      {/* Streaming hint */}
      {isStreaming && lastMsg?.role === 'assistant' && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-[11px] text-violet-300 backdrop-blur sm:right-4">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="ml-1">Nova is responding…</span>
        </div>
      )}
    </div>
  );
}