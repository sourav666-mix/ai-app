// src/lib/exports.js
// Markdown export + jsPDF PDF writer (~270 lines) [Batch 2]
// ═══════════════════════════════════════════════════════════════
//  Exports — Markdown + PDF (jsPDF) + generic text download.
//  Note: jsPDF core fonts are WinAnsi — non-Latin text (CJK, emoji)
//  may not render in PDF. Use Markdown export for full Unicode.
// ═══════════════════════════════════════════════════════════════

import { jsPDF } from 'jspdf';
import { downloadFile, formatTime } from './utils';
import { slugify } from './project';

// ── Markdown ──────────────────────────────────────────────────

export function chatToMarkdown(chat, { includeReasoning = true, includeAttachments = true } = {}) {
  const lines = [];
  lines.push(`# ${chat.title || 'Nova conversation'}`);
  lines.push('');
  lines.push(
    `> **Model:** \`${chat.model || '—'}\` · **Mode:** ${chat.mode || 'chat'} · ` +
    `**Exported:** ${new Date().toLocaleString()} · _Nova AI Studio_`
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const m of chat.messages || []) {
    if (m.role === 'user') {
      lines.push(`## 🧑 You — ${formatTime(m.createdAt)}`);
      lines.push('');
      lines.push(m.content || '');
      if (includeAttachments && m.attachments?.length) {
        lines.push('');
        lines.push(
          '**Attachments:** ' +
            m.attachments.map((a) => `\`${a.name}\` (${a.kind})`).join(', ')
        );
      }
    } else {
      lines.push(`## 🤖 Nova${m.model ? ` · \`${m.model}\`` : ''} — ${formatTime(m.createdAt)}`);
      lines.push('');
      if (includeReasoning && m.reasoning?.trim()) {
        lines.push('<details>');
        lines.push('<summary>🧠 Reasoning</summary>');
        lines.push('');
        lines.push(m.reasoning.trim());
        lines.push('');
        lines.push('</details>');
        lines.push('');
      }
      lines.push(m.content || '');
      if (m.images?.length) {
        lines.push('');
        m.images.forEach((src, i) => lines.push(`![Generated image ${i + 1}](${src})`));
      }
      if (m.annotations?.length) {
        lines.push('');
        lines.push('**Sources:**');
        lines.push('');
        m.annotations.forEach((a, i) =>
          lines.push(`${i + 1}. [${a.title || a.url}](${a.url})`)
        );
      }
      if (m.error) {
        lines.push('');
        lines.push(`> ⚠️ ${m.error}`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function exportChatMarkdown(chat, opts) {
  const md = chatToMarkdown(chat, opts);
  const filename = `${slugify(chat.title || 'nova-chat')}.md`;
  downloadFile(filename, md, 'text/markdown;charset=utf-8');
  return filename;
}

export function exportMarkdownFile(filename, markdown) {
  downloadFile(filename, markdown, 'text/markdown;charset=utf-8');
}

// ── PDF ───────────────────────────────────────────────────────

const GRAY = [110, 110, 120];
const DARK = [35, 35, 45];
const VIOLET = [124, 58, 237];
const CYAN = [8, 145, 178];
const RED = [220, 38, 38];

async function getImageDims(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export async function exportChatPdf(chat, { includeReasoning = false } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  const writeText = (text, opts = {}) => {
    const { font = 'helvetica', style = 'normal', size = 10.5, color = DARK, indent = 0, gap = 8 } = opts;
    if (!text) return;
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text), contentWidth - indent);
    const lh = size * 1.45;
    for (const line of lines) {
      ensureSpace(lh);
      doc.text(line, margin + indent, y);
      y += lh;
    }
    y += gap;
  };

  const writeHeading = (text, color) => {
    ensureSpace(26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...color);
    doc.text(String(text), margin, y);
    y += 8;
    doc.setDrawColor(225, 225, 232);
    doc.setLineWidth(0.6);
    doc.line(margin, y, margin + contentWidth, y);
    y += 12;
  };

  const writeCode = (code) => {
    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(code.replace(/\t/g, '  '), contentWidth - 16);
    const lh = 11.5;
    for (const line of lines) {
      ensureSpace(lh + 4);
      doc.setFillColor(244, 244, 248);
      doc.rect(margin - 4, y - 8.5, contentWidth + 8, lh + 3, 'F');
      doc.setTextColor(45, 45, 70);
      doc.text(line, margin + 4, y);
      y += lh;
    }
    y += 8;
  };

  const writeMarkdownish = (content) => {
    const segments = String(content || '').split('```');
    segments.forEach((seg, i) => {
      if (i % 2 === 1) {
        const lines = seg.split('\n');
        // drop a bare language tag on the first line
        if (lines.length && /^[a-z0-9+#-]{1,15}$/i.test(lines[0].trim())) lines.shift();
        writeCode(lines.join('\n'));
      } else if (seg.trim()) {
        writeText(seg.trim());
      }
    });
  };

  const writeImage = async (src) => {
    try {
      const dims = await getImageDims(src);
      if (!dims) return;
      const w = contentWidth * 0.62;
      const h = (dims.h / dims.w) * w;
      ensureSpace(h + 16);
      const format = src.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(src, format, margin, y, w, h);
      y += h + 14;
    } catch {
      /* skip images that fail to embed */
    }
  };

  // ── Title block ──
  const title = chat.title || 'Nova conversation';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...DARK);
  const titleLines = doc.splitTextToSize(title, contentWidth);
  for (const line of titleLines) {
    doc.text(line, margin, y);
    y += 24;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(
    `Model: ${chat.model || '—'}  ·  Mode: ${chat.mode || 'chat'}  ·  Exported: ${new Date().toLocaleString()}`,
    margin,
    y
  );
  y += 20;
  doc.setDrawColor(180, 160, 255);
  doc.setLineWidth(1);
  doc.line(margin, y, margin + contentWidth, y);
  y += 20;

  // ── Messages ──
  for (const m of chat.messages || []) {
    if (m.role === 'user') {
      writeHeading(`You — ${formatTime(m.createdAt)}`, VIOLET);
      if (m.content) writeText(m.content);
      if (m.attachments?.length) {
        writeText(
          'Attachments: ' + m.attachments.map((a) => `${a.name} (${a.kind})`).join(', '),
          { size: 9, style: 'italic', color: GRAY }
        );
      }
    } else {
      writeHeading(`Nova${m.model ? ` · ${m.model}` : ''} — ${formatTime(m.createdAt)}`, CYAN);
      if (includeReasoning && m.reasoning?.trim()) {
        writeText('Reasoning', { size: 9, style: 'bold', color: GRAY, gap: 2 });
        writeText(m.reasoning.trim(), { size: 9, color: GRAY });
      }
      writeMarkdownish(m.content);
      for (const src of m.images || []) await writeImage(src);
      if (m.annotations?.length) {
        writeText(
          'Sources:\n' + m.annotations.map((a, i) => `[${i + 1}] ${a.title || ''} ${a.url}`).join('\n'),
          { size: 8.5, color: GRAY }
        );
      }
      if (m.error) writeText(`⚠ ${m.error}`, { size: 9, color: RED });
    }
    y += 12;
  }

  // ── Footers ──
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 170);
    doc.text(title.slice(0, 60), margin, pageHeight - 24);
    doc.text(`${i} / ${total}`, pageWidth - margin, pageHeight - 24, { align: 'right' });
  }

  doc.save(`${slugify(title)}.pdf`);
}