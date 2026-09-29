// src/components/AttachmentPreview.jsx
// Pending attachment chips (~90 lines) [Batch 4]
// ═══════════════════════════════════════════════════════════════
//  AttachmentPreview — pending-attachment chips above the input.
//  Image thumbnails · PDF/text cards · processing spinner ·
//  error marker · hover-remove button.
// ═══════════════════════════════════════════════════════════════

import { AlertTriangle, FileCode2, FileText, Loader2, X } from 'lucide-react';
import { cn, formatBytes } from '../lib/utils';

export default function AttachmentPreview({ attachments = [], onRemove }) {
  if (!attachments.length) return null;

  return (
    <div className="flex flex-wrap gap-2 px-1 pb-2">
      {attachments.map((a) => (
        <div key={a.id} className="group/att relative">
          {a.kind === 'image' && a.dataUrl ? (
            <div className="h-16 w-16 overflow-hidden rounded-lg border border-white/10">
              <img src={a.dataUrl} alt={a.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div
              className={cn(
                'flex max-w-[190px] items-center gap-2 rounded-lg border bg-surface-2 px-2.5 py-2',
                a.status === 'error' ? 'border-red-500/30' : 'border-white/10'
              )}
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/5">
                {a.status === 'processing' ? (
                  <Loader2 size={14} className="animate-spin text-violet-400" />
                ) : a.kind === 'pdf' ? (
                  <FileText size={14} className="text-violet-400" />
                ) : (
                  <FileCode2 size={14} className="text-violet-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-zinc-200">{a.name}</p>
                <p className="text-[10px] text-zinc-500">
                  {a.status === 'processing'
                    ? 'Processing…'
                    : a.status === 'error'
                      ? 'Failed'
                      : formatBytes(a.size)}
                  {a.pages ? ` · ${a.pages}p` : ''}
                </p>
              </div>
            </div>
          )}

          {a.status === 'error' && (
            <span
              title={a.error}
              className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-500 text-white"
            >
              <AlertTriangle size={10} />
            </span>
          )}

          <button
            type="button"
            onClick={() => onRemove?.(a.id)}
            aria-label={`Remove ${a.name}`}
            className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-white/10 bg-surface-3 text-zinc-400 opacity-0 shadow transition hover:text-red-400 group-hover/att:opacity-100"
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}