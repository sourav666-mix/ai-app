// src/components/SettingsModal.jsx
// 3 tabs: General/Models/Data (~460 lines) [Batch 4]
// ═══════════════════════════════════════════════════════════════
//  SettingsModal — tabbed settings:
//   General : API key (+ live test), generation params, behavior
//   Models  : Model Manager launcher, custom & favorite models
//   Data    : backup export, clear chats, factory reset, privacy
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import {
  AlertTriangle, Check, Database, Download, ExternalLink, KeyRound, Loader2,
  Package, Settings as SettingsIcon, ShieldCheck, Star, Trash2,
} from 'lucide-react';

import Modal from './Modal';
import ModelManagerModal from './ModelManagerModal';
import {
  APP_NAME,
  APP_VERSION,
  MODE_LIST,
  OPENROUTER,
  OPENROUTER_KEYS_URL,
} from '../config/constants';
import { getAllModels } from '../config/models';
import {
  clearAllData,
  getChats,
  getCustomModels,
  getFavoriteModels,
  removeCustomModel,
  saveChats,
  toggleFavoriteModel,
} from '../lib/storage';
import { checkConnection } from '../lib/openrouter';
import { cn, downloadFile } from '../lib/utils';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'models', label: 'Models' },
  { id: 'data', label: 'Data' },
];

// ── Small building blocks ─────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <h3 className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </h3>
  );
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition',
          checked ? 'bg-violet-600' : 'bg-white/10'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5'
          )}
        />
      </button>
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-white/10 bg-surface-2 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-zinc-600 focus:border-violet-500/60';

// ── Main component ────────────────────────────────────────────

export default function SettingsModal({ open, onClose, settingsApi, onClearAllChats }) {
  const {
    settings, apiKey, hasApiKey, updateSettings, resetSettings, saveApiKey, clearApiKey,
  } = settingsApi;

  const [tab, setTab] = useState('general');
  const [keyDraft, setKeyDraft] = useState('');
  const [keyFlash, setKeyFlash] = useState(false);
  const [test, setTest] = useState({ state: 'idle' });
  const [maxTokensDraft, setMaxTokensDraft] = useState('');
  const [custom, setCustom] = useState([]);
  const [favs, setFavs] = useState([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [confirmText, setConfirmText] = useState(''); // factory-reset confirmation

  // Fresh state each open
  useEffect(() => {
    if (open) {
      setTab('general');
      setKeyDraft('');
      setTest({ state: 'idle' });
      setMaxTokensDraft(settings.maxTokens == null ? '' : String(settings.maxTokens));
      setCustom(getCustomModels());
      setFavs(getFavoriteModels());
      setManagerOpen(false);
      setConfirmText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Re-sync custom list after the manager closes
  useEffect(() => {
    if (!managerOpen) setCustom(getCustomModels());
  }, [managerOpen]);

  const totalModels = getAllModels().length;

  // ── API key actions ──────────────────────────────────────────
  const handleSaveKey = () => {
    if (!keyDraft.trim()) return;
    saveApiKey(keyDraft);
    setKeyDraft('');
    setKeyFlash(true);
    setTimeout(() => setKeyFlash(false), 2000);
    setTest({ state: 'idle' });
  };

  const handleTest = async () => {
    const key = keyDraft.trim() || apiKey;
    if (!key) {
      setTest({ state: 'error', error: 'Enter an API key first.' });
      return;
    }
    setTest({ state: 'loading' });
    try {
      const info = await checkConnection(key);
      setTest({ state: 'ok', info });
    } catch (err) {
      setTest({ state: 'error', error: err?.hint ? `${err.message} — ${err.hint}` : err?.message });
    }
  };

  const handleRemoveKey = () => {
    clearApiKey();
    setKeyDraft('');
    setTest({ state: 'idle' });
  };

  // ── Generation ───────────────────────────────────────────────
  const commitMaxTokens = (raw) => {
    setMaxTokensDraft(raw);
    const n = parseInt(raw, 10);
    updateSettings({ maxTokens: raw === '' || Number.isNaN(n) || n < 1 ? null : n });
  };

  // ── Models tab actions ───────────────────────────────────────
  const unfavorite = (id) => setFavs(toggleFavoriteModel(id));
  const removeModel = (id) => {
    removeCustomModel(id);
    setCustom(getCustomModels());
  };

  // ── Data tab actions ─────────────────────────────────────────
  const exportBackup = () => {
    const payload = {
      app: APP_NAME,
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      settings,
      chats: getChats(),
      customModels: getCustomModels(),
      favorites: getFavoriteModels(),
    };
    downloadFile(
      `nova-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  };

  const factoryReset = () => {
    clearAllData();
    window.location.reload();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Settings"
        subtitle={`${APP_NAME} v${APP_VERSION}`}
        icon={SettingsIcon}
        width="max-w-2xl"
      >
        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10 px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'relative px-3 py-2.5 text-xs font-medium transition',
                tab === t.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-violet-500" />
              )}
            </button>
          ))}
        </div>

        <div className="space-y-6 p-5">
          {/* ═══ GENERAL ═══ */}
          {tab === 'general' && (
            <>
              {/* API key */}
              <section>
                <SectionTitle>OpenRouter API Key</SectionTitle>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="password"
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                    placeholder={hasApiKey ? '••••••••••••••••••••  (saved)' : 'sk-or-v1-…'}
                    spellCheck={false}
                    autoComplete="off"
                    className={cn(inputCls, 'flex-1 font-mono')}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveKey}
                      disabled={!keyDraft.trim()}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleTest}
                      disabled={test.state === 'loading'}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      {test.state === 'loading' ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={14} />
                      )}
                      Test
                    </button>
                    {hasApiKey && (
                      <button
                        type="button"
                        onClick={handleRemoveKey}
                        title="Remove saved key"
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-zinc-400 transition hover:border-red-500/40 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {keyFlash && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
                    <Check size={12} /> Key saved.
                  </p>
                )}
                {test.state === 'ok' && (
                  <div className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Check size={12} /> Connected — {test.info.label}
                    </span>
                    {test.info.usage != null && (
                      <span className="mt-0.5 block text-emerald-200/70">
                        ${test.info.usage.toFixed(2)} used
                        {test.info.limit != null ? ` of $${test.info.limit.toFixed(2)}` : ' (pay-as-you-go)'}
                      </span>
                    )}
                  </div>
                )}
                {test.state === 'error' && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-red-300">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {test.error}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-zinc-600">
                  Get a key at{' '}
                  <a href={OPENROUTER_KEYS_URL} target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300">
                    openrouter.ai/keys
                  </a>{' '}
                  — stored only in this browser.
                </p>
              </section>

              {/* Generation */}
              <section>
                <SectionTitle>Generation</SectionTitle>

                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  {/* Temperature */}
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-200">Temperature</span>
                      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-xs text-violet-300">
                        {settings.temperature.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={settings.temperature}
                      onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
                      className="mt-2 w-full accent-violet-500"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-600">
                      <span>precise</span>
                      <span>balanced</span>
                      <span>creative</span>
                    </div>
                  </div>

                  {/* Max tokens */}
                  <div>
                    <label className="text-sm font-medium text-zinc-200">
                      Max output tokens
                      <span className="ml-2 text-xs font-normal text-zinc-500">(empty = model default)</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxTokensDraft}
                      onChange={(e) => commitMaxTokens(e.target.value)}
                      placeholder="auto"
                      className={cn(inputCls, 'mt-1.5')}
                    />
                  </div>

                  <div className="divide-y divide-white/5">
                    <Toggle
                      checked={settings.streaming}
                      onChange={(v) => updateSettings({ streaming: v })}
                      label="Stream responses"
                      description="Show tokens as they arrive instead of waiting for the full reply."
                    />
                    <Toggle
                      checked={settings.sendOnEnter}
                      onChange={(v) => updateSettings({ sendOnEnter: v })}
                      label="Enter sends message"
                      description="Off = Enter makes a newline; send with Ctrl/⌘+Enter."
                    />
                  </div>
                </div>
              </section>

              {/* Behavior */}
              <section>
                <SectionTitle>Behavior</SectionTitle>
                <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02] px-4">
                  <Toggle
                    checked={settings.autoTitle}
                    onChange={(v) => updateSettings({ autoTitle: v })}
                    label="Auto-name chats"
                    description="Generate a short title from your first message."
                  />
                  <Toggle
                    checked={settings.showReasoning}
                    onChange={(v) => updateSettings({ showReasoning: v })}
                    label="Show reasoning panel"
                    description="Display the model's thinking when it shares it."
                  />
                  <Toggle
                    checked={settings.enhanceImagePrompts}
                    onChange={(v) => updateSettings({ enhanceImagePrompts: v })}
                    label="Enhance image prompts"
                    description="Polish short ideas into vivid prompts before generation."
                  />
                </div>

                <div className="mt-3">
                  <label className="text-sm font-medium text-zinc-200">Default mode</label>
                  <select
                    value={settings.defaultMode}
                    onChange={(e) => updateSettings({ defaultMode: e.target.value })}
                    className={cn(inputCls, 'mt-1.5')}
                  >
                    {MODE_LIST.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-3">
                  <label className="text-sm font-medium text-zinc-200">
                    Custom instructions
                    <span className="ml-2 text-xs font-normal text-zinc-500">(added to every system prompt)</span>
                  </label>
                  <textarea
                    value={settings.systemPromptOverride}
                    onChange={(e) => updateSettings({ systemPromptOverride: e.target.value })}
                    rows={3}
                    placeholder="e.g. Always answer in Spanish. Prefer TypeScript examples."
                    className={cn(inputCls, 'scrollbar-thin mt-1.5 resize-none')}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resetSettings();
                    setMaxTokensDraft('');
                  }}
                  className="mt-3 text-xs text-zinc-500 underline transition hover:text-zinc-300"
                >
                  Reset all settings to defaults
                </button>
              </section>
            </>
          )}

          {/* ═══ MODELS ═══ */}
          {tab === 'models' && (
            <>
              <section>
                <SectionTitle>Model Manager</SectionTitle>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                  <div>
                    <p className="text-sm font-medium text-white">{totalModels} models available</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Browse OpenRouter's entire live catalog and add any model with one click.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManagerOpen(true)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:brightness-110"
                  >
                    <Package size={14} /> Open
                  </button>
                </div>
              </section>

              <section>
                <SectionTitle>Your custom models ({custom.length})</SectionTitle>
                {custom.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 px-4 py-4 text-center text-xs text-zinc-600">
                    None yet — open the Model Manager to add any OpenRouter model.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {custom.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface-2 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-zinc-200">
                            {c.name || c.id.split('/').pop()}
                          </p>
                          <p className="truncate font-mono text-[10px] text-zinc-600">{c.id}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeModel(c.id)}
                          className="shrink-0 rounded-md p-1.5 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                          title="Remove"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {favs.length > 0 && (
                <section>
                  <SectionTitle>Favorite models ({favs.length})</SectionTitle>
                  <div className="space-y-1">
                    {favs.map((id) => (
                      <div
                        key={id}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface-2 px-3 py-2"
                      >
                        <Star size={13} className="shrink-0 fill-amber-400 text-amber-400" />
                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-300">{id}</span>
                        <button
                          type="button"
                          onClick={() => unfavorite(id)}
                          className="shrink-0 rounded-md px-1.5 py-1 text-[11px] text-zinc-500 transition hover:text-zinc-300"
                        >
                          Unfavorite
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <p className="text-[11px] leading-relaxed text-zinc-600">
                Tip: append{' '}
                <code className="rounded bg-white/10 px-1 font-mono text-violet-300">:online</code>{' '}
                to any model ID (or toggle the Web button in the toolbar) for live web search.
              </p>
            </>
          )}

          {/* ═══ DATA ═══ */}
          {tab === 'data' && (
            <>
              <section>
                <SectionTitle>Backup</SectionTitle>
                <button
                  type="button"
                  onClick={exportBackup}
                  className="inline-flex w-full items-center gap-3 rounded-xl border border-white/10 bg-surface-2 px-4 py-3 text-left transition hover:border-violet-500/40"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600">
                    <Download size={16} className="text-white" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-white">Export everything as JSON</span>
                    <span className="block text-xs text-zinc-500">
                      Chats, settings, custom models & favorites — restore by re-importing later.
                    </span>
                  </span>
                </button>
              </section>

              <section>
                <SectionTitle>Danger zone</SectionTitle>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete ALL chats? This cannot be undone.')) {
                        onClearAllChats?.();
                      }
                    }}
                    className="inline-flex w-full items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-left transition hover:bg-amber-500/10"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                      <Database size={16} className="text-white" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-white">Clear all chats</span>
                      <span className="block text-xs text-zinc-500">
                        Every conversation is deleted from this browser.
                      </span>
                    </span>
                  </button>

                  <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-red-500 to-rose-600">
                        <AlertTriangle size={16} className="text-white" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">Factory reset</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Deletes chats, settings, your API key and all custom models, then reloads.
                        </p>
                        <div className="mt-2.5 flex gap-2">
                          <input
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder='Type "RESET" to confirm'
                            className="flex-1 rounded-lg border border-white/10 bg-surface-2 px-3 py-1.5 text-xs outline-none focus:border-red-500/60"
                          />
                          <button
                            type="button"
                            onClick={factoryReset}
                            disabled={confirmText.trim().toUpperCase() !== 'RESET'}
                            className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start gap-2.5">
                  <KeyRound size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    <strong className="text-zinc-300">Privacy:</strong> everything lives in your
                    browser's localStorage. Requests go directly from your device to
                    openrouter.ai over HTTPS — no analytics, no middleman server.
                  </p>
                </div>
              </section>
            </>
          )}

          {/* Footer links */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-4 text-[11px] text-zinc-600">
            <span>
              {APP_NAME} v{APP_VERSION}
            </span>
            <a href={OPENROUTER.DOCS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-zinc-400">
              API docs <ExternalLink size={9} />
            </a>
            <a href={OPENROUTER.MODELS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-zinc-400">
              All models <ExternalLink size={9} />
            </a>
            <a href={OPENROUTER.CREDITS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-zinc-400">
              Credits & usage <ExternalLink size={9} />
            </a>
          </div>
        </div>
      </Modal>

      {/* Nested Model Manager */}
      <ModelManagerModal
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        apiKey={apiKey}
      />
    </>
  );
}