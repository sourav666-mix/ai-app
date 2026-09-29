// src/components/OnboardingScreen.jsx
// First-run key setup (~180 lines) [Batch 5]
// ═══════════════════════════════════════════════════════════════
//  OnboardingScreen — first-run hero: enter & test your OpenRouter
//  key, or continue in limited mode (a key guard appears in-app).
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import {
  ArrowRight, Check, Cpu, Eye, EyeOff, ExternalLink, KeyRound,
  Layers, Loader2, ShieldCheck, Sparkles, X, Zap,
} from 'lucide-react';

import { APP_NAME, APP_TAGLINE, OPENROUTER_KEYS_URL } from '../config/constants';
import { getAllModels } from '../config/models';
import { checkConnection } from '../lib/openrouter';
import { cn } from '../lib/utils';

const FEATURES = [
  'Streaming Chat', 'Deep Research', 'Web Search', 'Image Generation',
  'Files & Camera', 'PDF / MD Export', 'Full-Stack Builder', 'ZIP Export',
];

export default function OnboardingScreen({ settingsApi, onDone, onSkip }) {
  const { saveApiKey } = settingsApi;
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [test, setTest] = useState({ state: 'idle' });
  const [saved, setSaved] = useState(false);

  const allModels = getAllModels();
  const providerCount = new Set(allModels.map((m) => m.provider)).size;

  const handleTest = async () => {
    if (!key.trim()) {
      setTest({ state: 'error', error: 'Enter your API key first.' });
      return;
    }
    setTest({ state: 'loading' });
    try {
      const info = await checkConnection(key.trim());
      setTest({ state: 'ok', info });
    } catch (err) {
      setTest({ state: 'error', error: err?.hint ? `${err.message} — ${err.hint}` : err?.message });
    }
  };

  const handleContinue = () => {
    if (key.trim()) saveApiKey(key);
    onDone?.();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface text-zinc-100">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-cyan-500/10 blur-[110px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 py-12">
        {/* Hero */}
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 shadow-glow">
          <Sparkles size={30} className="text-white" />
        </div>
        <h1 className="mt-5 bg-gradient-to-r from-white via-violet-200 to-cyan-200 bg-clip-text text-center text-3xl font-bold text-transparent sm:text-4xl">
          {APP_NAME}
        </h1>
        <p className="mt-2 max-w-md text-center text-sm text-zinc-400">{APP_TAGLINE}</p>

        {/* Features */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {FEATURES.map((f) => (
            <span
              key={f}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300"
            >
              {f}
            </span>
          ))}
        </div>

        {/* Key card */}
        <div className="mt-8 w-full rounded-2xl border border-white/10 bg-surface-1/80 p-5 backdrop-blur sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
              <KeyRound size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-white">Connect your OpenRouter key</h2>
              <p className="text-xs text-zinc-500">
                Get one at{' '}
                <a href={OPENROUTER_KEYS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-violet-400 hover:text-violet-300">
                  openrouter.ai/keys <ExternalLink size={10} />
                </a>
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input
                type={show ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                placeholder="sk-or-v1-..."
                spellCheck={false}
                autoComplete="off"
                className="w-full rounded-xl border border-white/10 bg-surface-2 px-4 py-3 pr-11 font-mono text-sm outline-none transition placeholder:text-zinc-600 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label="Toggle key visibility"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={test.state === 'loading'}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
              >
                {test.state === 'loading' ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                Test
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-glow-sm transition hover:brightness-110"
              >
                Continue <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {test.state === 'ok' && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
              <Check size={13} /> Connected — {test.info.label}
              {test.info.usage != null && ` · $${test.info.usage.toFixed(2)} used`}
            </p>
          )}
          {test.state === 'error' && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-red-300">
              <X size={13} className="mt-0.5 shrink-0" /> {test.error}
            </p>
          )}

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-600">
            <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-500" />
            Your key is stored only in this browser and sent directly to openrouter.ai over HTTPS.
            No servers in between.
          </p>
        </div>

        {/* Stats */}
        <div className="mt-6 grid w-full grid-cols-3 gap-3">
          {[
            { icon: Layers, value: allModels.length, label: 'Models ready' },
            { icon: Cpu, value: providerCount, label: 'Providers' },
            { icon: Zap, value: 5, label: 'Power modes' },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-xl border border-white/5 bg-surface-1 p-4 text-center">
              <Icon size={16} className="mx-auto text-violet-400" />
              <div className="mt-1.5 text-lg font-bold text-white">{value}</div>
              <div className="text-[11px] text-zinc-500">{label}</div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onSkip}
          className={cn('mt-6 text-xs text-zinc-500 underline transition hover:text-zinc-300')}
        >
          Continue without a key (you can add one anytime in Settings)
        </button>
      </div>
    </div>
  );
}