// src/components/Modal.jsx
// Shared modal shell, Esc, scroll lock (~90 lines) [Batch 4]
// ═══════════════════════════════════════════════════════════════
//  Modal — shared shell: backdrop, Escape-to-close, body scroll
//  lock, gradient icon header, scrollable content area.
// ═══════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  width = 'max-w-xl',
}) {
  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[90vh] w-full animate-scale-in flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface-1 shadow-2xl',
          width
        )}
      >
        {(title || Icon) && (
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            {Icon && (
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
                <Icon size={16} className="text-white" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
              {subtitle && <p className="truncate text-xs text-zinc-500">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="scrollbar-thin flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}