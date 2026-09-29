// src/lib/project.js
// '### FILE:' parser, fence scanner, file tree, stats, slugify, JSZip (~250 lines) [Batch 2]
// ═══════════════════════════════════════════════════════════════
//  Project builder — parses Build-mode output into files,
//  builds a file tree, and exports a ready-to-run ZIP.
//
//  Expected model format (enforced by SYSTEM_PROMPTS.build):
//    ### FILE: relative/path.ext
//    ```lang
//    <complete file content>
//    ```
//    ...
//    ### RUN
//    1. steps...
//  The parser is tolerant: it also accepts **FILE:** headers,
//  fence info strings that look like paths, and filenames on the
//  line above a code fence.
// ═══════════════════════════════════════════════════════════════

import JSZip from 'jszip';
import { APP_NAME } from '../config/constants';
import { downloadFile, getLanguageFromFilename } from './utils';

export function slugify(str = '') {
  return (
    String(str)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'nova-project'
  );
}

// ── Fence scanner (robust: handles ``` and ~~~, multi-line) ───

function scanFences(text) {
  const out = [];
  const lines = text.split('\n');
  const lineOffsets = [];
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }

  let i = 0;
  while (i < lines.length) {
    const open = lines[i].match(/^\s*(`{3,}|~{3,})\s*(.*)$/);
    if (!open) {
      i++;
      continue;
    }
    const fence = open[1];
    const info = (open[2] || '').trim();
    const start = lineOffsets[i];
    const body = [];
    let j = i + 1;
    let closed = false;

    for (; j < lines.length; j++) {
      const close = lines[j].match(/^\s*(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) {
        closed = true;
        j++;
        break;
      }
      body.push(lines[j]);
    }

    out.push({
      info,
      code: body.join('\n'),
      start,
      end: closed ? lineOffsets[Math.min(j, lineOffsets.length - 1)] : offset,
    });
    i = j;
  }
  return out;
}

// ── Path helpers ──────────────────────────────────────────────

function cleanPath(raw = '') {
  let p = String(raw).trim();
  p = p.replace(/^[`'"*(\[]+/, '').replace(/[`'"*)\],.]+$/, '');
  p = p.replace(/^\.?\//, '');
  p = p.split(/\s+/)[0];
  return p;
}

function looksLikePath(s = '') {
  if (!s || /\s/.test(s)) return false;
  if (/^(text|plaintext|txt|code|json5?)$/i.test(s)) return false;
  return /\.[a-z0-9]{1,8}$/i.test(s) || s.includes('/');
}

function extractFilename(line = '') {
  const m = String(line).match(/[A-Za-z0-9_.\-/]{2,64}\.[A-Za-z0-9]{1,8}/);
  return m ? m[0] : null;
}

function makeFile(path, code, fenceInfo) {
  const content = code.replace(/\s+$/, '');
  return {
    path,
    name: path.split('/').pop(),
    dir: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '',
    content,
    language:
      fenceInfo && fenceInfo.length <= 12 && !fenceInfo.includes('/') && !fenceInfo.includes('.')
        ? fenceInfo
        : getLanguageFromFilename(path),
    bytes: new TextEncoder().encode(content).length,
  };
}

// ── Section extraction ────────────────────────────────────────

function extractProjectTitle(text) {
  const m = text.match(/^#\s+(.{3,80})\s*$/m);
  return m ? m[1].replace(/[*_`]/g, '').trim() : '';
}

function extractRunGuide(text) {
  const re = /^[ \t]*(?:#{1,4}[ \t]*)?(?:\*\*)?[ \t]*RUN[ \t]*(?:\*\*)?[ \t]*:?[ \t]*$/gim;
  const m = re.exec(text);
  if (!m) return '';
  const rest = text.slice(m.index + m[0].length);
  const nextHeading = rest.match(/\n[ \t]*#{1,4}[ \t]/);
  return (nextHeading ? rest.slice(0, nextHeading.index) : rest).trim();
}

// ── Main parser ───────────────────────────────────────────────

export function parseProject(text = '') {
  const fences = scanFences(text);
  let files = [];

  // Strategy 1: explicit FILE headers followed by a fenced block
  const headerRe =
    /^[ \t]*(?:#{1,4}[ \t]*)?(?:\*\*)?[ \t]*FILE[ \t]*(?:\*\*)?[ \t]*:[ \t]*(.+?)[ \t]*$/gim;
  const headers = [];
  let hm;
  while ((hm = headerRe.exec(text)) !== null) {
    const path = cleanPath(hm[1]);
    if (path) headers.push({ path, headerEnd: hm.index + hm[0].length });
  }

  for (const h of headers) {
    const fence = fences.find((f) => f.start >= h.headerEnd && f.start - h.headerEnd < 200);
    if (fence && fence.code.trim()) files.push(makeFile(h.path, fence.code, fence.info));
  }

  // Strategy 2 (fallback): fences whose info string or preceding
  // lines look like a file path
  if (files.length === 0) {
    for (const f of fences) {
      if (!f.code.trim()) continue;
      if (looksLikePath(f.info)) {
        files.push(makeFile(cleanPath(f.info), f.code, ''));
        continue;
      }
      const before = text.slice(Math.max(0, f.start - 300), f.start);
      const candidates = before.split('\n').filter(Boolean).reverse().slice(0, 3);
      const found = candidates.map(extractFilename).find(Boolean);
      if (found) files.push(makeFile(cleanPath(found), f.code, f.info));
    }
  }

  // De-duplicate by path (later definitions win)
  const map = new Map();
  for (const f of files) map.set(f.path, f);
  files = [...map.values()];

  return {
    title: extractProjectTitle(text),
    files,
    runGuide: extractRunGuide(text),
    stats: getProjectStats(files),
  };
}

export function parseProjectFromMessages(messages = []) {
  const text = messages
    .filter((m) => m.role === 'assistant')
    .map((m) => m.content || '')
    .join('\n\n');
  return parseProject(text);
}

// ── Tree & stats ──────────────────────────────────────────────

export function buildFileTree(files) {
  const root = { name: '', path: '', type: 'dir', children: [] };
  const dirs = new Map([['', root]]);

  const ensureDir = (dirPath) => {
    if (dirs.has(dirPath)) return dirs.get(dirPath);
    const parts = dirPath.split('/');
    const name = parts.pop();
    const parent = ensureDir(parts.join('/'));
    const node = { name, path: dirPath, type: 'dir', children: [] };
    parent.children.push(node);
    dirs.set(dirPath, node);
    return node;
  };

  for (const f of files) {
    ensureDir(f.dir).children.push({ name: f.name, path: f.path, type: 'file', file: f });
  }

  const sortRec = (node) => {
    node.children.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1
    );
    node.children.forEach((c) => c.type === 'dir' && sortRec(c));
  };
  sortRec(root);
  return root.children;
}

export function findHtmlEntry(files) {
  return (
    files.find((f) => f.path.toLowerCase() === 'index.html') ||
    files.find((f) => f.path.toLowerCase().endsWith('/index.html')) ||
    files.find((f) => f.path.toLowerCase().endsWith('.html')) ||
    null
  );
}

export function getProjectStats(files) {
  const languages = [...new Set(files.map((f) => f.language).filter(Boolean))];
  const bytes = files.reduce((s, f) => s + (f.bytes || 0), 0);
  const hasBackend =
    files.some((f) => /(^|\/)(server|backend|api)(\/|$)/i.test(f.path)) ||
    files.some((f) => /server\./i.test(f.name));
  const entry = findHtmlEntry(files);
  return { count: files.length, bytes, languages, hasBackend, previewable: !!entry, entryPath: entry?.path || null };
}

// ── Exports ───────────────────────────────────────────────────

function buildReadme(project) {
  const lines = [];
  lines.push(`# ${project.title || 'Nova Project'}`);
  lines.push('');
  lines.push(`Generated with ${APP_NAME} — powered by OpenRouter.`);
  lines.push('');
  lines.push(`## Files (${project.files.length})`);
  lines.push('');
  for (const f of project.files) lines.push(`- \`${f.path}\``);
  if (project.runGuide) {
    lines.push('');
    lines.push('## Run');
    lines.push('');
    lines.push(project.runGuide);
  }
  return lines.join('\n');
}

export async function zipProject(project, name = 'nova-project') {
  const zip = new JSZip();
  for (const f of project.files) zip.file(f.path, f.content);
  if (!project.files.some((f) => f.path.toLowerCase() === 'readme.md')) {
    zip.file('README.md', buildReadme(project));
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  downloadFile(`${slugify(name)}.zip`, blob, 'application/zip');
  return blob;
}

export function downloadProjectFile(file) {
  downloadFile(file.name, file.content, 'text/plain;charset=utf-8');
}