// src/lib/files.js
// Ingestion: image downscale, pdf.js extraction, processFiles, API message builder, image attachments (~250 lines) [Batch 2]
// ═══════════════════════════════════════════════════════════════
//  File ingestion — images, PDFs (pdf.js text extraction), text & code.
//  Produces "attachment" objects that useChat converts into
//  OpenRouter API content parts (images → image_url, docs → text).
// ═══════════════════════════════════════════════════════════════

import { LIMITS } from '../config/constants';
import {
  uid,
  fileToBase64,
  readFileAsText,
  isImageFile,
  isPdfFile,
  isTextFile,
  formatBytes,
  getLanguageFromFilename,
} from './utils';

export const MAX_IMAGE_DIM = 1568; // sweet spot for vision models
export const PDF_MAX_CHARS = 150_000;
export const TEXT_MAX_CHARS = 150_000;

// ── pdf.js is lazy-loaded (keeps the initial bundle small) ────
let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsPromise;
  // If your bundler ever complains about the worker import, replace
  // the worker line with a CDN URL matching your installed version:
  // lib.GlobalWorkerOptions.workerSrc =
  //   'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';
}

// ── Validation ────────────────────────────────────────────────

export function isSupportedFile(file) {
  return isImageFile(file) || isPdfFile(file) || isTextFile(file);
}

export function validateFile(file) {
  if (!isSupportedFile(file)) return `Unsupported file type: "${file.name || file.type}"`;
  const maxBytes = LIMITS.MAX_FILE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return `"${file.name}" is ${formatBytes(file.size)} — the limit is ${LIMITS.MAX_FILE_MB}MB`;
  }
  return null;
}

// ── Image downscaling (smaller uploads, faster vision calls) ──

export function downscaleDataUrl(dataUrl, maxDim = MAX_IMAGE_DIM, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (scale >= 1) {
        resolve(dataUrl); // already small enough — keep original (preserves GIF/PNG)
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const outType = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      resolve(canvas.toDataURL(outType, quality));
    };
    img.onerror = () => resolve(dataUrl); // fall back to original on decode failure
    img.src = dataUrl;
  });
}

// ── PDF text extraction ───────────────────────────────────────

export async function extractPdfText(file, { maxChars = PDF_MAX_CHARS } = {}) {
  const pdfjs = await loadPdfjs();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  try {
    const pages = doc.numPages;
    let out = '';
    let truncated = false;

    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();

      let pageText = '';
      for (const item of content.items) {
        if (typeof item.str !== 'string') continue;
        pageText += item.str;
        if (item.hasEOL) pageText += '\n';
      }
      pageText = pageText.replace(/[ \t]+/g, ' ').trim();

      const header = `\n\n--- Page ${i} of ${pages} ---\n`;
      const remaining = maxChars - out.length - header.length;
      if (remaining <= 0) {
        truncated = true;
        break;
      }
      if (pageText.length > remaining) {
        out += header + pageText.slice(0, remaining);
        truncated = true;
        break;
      }
      out += header + pageText;
    }

    return { text: out.trim(), pages, truncated };
  } finally {
    loadingTask.destroy();
  }
}

function capText(text, max) {
  if (text.length <= max) return { text, truncated: false };
  return {
    text: text.slice(0, max) + `\n\n[... truncated ${text.length - max} characters]`,
    truncated: true,
  };
}

// ── Core: process one file into an attachment ─────────────────

export async function processFile(file) {
  const attachment = {
    id: uid('att'),
    name: file.name || `file-${Date.now()}`,
    mime: file.type || '',
    size: file.size || 0,
    kind: 'text',
    status: 'processing',
    createdAt: new Date().toISOString(),
  };

  try {
    if (isImageFile(file)) {
      attachment.kind = 'image';
      const raw = await fileToBase64(file);
      attachment.dataUrl = await downscaleDataUrl(raw);
      attachment.status = 'ready';
      return attachment;
    }

    if (isPdfFile(file)) {
      attachment.kind = 'pdf';
      const { text, pages, truncated } = await extractPdfText(file);
      attachment.text = text;
      attachment.pages = pages;
      attachment.truncated = truncated;
      if (!text) attachment.warning = 'No extractable text — this PDF is probably scanned images.';
      attachment.status = 'ready';
      return attachment;
    }

    // Text / code file
    const raw = await readFileAsText(file);
    const { text, truncated } = capText(raw, TEXT_MAX_CHARS);
    attachment.text = text;
    attachment.truncated = truncated;
    attachment.language = getLanguageFromFilename(attachment.name);
    attachment.status = 'ready';
    return attachment;
  } catch (err) {
    attachment.status = 'error';
    attachment.error = err?.message || 'Failed to read file';
    return attachment;
  }
}

/**
 * Process a FileList/array with progress callbacks.
 * @param {FileList|File[]} fileList
 * @param {(p: {file: File, index: number, total: number, status: string, attachment?: object}) => void} [onProgress]
 */
export async function processFiles(fileList, onProgress) {
  const files = Array.from(fileList || []);
  const out = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const error = validateFile(file);
    if (error) {
      onProgress?.({ file, index: i, total: files.length, status: 'error', error });
      out.push({
        id: uid('att'),
        name: file.name || 'unknown',
        mime: file.type || '',
        size: file.size || 0,
        kind: 'unknown',
        status: 'error',
        error,
        createdAt: new Date().toISOString(),
      });
      continue;
    }
    onProgress?.({ file, index: i, total: files.length, status: 'processing' });
    const att = await processFile(file);
    out.push(att);
    onProgress?.({ file, index: i, total: files.length, status: att.status, attachment: att });
  }

  return out;
}

// ── Camera / generated-image → attachment ─────────────────────

export function createImageAttachment(dataUrl, name = 'capture.jpg') {
  const commaIdx = dataUrl.indexOf(',');
  const mime = dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/jpeg';
  return {
    id: uid('att'),
    name,
    mime,
    size: commaIdx > -1 ? Math.round((dataUrl.length - commaIdx - 1) * 0.75) : 0,
    kind: 'image',
    dataUrl,
    status: 'ready',
    createdAt: new Date().toISOString(),
  };
}

// ── Attachment → OpenRouter API message ───────────────────────

function formatAttachmentAsText(att) {
  if (att.kind === 'pdf') {
    return `Attached PDF: "${att.name}" (${att.pages ?? '?'} pages)\n\n${att.text || '(no extractable text)'}`;
  }
  const lang = att.language || getLanguageFromFilename(att.name);
  return `Attached file: "${att.name}"\n\n\`\`\`${lang}\n${att.text ?? ''}\n\`\`\``;
}

/**
 * Build a `{ role: 'user', content }` API message.
 *  - Images  → image_url parts (vision models)
 *  - PDFs/code/text → inlined as text (works on EVERY model, even non-vision)
 */
export function buildUserApiMessage(text, attachments = []) {
  const ready = (attachments || []).filter((a) => a.status === 'ready' && !a.error);
  const images = ready.filter((a) => a.kind === 'image' && a.dataUrl);
  const docs = ready.filter((a) => a.kind !== 'image');
  const cleanText = (text || '').trim();

  if (!images.length && !docs.length) {
    return { role: 'user', content: cleanText };
  }

  const parts = [];
  const docBlocks = docs.map(formatAttachmentAsText).join('\n\n');
  const combined = [cleanText, docBlocks].filter(Boolean).join('\n\n');
  if (combined) parts.push({ type: 'text', text: combined });
  for (const img of images) {
    parts.push({ type: 'image_url', image_url: { url: img.dataUrl } });
  }
  return { role: 'user', content: parts };
}

/** Short human-readable summary for UI chips. */
export function describeAttachments(attachments = []) {
  return (attachments || [])
    .filter((a) => a.status === 'ready')
    .map((a) => {
      const icon = a.kind === 'image' ? '🖼' : a.kind === 'pdf' ? '📄' : '📎';
      const pages = a.pages ? ` (${a.pages}p)` : '';
      return `${icon} ${a.name}${pages}`;
    })
    .join(', ');
}