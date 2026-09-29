// src/components/Message.jsx
// Bubbles, reasoning panel, citations, image grid, edit & retry actions (~330 lines) [Batch 3]
// ═══════════════════════════════════════════════════════════════
//  Message — one chat message.
//  User: right bubble + attachment thumbnails + edit & resend.
//  Assistant: provider avatar, collapsible reasoning panel,
//  streaming caret, markdown, generated-image grid, citation
//  chips, token usage, copy / regenerate actions.
// ═══════════════════════════════════════════════════════════════

import { memo, useEffect, useState } from 'react';
import {
  AlertTriangle, Brain, Check, ChevronDown, Copy, Download,
  ExternalLink, FileCode2, FileText, Globe, Pencil, RotateCcw, User,
} from 'lucide-react';

import MarkdownRenderer from './MarkdownRenderer';
import { PROVIDERS, getModelLabel, modelHasWebSearch } from '../config/models';
import { MODES } from '../config/constants';
import { cn, copyToClipboard, formatTime } from '../lib/utils';

// ── Thinking labels per mode ──────────────────────────────────
const THINKING_LABEL = {
  chat: 'Thinking',
  research: 'Researching',
  search: 'Searching the web',
  build: 'Building your project',
  image: 'Creating your image',
};

// ── Provider avatar ───────────────────────────────────────────
function ProviderAvatar({ modelId }) {
  const providerKey = (modelId || '').split('/')[0];
  const p = PROVIDERS[providerKey];
  return (
    <div
      className={cn(
        'grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-[11px] font-bold text-white shadow',
        p?.badge || 'from-zinc-500 to-zinc-700'
      )}
      title={p?.name || providerKey}
    >
      {p?.initial || '?'}
    </div>
  );
}

// ── Reasoning panel ───────────────────────────────────────────
function ReasoningPanel({ reasoning, streaming, hasContent }) {
  const [open, setOpen] = useState(false);

  // Auto-open while the model is "thinking" (before text arrives),
  // auto-close once content streams in or generation finishes.
  useEffect(() => {
    if (streaming && !hasContent) setOpen(true);
    else setOpen(false);
  }, [streaming, hasContent]);

  if (!reasoning?.trim()) return null;

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-violet-500/20 bg-violet-500/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-violet-300 transition hover:bg-violet-500/10"
      >
        <Brain size={13} className="shrink-0" />
        {streaming && !hasContent ? 'Thinking…' : 'Thought process'}
        <ChevronDown
          size={13}
          className={cn('ml-auto shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <pre className="scrollbar-thin max-h-64 overflow-y-auto whitespace-pre-wrap border-t border-violet-500/15 px-3 py-2.5 font-sans text-[12px] leading-5 text-zinc-400">
          {reasoning}
        </pre>
      )}
    </div>
  );
}

// ── User attachment chip ──────────────────────────────────────
function AttachmentChip({ att }) {
  if (att.kind === 'image' && att.dataUrl) {
    return (
      <a href={att.dataUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={att.dataUrl}
          alt={att.name}
          className="h-20 w-20 rounded-lg border border-white/10 object-cover transition hover:border-violet-500/50"
        />
      </a>
    );
  }
  const Icon = att.kind === 'pdf' ? FileText : FileCode2;
  return (
    <span
      title={att.error || att.warning || att.name}
      className="inline-flex max-w-[180px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-zinc-300"
    >
      <Icon size={13} className="shrink-0 text-violet-400" />
      <span className="truncate">{att.name}</span>
      {att.stripped && <span className="shrink-0 text-zinc-600">(unsaved preview)</span>}
    </span>
  );
}

// ── Citation chips ────────────────────────────────────────────
function Citations({ annotations = [] }) {
  if (!annotations.length) return null;
  return (
    <div className="mt-4 border-t border-white/5 pt-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        <Globe size={11} /> Sources ({annotations.length})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {annotations.map((a, i) => {
          let host = a.url;
          try {
            host = new URL(a.url).hostname.replace(/^www\./, '');
          } catch {
            /* keep raw */
          }
          return (
            <a
              key={`${a.url}-${i}`}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              title={a.title || a.url}
              className="inline-flex max-w-[240px] items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-300 transition hover:border-cyan-500/40 hover:text-cyan-200"
            >
              <span className="font-semibold">{i + 1}</span>
              <span className="truncate">{a.title || host}</span>
              <ExternalLink size={9} className="shrink-0 opacity-60" />
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ── Generated images ──────────────────────────────────────────
function GeneratedImages({ images = [] }) {
  if (!images.length) return null;
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {images.map((src, i) => (
        <div key={i} className="group relative overflow-hidden rounded-xl border border-white/10">
          <img src={src} alt={`Generated ${i + 1}`} className="w-full bg-black/40" />
          <a
            href={src}
            download={`nova-image-${Date.now()}-${i + 1}.png`}
            title="Download image"
            className="absolute right-2 top-2 rounded-lg border border-white/10 bg-black/60 p-2.5 text-white opacity-100 backdrop-blur transition hover:bg-black/80 md:p-2 md:opacity-0 md:group-hover:opacity-100"
          >
            <Download size={14} />
          </a>
        </div>
      ))}
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────
function ActionButton({ icon: Icon, label, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        'flex min-h-[32px] items-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-zinc-600 transition hover:bg-white/5 hover:text-zinc-300 sm:min-h-0 sm:px-1.5 sm:py-1',
        className
      )}
    >
      <Icon size={12} />
      {label && <span>{label}</span>}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────

function Message({ message: m, streaming = false, isLast = false, mode = 'chat', onRegenerate, onEditMessage }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const isUser = m.role === 'user';
  const content = m.content || '';
  const hasImages = (m.images?.length || 0) > 0;
  const displayContent = streaming && content ? `${content} ▍` : content;
  const showThinking = streaming && !content && !hasImages;
  const showActions = !streaming && m.status !== 'error';

  const handleCopy = async () => {
    const ok = await copyToClipboard(content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const startEdit = () => {
    setEditText(content);
    setEditing(true);
  };

  // ── USER message ───────────────────────────────────────────
  if (isUser) {
    return (
      <div className="group flex flex-col items-end animate-fade-in">
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-violet-500/20 bg-violet-500/10 px-4 py-3">
          {editing ? (
            <div className="w-full min-w-[260px] space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditing(false);
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    setEditing(false);
                    onEditMessage?.(m.id, editText);
                  }
                }}
                rows={Math.min(8, editText.split('\n').length + 1)}
                autoFocus
                className="w-full resize-none rounded-lg border border-white/10 bg-surface-2 p-2.5 text-base text-zinc-100 outline-none focus:border-violet-500/60 sm:text-sm"
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg px-2.5 py-1.5 text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    onEditMessage?.(m.id, editText);
                  }}
                  className="rounded-lg bg-violet-600 px-2.5 py-1.5 font-medium text-white hover:bg-violet-500"
                >
                  Save & resend
                </button>
              </div>
            </div>
          ) : (
            <>
              {content && (
                <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-zinc-100">
                  {content}
                </p>
              )}
              {!!m.attachments?.length && (
                <div className={cn('flex flex-wrap gap-2', content && 'mt-2')}>
                  {m.attachments.map((a) => (
                    <AttachmentChip key={a.id} att={a} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {!editing && (
          <div className="mt-1 flex items-center gap-0.5 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
            <ActionButton icon={copied ? Check : Copy} label={copied ? 'Copied' : undefined} onClick={handleCopy} />
            {streaming !== true && onEditMessage && (
              <ActionButton icon={Pencil} onClick={startEdit} label="Edit" />
            )}
          </div>
        )}
      </div>
    );
  }

  // ── ASSISTANT message ──────────────────────────────────────
  return (
    <div className="group flex gap-3 animate-fade-in">
      <ProviderAvatar modelId={m.model} />
      <div className="min-w-0 flex-1">
        {/* Meta line */}
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
          <span className="font-medium text-zinc-400">{getModelLabel(m.model)}</span>
          {modelHasWebSearch(m.model) && (
            <span className="inline-flex items-center gap-0.5 rounded bg-cyan-500/10 px-1 py-0.5 text-[10px] text-cyan-400">
              <Globe size={9} /> web
            </span>
          )}
          <span>{formatTime(m.createdAt)}</span>
          {m.stopped && <span className="text-amber-500/80">· stopped</span>}
          {m.usage?.total_tokens != null && <span>· {m.usage.total_tokens} tokens</span>}
        </div>

        {/* Reasoning (o1/R1-style models, deep research) */}
        <ReasoningPanel reasoning={m.reasoning} streaming={streaming} hasContent={!!content} />

        {/* Thinking indicator */}
        {showThinking && (
          <div className="flex items-center gap-2 py-1 text-sm text-zinc-400">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="ml-1">{THINKING_LABEL[mode] || 'Thinking'}…</span>
          </div>
        )}

        {/* Content */}
        {content && <MarkdownRenderer content={displayContent} streaming={streaming} />}

        {/* Generated images */}
        <GeneratedImages images={m.images} />

        {/* Citations (web search / research) */}
        <Citations annotations={m.annotations} />

        {/* Error */}
        {m.error && (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">{m.error}</span>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="mt-1.5 flex items-center gap-0.5">
            {content && (
              <ActionButton
                icon={copied ? Check : Copy}
                label={copied ? 'Copied' : undefined}
                onClick={handleCopy}
              />
            )}
            {isLast && onRegenerate && (
              <ActionButton icon={RotateCcw} label="Retry" onClick={onRegenerate} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(Message);