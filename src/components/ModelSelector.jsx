// src/components/ModelSelector.jsx
// Palette picker, favorites, caps (~270 lines) [Batch 4]
// ═══════════════════════════════════════════════════════════════
//  ModelSelector — command-palette style picker.
//  Trigger shows the current model; panel opens UPWARD (bottom
//  toolbar) with search, favorites section, provider groups,
//  capability icons, context size, star-to-favorite.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Brain, Check, ChevronDown, Eye, Globe, Image as ImageIcon, Search, Star,
} from 'lucide-react';

import {
  PROVIDERS,
  getAllModels,
  getModelLabel,
  groupModelsByProvider,
  searchModels,
  formatContextLength,
} from '../config/models';
import { getFavoriteModels, toggleFavoriteModel } from '../lib/storage';
import { cn } from '../lib/utils';

const CAP_ICONS = {
  vision: Eye,
  reasoning: Brain,
  webSearch: Globe,
  imageGen: ImageIcon,
};

function CapIcons({ capabilities }) {
  const active = Object.keys(CAP_ICONS).filter((k) => capabilities?.[k]);
  if (!active.length) return null;
  return (
    <span className="hidden items-center gap-0.5 sm:flex">
      {active.map((k) => {
        const Icon = CAP_ICONS[k];
        return (
          <span key={k} title={k} className="text-violet-400/80">
            <Icon size={11} />
          </span>
        );
      })}
    </span>
  );
}

function ModelRow({ m, selected, isFav, onSelect, onToggleFav }) {
  const p = PROVIDERS[m.provider];
  return (
    <button
      type="button"
      onClick={() => onSelect(m.id)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition',
        selected ? 'bg-violet-500/15' : 'hover:bg-white/5'
      )}
    >
      <span
        className={cn(
          'grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br text-[9px] font-bold text-white',
          p?.badge || PROVIDERS.custom.badge
        )}
      >
        {p?.initial || '+'}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-zinc-200">{m.name}</span>
          {m.featured && <Star size={10} className="shrink-0 fill-amber-400 text-amber-400" />}
          {!m.builtin && (
            <span className="shrink-0 rounded bg-violet-500/20 px-1 text-[8px] font-bold uppercase tracking-wide text-violet-300">
              custom
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[10px] text-zinc-600">
          {m.id} · {formatContextLength(m.contextLength)} ctx
        </span>
      </span>

      <CapIcons capabilities={m.capabilities} />

      <span
        role="button"
        tabIndex={-1}
        aria-label={isFav ? 'Unfavorite' : 'Favorite'}
        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFav(m.id);
        }}
        className={cn(
          'shrink-0 rounded-md p-1 transition',
          isFav
            ? 'text-amber-400'
            : 'text-zinc-700 hover:bg-white/5 hover:text-zinc-400'
        )}
      >
        <Star size={13} className={isFav ? 'fill-amber-400' : ''} />
      </span>

      {selected && <Check size={14} className="shrink-0 text-violet-400" />}
    </button>
  );
}

export default function ModelSelector({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState(() => getFavoriteModels());
  // Fixed-position anchor for the portaled panel (escapes overflow clipping)
  const [pos, setPos] = useState(null);

  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const allModels = useMemo(() => getAllModels(), []);

  const current = useMemo(() => {
    const clean = String(value || '').replace(/:online$/, '');
    return allModels.find((m) => m.id === clean) || null;
  }, [allModels, value]);

  // Anchor the panel above the trigger, clamped to the viewport
  const updatePos = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(352, window.innerWidth - 16); // 22rem = 352px
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setPos({ left, bottom: window.innerHeight - r.top + 8, width });
  }, []);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const inRoot = rootRef.current?.contains(e.target);
      const inPanel = panelRef.current?.contains(e.target);
      if (!inRoot && !inPanel) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Fresh state on open + keep anchored on resize/rotation
  useEffect(() => {
    if (!open) return;
    setFavorites(getFavoriteModels());
    setQuery('');
    updatePos();
    requestAnimationFrame(() => searchRef.current?.focus());
    window.addEventListener('resize', updatePos);
    return () => window.removeEventListener('resize', updatePos);
  }, [open, updatePos]);

  const filtered = useMemo(() => searchModels(query, allModels), [allModels, query]);
  const groups = useMemo(() => groupModelsByProvider(filtered), [filtered]);
  const favModels = useMemo(
    () => allModels.filter((m) => favorites.includes(m.id)),
    [allModels, favorites]
  );

  const toggleFav = (id) => setFavorites(toggleFavoriteModel(id));

  const select = (id) => {
    onChange?.(id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[220px] items-center gap-2 rounded-lg border border-white/10 bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className={cn(
            'grid h-5 w-5 shrink-0 place-items-center rounded-md bg-gradient-to-br text-[9px] font-bold text-white',
            PROVIDERS[current?.provider]?.badge || PROVIDERS.custom.badge
          )}
        >
          {PROVIDERS[current?.provider]?.initial || '+'}
        </span>
        <span className="truncate">{current?.name || getModelLabel(value)}</span>
        <ChevronDown
          size={13}
          className={cn('shrink-0 text-zinc-500 transition-transform', open && 'rotate-180')}
        />
      </button>

      {/* Panel — portaled to <body> so the horizontally-scrollable mobile
          toolbar (overflow-x-auto) can't clip it; anchored above the trigger */}
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{ left: pos.left, bottom: pos.bottom, width: pos.width }}
            className="fixed z-50 animate-scale-in overflow-hidden rounded-2xl border border-white/10 bg-surface-1 shadow-glow-lg"
          >
          {/* Search */}
          <div className="border-b border-white/10 p-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${allModels.length} models…`}
                className="w-full rounded-lg border border-white/10 bg-surface-2 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-violet-500/50"
              />
            </div>
          </div>

          <div className="scrollbar-thin max-h-[min(26rem,50vh)] overflow-y-auto p-1.5">
            {/* Favorites */}
            {favModels.length > 0 && !query && (
              <div className="mb-1.5">
                <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Favorites
                </p>
                {favModels.map((m) => (
                  <ModelRow
                    key={`fav-${m.id}`}
                    m={m}
                    selected={m.id === current?.id}
                    isFav
                    onSelect={select}
                    onToggleFav={toggleFav}
                  />
                ))}
                <div className="mx-2 my-1.5 border-t border-white/5" />
              </div>
            )}

            {/* Provider groups */}
            {groups.length === 0 && (
              <p className="px-3 py-8 text-center text-xs text-zinc-600">
                No models match “{query}”.
              </p>
            )}
            {groups.map((g) => (
              <div key={g.provider} className="mb-1">
                <p className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  <span
                    className={cn(
                      'grid h-4 w-4 place-items-center rounded bg-gradient-to-br text-[8px] font-bold text-white',
                      g.info.badge
                    )}
                  >
                    {g.info.initial}
                  </span>
                  {g.info.name}
                  <span className="font-normal normal-case text-zinc-700">({g.models.length})</span>
                </p>
                {g.models.map((m) => (
                  <ModelRow
                    key={m.id}
                    m={m}
                    selected={m.id === current?.id}
                    isFav={favorites.includes(m.id)}
                    onSelect={select}
                    onToggleFav={toggleFav}
                  />
                ))}
              </div>
            ))}
          </div>

          <p className="border-t border-white/10 px-3 py-2 text-[10px] text-zinc-600">
            Tip: add ANY OpenRouter model via Settings → Models → Model Manager.
          </p>
          </div>,
          document.body
        )}
    </div>
  );
}