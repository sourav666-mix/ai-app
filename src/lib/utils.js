// src/lib/utils.js
// cn, uid, dates, bytes, clipboard, download, file readers, lang map (~200 lines) [Batch 1]
// ═══════════════════════════════════════════════════════════════
//  Shared utilities
// ═══════════════════════════════════════════════════════════════

import { clsx } from 'clsx';
import { FILE_ACCEPT } from '../config/constants';

/** Merge class names. */
export function cn(...inputs) {
  return clsx(...inputs);
}

/** Unique id generator. */
export function uid(prefix = 'id') {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${rand}`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// ── Dates ─────────────────────────────────────────────────────
export function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso);
}

// ── Numbers / text ────────────────────────────────────────────
export function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val >= 10 ? Math.round(val) : val.toFixed(1)} ${units[i]}`;
}

export function truncate(str, n = 60) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1).trimEnd() + '…' : str;
}

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Clipboard & downloads ─────────────────────────────────────
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadFile(filename, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── File reading ──────────────────────────────────────────────
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data URL
    reader.onerror = () => reject(new Error(`Failed to read "${file.name}"`));
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read "${file.name}"`));
    reader.readAsText(file);
  });
}

// ── File type helpers ─────────────────────────────────────────
export function getExtension(name = '') {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

export function isImageFile(file) {
  return (
    file.type?.startsWith('image/') ||
    FILE_ACCEPT.imageExts.includes(getExtension(file.name))
  );
}

export function isPdfFile(file) {
  return (
    file.type === 'application/pdf' ||
    FILE_ACCEPT.pdfExts.includes(getExtension(file.name))
  );
}

export function isTextFile(file) {
  return (
    file.type?.startsWith('text/') ||
    FILE_ACCEPT.textExts.includes(getExtension(file.name))
  );
}

const EXT_LANG = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript', py: 'python', rb: 'ruby', go: 'go',
  rs: 'rust', java: 'java', kt: 'kotlin', swift: 'swift', c: 'c', h: 'c',
  cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp', php: 'php', html: 'html',
  htm: 'html', xml: 'xml', css: 'css', scss: 'scss', sass: 'sass', less: 'less',
  json: 'json', md: 'markdown', markdown: 'markdown', yml: 'yaml', yaml: 'yaml',
  sh: 'bash', bash: 'bash', zsh: 'bash', sql: 'sql', graphql: 'graphql',
  gql: 'graphql', vue: 'vue', svelte: 'svelte', dart: 'dart', r: 'r',
  lua: 'lua', pl: 'perl', tex: 'latex', toml: 'toml', ini: 'ini', csv: 'csv',
};

export function getLanguageFromFilename(name = '') {
  const lower = name.toLowerCase();
  if (lower.endsWith('dockerfile')) return 'dockerfile';
  const ext = getExtension(name).slice(1);
  return EXT_LANG[ext] || 'plaintext';
}