// src/components/EngineLab.jsx
// /?engine verification panel (~430 lines) [Batch 2]
// ═══════════════════════════════════════════════════════════════
//  Engine Lab — Batch 2 verification panel.
//  Open with:  http://localhost:3000/?lab
//  Tests: file/PDF ingestion · camera · project parser + ZIP · exports
// ═══════════════════════════════════════════════════════════════

import { useRef, useState } from 'react';
import {
  ArrowLeft, Paperclip, Camera, FolderTree, FileDown, Play, Square,
  SwitchCamera, Download, Loader2, AlertTriangle, Check, Zap,
  FileText, Image as ImageIcon, Braces,
} from 'lucide-react';

import { processFiles } from '../lib/files';
import { useCamera } from '../hooks/useCamera';
import {
  parseProject, zipProject, buildFileTree, getProjectStats, slugify,
} from '../lib/project';
import { exportChatMarkdown, exportChatPdf } from '../lib/exports';
import { formatBytes, cn } from '../lib/utils';
import { APP_NAME, APP_VERSION } from '../config/constants';

// ── Sample data ───────────────────────────────────────────────

const SAMPLE_BUILD = [
  '# Neon Todo',
  '',
  'A tiny single-file todo app with a companion stylesheet.',
  '',
  '### FILE: index.html',
  '```html',
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '  <meta charset="UTF-8" />',
  '  <title>Neon Todo</title>',
  '  <link rel="stylesheet" href="css/style.css" />',
  '</head>',
  '<body>',
  '  <h1>Neon Todo</h1>',
  '  <input id="task" placeholder="Add a task…" />',
  '  <ul id="list"></ul>',
  '  <script src="js/app.js"></script>',
  '</body>',
  '</html>',
  '```',
  '',
  '### FILE: css/style.css',
  '```css',
  'body { margin: 0; font-family: system-ui; background: #0b0e14; color: #eee; }',
  'h1 { color: #8b5cf6; }',
  '```',
  '',
  '### FILE: js/app.js',
  '```javascript',
  "const list = document.getElementById('list');",
  "const input = document.getElementById('task');",
  "input.addEventListener('keydown', (e) => {",
  "  if (e.key === 'Enter' && input.value.trim()) {",
  "    const li = document.createElement('li');",
  '    li.textContent = input.value.trim();',
  '    list.appendChild(li);',
  "    input.value = '';",
  '  }',
  '});',
  '```',
  '',
  '### RUN',
  '1. Open `index.html` in any modern browser.',
  '2. Type a task and press Enter.',
].join('\n');

const SAMPLE_CHAT = {
  id: 'demo',
  title: 'Engine Lab Demo',
  mode: 'chat',
  model: 'openai/gpt-5.6-luna',
  messages: [
    {
      id: 'm1',
      role: 'user',
      content: 'Explain closures in one paragraph with a tiny example.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'm2',
      role: 'assistant',
      model: 'openai/gpt-5.6-luna',
      content:
        'A **closure** is a function that remembers the variables from the scope where it was created, even after that scope has finished running.\n\n```js\nfunction counter() {\n  let n = 0;          // captured by the inner function\n  return () => ++n;\n}\nconst next = counter();\nnext(); // 1\nnext(); // 2\n```',
      createdAt: new Date().toISOString(),
    },
  ],
};

// ── Shared UI bits ────────────────────────────────────────────

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-surface-1/80 p-5 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const btn =
  'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';
const btnPrimary =
  'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50';

const KIND_ICON = { image: ImageIcon, pdf: FileText, text: Braces, unknown: AlertTriangle };

// ── 1. Files ──────────────────────────────────────────────────

function FileLab() {
  const [attachments, setAttachments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = async (fileList) => {
    if (!fileList?.length) return;
    setBusy(true);
    const processed = await processFiles(fileList);
    setAttachments((prev) => [...processed, ...prev].slice(0, 12));
    setBusy(false);
  };

  return (
    <Section icon={Paperclip} title="File Ingestion" subtitle="Images · PDFs (pdf.js) · text & code — exactly what the chat will send">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition',
          dragOver ? 'border-violet-500 bg-violet-500/10' : 'border-white/15 hover:border-violet-500/50'
        )}
      >
        {busy ? (
          <Loader2 size={22} className="animate-spin text-violet-400" />
        ) : (
          <Paperclip size={22} className="text-violet-400" />
        )}
        <p className="text-sm text-zinc-300">Drop files here or click to browse</p>
        <p className="text-xs text-zinc-500">png · jpg · webp · gif · pdf · txt · md · js · py · json …</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="mt-4 space-y-3">
        {attachments.map((a) => {
          const Icon = KIND_ICON[a.kind] || Braces;
          return (
            <div key={a.id} className="rounded-xl border border-white/10 bg-surface-2 p-3">
              <div className="flex items-start gap-3">
                {a.kind === 'image' && a.dataUrl ? (
                  <img src={a.dataUrl} alt={a.name} className="h-16 w-16 rounded-lg border border-white/10 object-cover" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-lg border border-white/10 bg-white/5">
                    <Icon size={22} className="text-violet-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">{a.name}</span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                      {a.kind}
                    </span>
                    {a.status === 'ready' && <Check size={14} className="shrink-0 text-emerald-400" />}
                    {a.status === 'error' && <AlertTriangle size={14} className="shrink-0 text-red-400" />}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {formatBytes(a.size)}
                    {a.pages ? ` · ${a.pages} pages` : ''}
                    {a.language ? ` · ${a.language}` : ''}
                    {a.truncated ? ' · truncated' : ''}
                  </p>
                  {a.error && <p className="mt-1 text-xs text-red-400">{a.error}</p>}
                  {a.warning && <p className="mt-1 text-xs text-amber-400">{a.warning}</p>}
                  {a.text && (
                    <pre className="mt-2 max-h-24 overflow-hidden whitespace-pre-wrap rounded-lg bg-black/30 p-2 font-mono text-[11px] leading-4 text-zinc-400">
                      {a.text.slice(0, 240)}
                      {a.text.length > 240 ? '…' : ''}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ── 2. Camera ─────────────────────────────────────────────────

function CameraLab() {
  const cam = useCamera();
  const [shots, setShots] = useState([]);

  const capture = () => {
    try {
      const dataUrl = cam.capture();
      setShots((s) => [dataUrl, ...s].slice(0, 4));
    } catch {
      /* cam.error surfaces issues */
    }
  };

  return (
    <Section icon={Camera} title="Camera Capture" subtitle="getUserMedia → frame capture → attachment-ready data URL">
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
          <video
            ref={cam.videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              'h-full w-full object-cover transition-opacity',
              cam.isActive ? 'opacity-100' : 'opacity-20',
              cam.facing === 'user' && 'scale-x-[-1]'
            )}
          />
          {!cam.isActive && (
            <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">
              {cam.isStarting ? <Loader2 size={20} className="animate-spin" /> : 'Camera preview'}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {!cam.isActive ? (
            <button type="button" className={btnPrimary} onClick={() => cam.start()} disabled={cam.isStarting}>
              {cam.isStarting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Start camera
            </button>
          ) : (
            <>
              <button type="button" className={btnPrimary} onClick={capture}>
                <Camera size={14} /> Capture
              </button>
              {cam.deviceCount > 1 && (
                <button type="button" className={btn} onClick={cam.switchCamera}>
                  <SwitchCamera size={14} /> Switch ({cam.facing})
                </button>
              )}
              <button type="button" className={btn} onClick={cam.stop}>
                <Square size={14} /> Stop
              </button>
            </>
          )}
          {cam.error && (
            <p className="flex items-start gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {cam.error.message}
            </p>
          )}
          {!cam.supported && <p className="text-xs text-zinc-500">This browser does not expose camera APIs.</p>}
        </div>
      </div>

      {shots.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {shots.map((src, i) => (
            <img key={i} src={src} alt={`capture ${i + 1}`} className="h-20 w-20 rounded-lg border border-emerald-500/30 object-cover" />
          ))}
          <span className="self-center text-xs text-emerald-400">✓ ready to attach in chat</span>
        </div>
      )}
    </Section>
  );
}

// ── 3. Project parser + ZIP ───────────────────────────────────

function TreeList({ nodes, depth = 0 }) {
  return (
    <ul className={depth === 0 ? 'space-y-0.5' : 'space-y-0.5'}>
      {nodes.map((n) =>
        n.type === 'dir' ? (
          <li key={n.path}>
            <div style={{ paddingLeft: depth * 16 }} className="text-xs font-semibold text-zinc-400">
              📁 {n.name}/
            </div>
            <TreeList nodes={n.children} depth={depth + 1} />
          </li>
        ) : (
          <li key={n.path}>
            <div style={{ paddingLeft: depth * 16 }} className="flex items-center gap-2 text-xs text-zinc-300">
              <FileText size={12} className="text-violet-400" />
              <span className="font-mono">{n.name}</span>
              <span className="text-zinc-600">{formatBytes(n.file.bytes)}</span>
            </div>
          </li>
        )
      )}
    </ul>
  );
}

function ProjectLab() {
  const [text, setText] = useState(SAMPLE_BUILD);
  const [project, setProject] = useState(null);
  const [zipping, setZipping] = useState(false);

  const handleParse = () => setProject(parseProject(text));

  const handleZip = async () => {
    if (!project?.files?.length) return;
    setZipping(true);
    try {
      await zipProject(project, project.title || 'nova-project');
    } finally {
      setZipping(false);
    }
  };

  const tree = project?.files?.length ? buildFileTree(project.files) : [];

  return (
    <Section icon={FolderTree} title="Project Parser + ZIP" subtitle='Parses "### FILE:" build output → file tree → downloadable project'>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            spellCheck={false}
            className="w-full rounded-xl border border-white/10 bg-surface-2 p-3 font-mono text-[11px] leading-5 outline-none focus:border-violet-500/50"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" className={btnPrimary} onClick={handleParse}>
              <Zap size={14} /> Parse project
            </button>
            {project?.files?.length > 0 && (
              <button type="button" className={btn} onClick={handleZip} disabled={zipping}>
                {zipping ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download ZIP
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-surface-2 p-4">
          {!project ? (
            <p className="text-sm text-zinc-500">Parse a build output to see the detected file tree here.</p>
          ) : project.files.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-amber-400">
              <AlertTriangle size={14} /> No files detected in this text.
            </p>
          ) : (
            <>
              {project.title && <h3 className="mb-2 font-semibold text-white">{project.title}</h3>}
              <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
                <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-violet-300">{project.stats.count} files</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-zinc-400">{formatBytes(project.stats.bytes)}</span>
                {project.stats.previewable && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">previewable</span>
                )}
                {project.stats.hasBackend && (
                  <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-300">backend</span>
                )}
                {project.stats.languages.map((l) => (
                  <span key={l} className="rounded-full bg-white/5 px-2 py-0.5 text-zinc-400">{l}</span>
                ))}
              </div>
              <TreeList nodes={tree} />
              {project.runGuide && (
                <>
                  <h4 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Run guide</h4>
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2 font-mono text-[11px] text-zinc-400">
                    {project.runGuide}
                  </pre>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Section>
  );
}

// ── 4. Exports ────────────────────────────────────────────────

function ExportLab() {
  const [note, setNote] = useState('');

  const run = async (fn, label) => {
    try {
      await fn();
      setNote(`✓ ${label} — check your downloads`);
    } catch (e) {
      setNote(`✗ ${label} failed: ${e.message}`);
    }
  };

  return (
    <Section icon={FileDown} title="Exports" subtitle="Chat → Markdown & PDF (jsPDF, with code blocks and embedded images)">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={() => run(() => exportChatMarkdown(SAMPLE_CHAT), 'Markdown export')}>
          <FileText size={14} /> Export .md
        </button>
        <button type="button" className={btnPrimary} onClick={() => run(() => exportChatPdf(SAMPLE_CHAT), 'PDF export')}>
          <FileDown size={14} /> Export .pdf
        </button>
      </div>
      {note && <p className="mt-3 text-xs text-zinc-400">{note}</p>}
      <p className="mt-2 text-[11px] text-zinc-600">
        Note: PDF uses jsPDF core fonts (WinAnsi) — for CJK/emoji content prefer the Markdown export.
      </p>
    </Section>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function EngineLab() {
  return (
    <div className="min-h-screen bg-surface text-zinc-100">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">⚙️ Engine Lab</h1>
            <p className="text-sm text-zinc-400">
              {APP_NAME} v{APP_VERSION} — Batch 2 verification (the chat UI arrives in Batches 3–5)
            </p>
          </div>
          <a href="/" className={btn}>
            <ArrowLeft size={14} /> Setup screen
          </a>
        </header>

        <FileLab />
        <CameraLab />
        <ProjectLab />
        <ExportLab />

        <footer className="pt-4 text-center text-xs text-zinc-600">
          slugify sample: <span className="font-mono text-zinc-500">{slugify('My Cool App: v2!')}</span>
        </footer>
      </div>
    </div>
  );
}