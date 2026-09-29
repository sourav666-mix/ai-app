// src/components/ModeBadge.jsx
// Mode icons & badges (~40 lines) [Batch 3]
// ═══════════════════════════════════════════════════════════════
//  ModeBadge — shared icon/badge renderer for the 5 power modes.
//  MODES[].icon stores a string name; this maps it to the component.
// ═══════════════════════════════════════════════════════════════

import { MessageSquare, Microscope, Globe, Image as ImageIcon, Hammer } from 'lucide-react';
import { MODES } from '../config/constants';
import { cn } from '../lib/utils';

const MODE_ICONS = {
  MessageSquare,
  Microscope,
  Globe,
  Image: ImageIcon,
  Hammer,
};

export function ModeIcon({ mode, size = 14, className }) {
  const cfg = MODES[mode];
  const Icon = MODE_ICONS[cfg?.icon] || MessageSquare;
  return <Icon size={size} className={className} />;
}

export function ModeBadge({ mode, className }) {
  const cfg = MODES[mode];
  if (!cfg) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-gradient-to-r px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white',
        cfg.gradient,
        className
      )}
    >
      <ModeIcon mode={mode} size={10} />
      {cfg.name}
    </span>
  );
}