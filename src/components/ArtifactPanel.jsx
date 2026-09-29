// src/components/ArtifactPanel.jsx
// Live preview, file tree, ZIP (~460 lines) [Batch 5]
// ═══════════════════════════════════════════════════════════════
//  ArtifactPanel — slide-over workspace for Build / Image /
//  Research results.
//  Project view: file tree + syntax-highlighted viewer, LIVE
//  sandboxed iframe preview (inlines local <link>/<script> refs,
//  localStorage shim for sandboxed games), refresh, open-in-tab,
//  per-file download, ZIP export, run guide.
//  Dispatches to <ImageResult/> and <ResearchReport/> for the
//  other artifact types.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BookOpen, ChevronDown, ChevronRight, Code2, Download,
  Eye, ExternalLink, File as FileIcon, FolderTree, Image as ImageIcon,
  Package, RefreshCw, X,
} from 'lucide-react';

import MarkdownRenderer from './MarkdownRenderer';
import ImageResult from './ImageResult';
import ResearchReport from './ResearchReport';
import { buildFileTree, downloadProjectFile, findHtmlEntry, zipProject } from '../lib/project';
import { getModelLabel } from '../config/models';
import { cn, formatBytes } from '../lib/utils';

// ── Preview HTML builder ──────────────────────────────────────

function normalizeRel(ref) {
  const parts = [];
  String(ref).split('?')[0].split('#')[0].split('/').forEach((p) => {
    if (p === '..') parts.pop();
    else if (p !== '.' && p !== '') parts.push(p);
  });
  return parts.join('/').toLowerCase();
}

function resolveFile(byPath, ref, entryPath) {
  if (!ref) return null;
  const norm = normalizeRel(ref);
  if (byPath.has(norm)) return byPath.get(norm);
  const dir = entryPath.includes('/') ? entryPath.slice(0, entryPath.lastIndexOf('/') + 1) : '';
  const joined = normalizeRel(dir + norm);
  if (byPath.has(joined)) return byPath.get(joined);
  const suffixHit = [...byPath.keys()].find((k) => k.endsWith(`/${norm}`));
  return suffixHit ? byPath.get(suffixHit) : null;
}

/** In-memory localStorage shim for sandboxed iframes (games store high scores). */
const STORAGE_SHIM = `<script>(function(){try{window.localStorage.getItem('__nova_t')}catch(e){var m={};var f={getItem:function(k){return Object.prototype.hasOwnProperty.call(m,k)?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}};try{Object.defineProperty(window,'localStorage',{value:f,configurable:true})}catch(_){ }try{Object.defineProperty(window,'sessionStorage',{value:f,configurable:true})}catch(_){ }}})();<\/script>`;

function buildPreviewHtml(project) {
  const entry = findHtmlEntry(project.files);
  if (!entry) return null;
  const byPath = new Map(project.files.map((f) => [f.path.toLowerCase(), f]));
  let html = entry.content;

  // Inline local stylesheets
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel=["']?stylesheet/i.test(tag)) return tag;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    const f = resolveFile(byPath, href, entry.path);
    return f ? `<style>\n${f.content}\n</style>` : tag;
  });

  // Inline local scripts
  html = html.replace(/<script\b([^>]*)>\s*<\/script>/gi, (tag, attrs) => {
    const src = attrs.match(/src=["']([^"']+)["']/i)?.[1];
    if (!src) return tag;
    const f = resolveFile(byPath, src, entry.path);
    if (!f) return tag;
    const rest = attrs.replace(/\bsrc=["'][^"']*["']/i, '');
    return `<script${rest}>\n${f.content}\n<\/script>`;
  });

  // Inject the storage shim
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => m + STORAGE_SHIM);
  else html = STORAGE_SHIM + html;

  return html;
}

// ── File tree ─────────────────────────────────────────────────

function TreeNode({ node, depth, activePath, onSelect, expanded, onToggleDir }) {
  if (node.type === 'dir') {
    const open = expanded.has(node.path);
    return (
      <li>
        <button
          type="button"
          onClick={() => onToggleDir(node.path)}
          className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11px] font-semibold text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          style={{ paddingLeft: 6 + depth * 12 }}
        >
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          {node.name}/
        </button>
        {open && (
          <ul>
            {node.children.map((c) => (
              <TreeNode
                key={c.path}
                node={c}
                depth={depth + 1}
                activePath={activePath}
                onSelect={onSelect}
                expanded={expanded}
                onToggleDir={onToggleDir}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li className="group/file relative">
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md py-1 pr-6 text-left text-[11px] transition',
          node.path === activePath
            ? 'bg-violet-500/15 text-violet-200'
            : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
        )}
        style={{ paddingLeft: 6 + depth * 12 }}
        title={node.path}
      >
        <FileIcon size={11} className="shrink-0 text-violet-400/70" />
        <span className="truncate font-mono">{node.name}</span>
        <span className="ml-auto shrink-0 text-[9px] text-zinc-600">{formatBytes(node.file.bytes)}</span>
      </button>
      <button
        type="button"
        onClick={() => downloadProjectFile(node.file)}
        title="Download this file"
        aria-label={`Download ${node.name}`}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-600 opacity-0 transition hover:text-violet-300 group-hover/file:opacity-100"
      >
        <Download size={11} />
      </button>
    </li>
  );
}

// ── Project artifact body ─────────────────────────────────────

function ProjectView({ project, chat, onZippingChange }) {
  const entry = useMemo(() => findHtmlEntry(project.files), [project]);
  const previewHtml = useMemo(() => buildPreviewHtml(project), [project]);
  const previewable = !!previewHtml;

  const [view, setView] = useState(previewable ? 'preview' : 'code');
  const [activePath, setActivePath] = useState(entry?.path || project.files[0]?.path || '');
  const [previewKey, setPreviewKey] = useState(0);
  const [zipping, setZipping] = useState(false);
  const [runOpen, setRunOpen] = useState(false);

  // Reset when a new project arrives
  useEffect(() => {
    const e = findHtmlEntry(project.files);
    setView(e ? 'preview' : 'code');
    setActivePath(e?.path || project.files[0]?.path || '');
    setPreviewKey((k) => k + 1);
  }, [project]);

  useEffect(() => onZippingChange?.(zipping), [zipping, onZippingChange]);

  const expanded = useMemo(() => {
    const s = new Set();
    project.files.forEach((f) => f.dir && s.add(f.dir));
    return s;
  }, [project]);
  const [manualExpanded, setManualExpanded] = useState(null);
  const effectiveExpanded = manualExpanded || expanded;
  const toggleDir = (p) => {
    const base = manualExpanded || new Set(expanded);
    const next = new Set(base);
    next.has(p) ? next.delete(p) : next.add(p);
    setManualExpanded(next);
  };

  const tree = useMemo(() => buildFileTree(project.files), [project]);
  const activeFile = project.files.find((f) => f.path === activePath) || project.files[0];
  const fenced = useMemo(
    () =>
      activeFile
        ? '````' + (activeFile.language || '') + '\n' + activeFile.content + '\n````'
        : '',
    [activeFile]
  );

  const openExternal = () => {
    if (!previewHtml) return;
    const url = URL.createObjectURL(new Blob([previewHtml], { type: 'text/html' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const downloadZip = async () => {
    setZipping(true);
    try {
      await zipProject(project, project.title || chat?.title || 'nova-project');
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Stats + toolbar */}
      <div className="border-b border-white/10 px-4 py-3">
        {project.title && <h3 className="mb-2 truncate text-sm font-semibold text-white">{project.title}</h3>}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-300">
            {project.stats.count} files
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">
            {formatBytes(project.stats.bytes)}
          </span>
          {project.stats.previewable && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">previewable</span>
          )}
          {project.stats.hasBackend && (
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] text-sky-300">has backend</span>
          )}
          {project.stats.languages.slice(0, 4).map((l) => (
            <span key={l} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-500">{l}</span>
          ))}

          <div className="flex-1" />

          {/* Code / Preview toggle */}
          {previewable && (
            <div className="flex overflow-hidden rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setView('code')}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition',
                  view === 'code' ? 'bg-violet-500/20 text-violet-200' : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                <Code2 size={12} /> Code
              </button>
              <button
                type="button"
                onClick={() => setView('preview')}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition',
                  view === 'preview' ? 'bg-violet-500/20 text-violet-200' : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                <Eye size={12} /> Preview
              </button>
            </div>
          )}

          {view === 'preview' && previewable && (
            <>
              <button
                type="button"
                onClick={() => setPreviewKey((k) => k + 1)}
                title="Reload preview"
                className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-400 transition hover:text-white"
              >
                <RefreshCw size={13} />
              </button>
              <button
                type="button"
                onClick={openExternal}
                title="Open in new tab"
                className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-400 transition hover:text-white"
              >
                <ExternalLink size={13} />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={downloadZip}
            disabled={zipping}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-glow-sm transition hover:brightness-110 disabled:opacity-50"
          >
            <Package size={12} /> {zipping ? 'Zipping…' : 'Download ZIP'}
          </button>
        </div>
      </div>

      {/* Backend notice */}
      {view === 'preview' && previewable && project.stats.hasBackend && (
        <p className="flex items-start gap-1.5 border-b border-amber-500/20 bg-amber-500/5 px-4 py-2 text-[11px] text-amber-300">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          This project includes a backend — the preview runs only the static frontend. Download the
          ZIP and follow the run guide for the full stack.
        </p>
      )}

      {/* Tree + viewer */}
      <div className="flex min-h-0 flex-1">
        {/* Tree */}
        <aside className="scrollbar-thin w-48 shrink-0 overflow-y-auto border-r border-white/10 p-2 sm:w-52">
          <p className="mb-1.5 flex items-center gap-1.5 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            <FolderTree size={11} /> Files
          </p>
          <ul>
            {tree.map((n) => (
              <TreeNode
                key={n.path}
                node={n}
                depth={0}
                activePath={activePath}
                onSelect={setActivePath}
                expanded={effectiveExpanded}
                onToggleDir={toggleDir}
              />
            ))}
          </ul>
        </aside>

        {/* Viewer / Preview */}
        <div className="scrollbar-thin min-w-0 flex-1 overflow-y-auto">
          {view === 'preview' && previewable ? (
            <iframe
              key={previewKey}
              title="Project preview"
              srcDoc={previewHtml}
              sandbox="allow-scripts allow-modals allow-forms allow-popups"
              className="h-full min-h-[320px] w-full border-0 bg-white"
            />
          ) : activeFile ? (
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate font-mono text-[11px] text-zinc-500" title={activeFile.path}>
                  {activeFile.path}
                </span>
                <button
                  type="button"
                  onClick={() => downloadProjectFile(activeFile)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-zinc-400 transition hover:text-white"
                >
                  <Download size={10} /> Save
                </button>
              </div>
              <MarkdownRenderer content={fenced} />
            </div>
          ) : (
            <p className="p-6 text-center text-sm text-zinc-600">No files detected.</p>
          )}
        </div>
      </div>

      {/* Run guide */}
      {project.runGuide && (
        <div className="border-t border-white/10">
          <button
            type="button"
            onClick={() => setRunOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-zinc-300 transition hover:bg-white/5"
          >
            <ChevronDown size={13} className={cn('transition-transform', !runOpen && '-rotate-90')} />
            Run guide
          </button>
          {runOpen && (
            <pre className="scrollbar-thin max-h-40 overflow-y-auto whitespace-pre-wrap border-t border-white/5 bg-black/30 px-4 py-3 font-mono text-[11px] leading-5 text-zinc-400">
              {project.runGuide}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ── Panel shell ───────────────────────────────────────────────

const TYPE_META = {
  project: { label: 'Project', icon: FolderTree },
  images: { label: 'Images', icon: ImageIcon },
  research: { label: 'Report', icon: BookOpen },
};

export default function ArtifactPanel({ artifact, open, onClose, chat, onAttachImage }) {
  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!artifact) return null;

  const meta = TYPE_META[artifact.type] || TYPE_META.project;
  const HeaderIcon = meta.icon;

  const title =
    artifact.type === 'project'
      ? artifact.project.title || chat?.title || 'Project'
      : artifact.type === 'images'
        ? `Generated by ${getModelLabel(artifact.message?.model)}`
        : chat?.title || 'Research report';

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-40 flex w-full transform flex-col border-l border-white/10 bg-surface-1 shadow-2xl transition-transform duration-200 sm:max-w-xl xl:max-w-3xl',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
            <HeaderIcon size={16} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
              <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                {meta.label}
              </span>
            </div>
            <p className="truncate text-[11px] text-zinc-500">
              {artifact.type === 'project'
                ? `${artifact.project.stats.count} files · ${formatBytes(artifact.project.stats.bytes)}`
                : artifact.type === 'images'
                  ? `${artifact.message?.images?.length || 0} image(s)`
                  : `${artifact.message?.annotations?.length || 0} sources`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1">
          {artifact.type === 'project' && (
            <ProjectView project={artifact.project} chat={chat} />
          )}
          {artifact.type === 'images' && (
            <ImageResult
              images={artifact.message?.images || []}
              prompt={artifact.message?.content || ''}
              model={artifact.message?.model}
              onAttach={onAttachImage}
            />
          )}
          {artifact.type === 'research' && (
            <ResearchReport message={artifact.message} chat={chat} />
          )}
        </div>
      </aside>
    </>
  );
}