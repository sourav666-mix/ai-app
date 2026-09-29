// src/components/ModelManagerModal.jsx
// Live catalog -> add ANY model (~300 lines) [Batch 4]
// ═══════════════════════════════════════════════════════════════
//  ModelManagerModal — the "add any model" power tool.
//  • Auto-fetches OpenRouter's COMPLETE live catalog (GET /models)
//  • Search across every model on OpenRouter, see pricing & caps
//  • One click to add → merges with the built-in registry
//  • Manual add by raw ID (for brand-new/unlisted models)
//  • Manage (remove) your custom models
//  Custom models persist in localStorage and appear everywhere.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Check, Loader2, Package, Plus, RefreshCw, Search, Trash2,
} from 'lucide-react';

import Modal from './Modal';
import { fetchAvailableModels } from '../lib/openrouter';
import { addCustomModel, getCustomModels, removeCustomModel } from '../lib/storage';
import { formatContextLength } from '../config/models';
import { cn } from '../lib/utils';

const LIVE_RENDER_LIMIT = 80;

const priceLabel = (v) => {
  if (v == null) return '?';
  if (v === 0) return 'Free';
  const perM = v * 1e6;
  return `$${perM < 0.1 ? perM.toFixed(3) : perM.toFixed(2)}`;
};

export default function ModelManagerModal({ open, onClose, apiKey }) {
  const [custom, setCustom] = useState([]);
  const [live, setLive] = useState(null); // null = not fetched yet
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [query, setQuery] = useState('');
  const [manualId, setManualId] = useState('');
  const [notice, setNotice] = useState(null); // { type: 'ok' | 'err', text }

  const fetchedOnce = useRef(false);
  const noticeTimer = useRef(null);

  const flash = (type, text) => {
    setNotice({ type, text });
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  };

  const refreshCustom = () => setCustom(getCustomModels());

  const fetchLive = async () => {
    setLoadingLive(true);
    setLiveError('');
    try {
      const models = await fetchAvailableModels(apiKey);
      setLive(models);
      fetchedOnce.current = true;
    } catch (err) {
      setLiveError(err?.hint ? `${err.message} — ${err.hint}` : err?.message || 'Failed to load catalog.');
    } finally {
      setLoadingLive(false);
    }
  };

  // On open: load custom list; auto-fetch the catalog once per session
  useEffect(() => {
    if (open) {
      refreshCustom();
      setQuery('');
      setManualId('');
      setNotice(null);
      if (!fetchedOnce.current && !live && !loadingLive) fetchLive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const customIds = useMemo(() => new Set(custom.map((c) => c.id)), [custom]);

  const filteredLive = useMemo(() => {
    if (!live) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? live.filter(
          (m) =>
            m.id.toLowerCase().includes(q) ||
            m.name.toLowerCase().includes(q) ||
            (m.description || '').toLowerCase().includes(q)
        )
      : live;
    return list.slice(0, LIVE_RENDER_LIMIT);
  }, [live, query]);

  const addFromLive = (m) => {
    const caps = {};
    if (m.capabilities?.vision) caps.vision = true;
    if (m.capabilities?.imageGen) caps.imageGen = true;
    if (m.capabilities?.reasoning) caps.reasoning = true;
    if (m.capabilities?.tools) caps.tools = true;
    addCustomModel({
      id: m.id,
      name: m.name,
      description: m.description,
      contextLength: m.contextLength ?? undefined,
      capabilities: caps,
      tags: ['custom'],
    });
    refreshCustom();
    flash('ok', `Added ${m.id}`);
  };

  const addManual = () => {
    const id = manualId.trim();
    if (!id) return;
    if (!id.includes('/')) {
      flash('err', 'Model IDs look like "provider/model-name" — e.g. openai/gpt-4o');
      return;
    }
    if (customIds.has(id)) {
      flash('err', `${id} is already in your models.`);
      return;
    }
    addCustomModel({ id, name: '', description: '' });
    setManualId('');
    refreshCustom();
    flash('ok', `Added ${id}`);
  };

  const removeFromCustom = (id) => {
    removeCustomModel(id);
    refreshCustom();
    flash('ok', `Removed ${id}`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Model Manager"
      subtitle="Add any model from OpenRouter — beyond the built-in 30"
      icon={Package}
      width="max-w-2xl"
    >
      <div className="space-y-5 p-5">
        {/* Notice */}
        {notice && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
              notice.type === 'ok'
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/25 bg-red-500/10 text-red-300'
            )}
          >
            {notice.type === 'ok' ? <Check size={13} /> : <AlertTriangle size={13} />}
            {notice.text}
          </div>
        )}

        {/* Manual add by ID */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Add by model ID
          </h3>
          <div className="flex gap-2">
            <input
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addManual()}
              placeholder="provider/model-name  ·  e.g. mistralai/mistral-large"
              spellCheck={false}
              className="flex-1 rounded-xl border border-white/10 bg-surface-2 px-3.5 py-2.5 font-mono text-sm outline-none transition placeholder:text-zinc-600 focus:border-violet-500/60"
            />
            <button
              type="button"
              onClick={addManual}
              disabled={!manualId.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </section>

        {/* Your custom models */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Your models ({custom.length})
          </h3>
          {custom.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-zinc-600">
              No custom models yet — add one by ID above, or click any model in the live catalog
              below. Custom models appear in the model selector everywhere and persist in this
              browser.
            </p>
          ) : (
            <div className="space-y-1">
              {custom.map((c) => (
                <div
                  key={c.id}
                  className="group flex items-center gap-2.5 rounded-lg border border-violet-500/15 bg-violet-500/5 px-3 py-2"
                >
                  <Check size={13} className="shrink-0 text-violet-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-zinc-200">
                      {c.name || c.id.split('/').pop()}
                    </p>
                    <p className="truncate font-mono text-[10px] text-zinc-500">{c.id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCustom(c.id)}
                    title="Remove model"
                    className="shrink-0 rounded-md p-1.5 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Live catalog */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Live OpenRouter catalog
              {live && <span className="ml-1.5 font-normal normal-case text-zinc-600">({live.length} models)</span>}
            </h3>
            <button
              type="button"
              onClick={fetchLive}
              disabled={loadingLive}
              title="Refresh catalog"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
            >
              {loadingLive ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              Refresh
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={!live}
              placeholder={live ? 'Search every model on OpenRouter…' : 'Catalog loads automatically…'}
              className="w-full rounded-xl border border-white/10 bg-surface-2 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-violet-500/50 disabled:opacity-50"
            />
          </div>

          {/* States */}
          {loadingLive && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 py-8 text-sm text-zinc-400">
              <Loader2 size={16} className="animate-spin" /> Fetching the full model catalog…
            </div>
          )}

          {liveError && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs text-red-300">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  {liveError}
                  <button type="button" onClick={fetchLive} className="ml-2 underline hover:text-red-200">
                    Retry
                  </button>
                </span>
              </div>
            </div>
          )}

          {live && !loadingLive && (
            <>
              <div className="space-y-0.5">
                {filteredLive.map((m) => {
                  const added = customIds.has(m.id);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-white/5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-zinc-200">{m.name}</p>
                        <p className="truncate font-mono text-[10px] text-zinc-600">
                          {m.id}
                          {m.contextLength ? ` · ${formatContextLength(m.contextLength)} ctx` : ''}
                          {` · ${priceLabel(m.pricing?.prompt)} in / ${priceLabel(m.pricing?.completion)} out per M`}
                        </p>
                      </div>
                      {added ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-400">
                          <Check size={11} /> Added
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addFromLive(m)}
                          title={`Add ${m.id}`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-violet-500/40 hover:text-white"
                        >
                          <Plus size={11} /> Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {live.length > LIVE_RENDER_LIMIT && (
                <p className="pt-2 text-center text-[11px] text-zinc-600">
                  Showing first {filteredLive.length} of {live.length} — refine your search to see
                  more.
                </p>
              )}
              {live.length > 0 && filteredLive.length === 0 && (
                <p className="py-6 text-center text-xs text-zinc-600">
                  No catalog models match “{query}”. You can still add it by ID above.
                </p>
              )}
            </>
          )}
        </section>

        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] leading-relaxed text-zinc-500">
          Capabilities (vision / image-gen / reasoning / tools) are auto-detected from OpenRouter's
          catalog metadata. Custom models work in every mode — and appending{' '}
          <code className="rounded bg-white/10 px-1 font-mono text-violet-300">:online</code> to any
          of them enables live web search.
        </p>
      </div>
    </Modal>
  );
}