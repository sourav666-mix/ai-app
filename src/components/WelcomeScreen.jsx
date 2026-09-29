// src/components/WelcomeScreen.jsx
// Hero + suggested prompt cards (~100 lines) [Batch 3]
// ═══════════════════════════════════════════════════════════════
//  WelcomeScreen — empty-chat hero: logo, mode chips and
//  clickable suggested-prompt cards.
// ═══════════════════════════════════════════════════════════════

import { Sparkles } from 'lucide-react';
import {
  Rocket, Globe, Gamepad2, Image as ImageIcon, Code2,
} from 'lucide-react';
import { APP_TAGLINE, MODE_LIST, SUGGESTED_PROMPTS } from '../config/constants';
import { ModeBadge } from './ModeBadge';
import { truncate } from '../lib/utils';

const PROMPT_ICONS = { Rocket, Globe, Gamepad2, Image: ImageIcon, Code2 };
const PROMPT_GRADIENTS = [
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
  'from-fuchsia-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
];

export default function WelcomeScreen({ onPrompt }) {
  return (
    <div className="flex flex-col items-center py-8 text-center animate-fade-in sm:py-12">
      {/* Hero */}
      <div className="relative">
        <div className="absolute -inset-3 animate-glow-pulse rounded-full bg-gradient-to-br from-violet-500/40 via-fuchsia-500/30 to-cyan-400/40 blur-2xl" />
        <div className="grid h-16 w-16 animate-float place-items-center rounded-3xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 shadow-glow">
          <Sparkles size={30} className="text-white" />
        </div>
      </div>
      <h1 className="mt-5 bg-gradient-to-r from-white via-violet-200 to-cyan-200 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
        Welcome to Nova
      </h1>
      <p className="mt-1.5 max-w-md text-sm text-zinc-400">
        {APP_TAGLINE} Chat, research the web, generate images, or build complete projects.
      </p>

      {/* Mode chips */}
      <div className="mt-5 flex flex-wrap justify-center gap-1.5">
        {MODE_LIST.map((m) => (
          <ModeBadge key={m.id} mode={m.id} />
        ))}
      </div>

      {/* Suggested prompts */}
      <div className="mt-8 grid w-full max-w-2xl gap-3 text-left sm:grid-cols-2">
        {SUGGESTED_PROMPTS.map((s, i) => {
          const Icon = PROMPT_ICONS[s.icon] || Sparkles;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => onPrompt?.(s.prompt)}
              className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-surface-1 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-violet-500/40 hover:bg-surface-2 hover:shadow-glow-sm"
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${PROMPT_GRADIENTS[i % PROMPT_GRADIENTS.length]}`}
              >
                <Icon size={16} className="text-white" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{s.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                  {truncate(s.prompt, 90)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-8 text-[11px] text-zinc-600">
        Attach files & photos · Switch models anytime · Everything stays on your device
      </p>
    </div>
  );
}