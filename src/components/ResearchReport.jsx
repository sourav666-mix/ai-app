// src/components/ResearchReport.jsx
// Sources sidebar + reader (~180 lines) [Batch 5]
// ═══════════════════════════════════════════════════════════════
//  ResearchReport — deep-research reader (inside Artifact panel):
//  meta bar (reading time, model), sources sidebar with numbered
//  citation links, full markdown report, .md / .pdf export.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { BookOpen, Clock, ExternalLink, FileDown, FileText, Globe, Loader2 } from 'lucide-react';

import MarkdownRenderer from './MarkdownRenderer';
import { getModelLabel } from '../config/models';
import { exportChatPdf, exportMarkdownFile } from '../lib/exports';
import { slugify } from '../lib/project';
import { cn } from '../lib/utils';

export default function ResearchReport({ message, chat }) {
  const content = message?.content || '';
  const sources = message?.annotations || [];

  const title = useMemo(
    () => content.match(/^#\s+(.{3,90})$/m)?.[1]?.replace(/[*_`]/g, '').trim() || chat?.title || 'Research Report',
    [content, chat?.title]
  );

  const readingMin = useMemo(() => {
    const words = content.trim().split(/\s+/).length;
    return Math.max(1, Math.round(words / 200));
  }, [content]);

  const hostOf = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const exportMd = () =>
    exportMarkdownFile(`${slugify(title)}.md`, content);

  const exportPdf = () =>
    exportChatPdf({
      title,
      mode: 'research',
      model: message?.model,
      messages: [
        {
          id: 'synth-user',
          role: 'user',
          content: chat?.messages?.find((m) => m.role === 'user')?.content || 'Deep research request',
          createdAt: message?.createdAt,
        },
        message,
      ].filter(Boolean),
    });

  const isStreaming = message?.status === 'streaming';

  return (
    <div className="flex h-full flex-col">
      {/* Meta bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
          <BookOpen size={11} /> Research
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
          <Clock size={11} /> {readingMin} min read
        </span>
        <span className="hidden font-mono text-[11px] text-zinc-600 sm:inline">
          {getModelLabel(message?.model)}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={exportMd}
          disabled={isStreaming}
          title="Export report as Markdown"
          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-400 transition hover:text-white disabled:opacity-40"
        >
          <FileText size={14} />
        </button>
        <button
          type="button"
          onClick={exportPdf}
          disabled={isStreaming}
          title="Export report as PDF"
          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-400 transition hover:text-white disabled:opacity-40"
        >
          <FileDown size={14} />
        </button>
      </div>

      {/* Streaming progress */}
      {isStreaming && (
        <div className="flex items-center gap-2 border-b border-cyan-500/20 bg-cyan-500/5 px-4 py-2 text-xs text-cyan-300">
          <Loader2 size={13} className="animate-spin" /> Researching — sources & sections are still arriving…
        </div>
      )}

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Sources sidebar */}
        <aside className="scrollbar-thin max-h-44 shrink-0 overflow-y-auto border-b border-white/10 p-3 lg:max-h-none lg:w-60 lg:border-b-0 lg:border-r">
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <Globe size={11} /> Sources ({sources.length})
          </p>
          {sources.length === 0 ? (
            <p className="px-1 text-[11px] leading-relaxed text-zinc-600">
              No structured citations were returned — source links are inline in the report.
            </p>
          ) : (
            <ol className="space-y-1">
              {sources.map((s, i) => (
                <li key={`${s.url}-${i}`}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/5"
                  >
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded bg-cyan-500/15 text-[9px] font-bold text-cyan-300">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium text-zinc-300 group-hover:text-white">
                        {s.title || hostOf(s.url)}
                      </span>
                      <span className="block truncate text-[10px] text-zinc-600">{hostOf(s.url)}</span>
                    </span>
                    <ExternalLink size={10} className="mt-1 shrink-0 text-zinc-700 opacity-0 transition group-hover:opacity-100" />
                  </a>
                </li>
              ))}
            </ol>
          )}
        </aside>

        {/* Report body */}
        <div className="scrollbar-thin min-w-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6">
          <MarkdownRenderer content={content} streaming={isStreaming} />
        </div>
      </div>
    </div>
  );
}