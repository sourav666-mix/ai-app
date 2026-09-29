// src/components/Sidebar.jsx
// Chat list, search, drawer, footer (~185 lines) [Batch 3]
// ═══════════════════════════════════════════════════════════════
//  Sidebar — brand, new chat, search, chat list (mode icon,
//  model label, relative time, delete) and footer (key status,
//  clear-all, local-storage note). Mobile: overlay drawer.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { Plus, Search, Sparkles, Trash2, X } from 'lucide-react';

import { ModeIcon } from './ModeBadge';
import { APP_NAME } from '../config/constants';
import { getModelLabel } from '../config/models';
import { cn, relativeTime } from '../lib/utils';

export default function Sidebar({
  open = true,
  onClose,
  chats = [],
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onClearAll,
  hasApiKey = false,
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(
      (c) =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.messages || []).some((m) => (m.content || '').toLowerCase().includes(q))
    );
  }, [chats, query]);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-md md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'glass fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-white/10 transition-transform duration-300 ease-spring md:relative md:z-10 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3.5 pt-safe">
          <div className="grid h-8 w-8 animate-float place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 shadow-glow">
            <Sparkles size={15} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold text-white">{APP_NAME}</h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-white md:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {/* New chat */}
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition ease-spring hover:shadow-glow hover:brightness-110 active:scale-[.98]"
          >
            <Plus size={15} /> New chat
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2 pt-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats…"
              className="w-full rounded-lg border border-white/10 bg-surface-2 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-violet-500/50"
            />
          </div>
        </div>

        {/* Chat list */}
        <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-zinc-600">
              {query ? 'No chats match your search.' : 'No chats yet — start one!'}
            </p>
          )}
          {filtered.map((c) => {
            const active = c.id === activeChatId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectChat(c.id)}
                className={cn(
                  'group relative flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition ease-spring sm:py-2',
                  active
                    ? 'border border-violet-500/30 bg-gradient-to-r from-violet-500/15 to-fuchsia-500/[0.04]'
                    : 'border border-transparent hover:bg-white/5'
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-violet-400 to-fuchsia-500 shadow-glow-sm"
                  />
                )}
                <span
                  className={cn(
                    'mt-0.5 shrink-0 rounded-md p-1.5',
                    active ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-zinc-500'
                  )}
                >
                  <ModeIcon mode={c.mode} size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-[13px] font-medium',
                      active ? 'text-white' : 'text-zinc-300'
                    )}
                  >
                    {c.title || 'New chat'}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-zinc-600">
                    {getModelLabel(c.model)} · {relativeTime(c.updatedAt)}
                  </span>
                </span>
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Delete ${c.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat?.(c.id);
                  }}
                  className="shrink-0 rounded-md p-2 text-zinc-600 opacity-100 transition hover:bg-red-500/10 hover:text-red-400 sm:p-1 md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="space-y-2 border-t border-white/10 px-3 py-3 pb-safe">
          <div className="flex items-center gap-2 px-1 text-[11px]">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                hasApiKey ? 'bg-emerald-400' : 'bg-amber-400'
              )}
            />
            <span className="text-zinc-500">
              {hasApiKey ? 'API key active' : 'No API key — add one to chat'}
            </span>
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] text-zinc-700">Chats stored locally</span>
            <button
              type="button"
              onClick={() => {
                if (chats.length && window.confirm('Delete ALL chats? This cannot be undone.')) {
                  onClearAll?.();
                }
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={11} /> Clear all
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}