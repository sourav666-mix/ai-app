// src/components/ImageResult.jsx
// Gallery, lightbox, edit-this (~250 lines) [Batch 5]
// ═══════════════════════════════════════════════════════════════
//  ImageResult — generated-image workspace (rendered inside the
//  Artifact panel): large gallery, lightbox with keyboard nav,
//  per-image download, download-all, and "Edit this image" which
//  pushes the picture back into the composer as an attachment.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import {
  Check, ChevronLeft, ChevronRight, Copy, Download, ImagePlus, Maximize2, X,
} from 'lucide-react';

import { getModelLabel } from '../config/models';
import { dataUrlToBlob } from '../lib/media';
import { cn, copyToClipboard, downloadFile, truncate } from '../lib/utils';

function downloadImage(src, index) {
  const blob = dataUrlToBlob(src);
  const ext = (blob.type || 'image/png').split('/')[1] || 'png';
  downloadFile(`nova-image-${Date.now()}-${index + 1}.${ext}`, blob, blob.type);
}

export default function ImageResult({ images = [], prompt = '', model, onAttach }) {
  const [lightbox, setLightbox] = useState(null); // index | null
  const [copied, setCopied] = useState(false);

  // Lightbox keyboard navigation
  useEffect(() => {
    if (lightbox == null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox((i) => Math.min(images.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setLightbox((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, images.length]);

  const downloadAll = () => {
    images.forEach((src, i) => setTimeout(() => downloadImage(src, i), i * 300));
  };

  const handleCopyPrompt = async () => {
    if ((await copyToClipboard(prompt)) === true) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Meta bar */}
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono">{getModelLabel(model)}</span>
          <span>· {images.length} image{images.length === 1 ? '' : 's'}</span>
        </div>
        {prompt && (
          <button
            type="button"
            onClick={handleCopyPrompt}
            title="Copy prompt"
            className="group mt-1.5 flex w-full items-start gap-1.5 text-left"
          >
            <span className="min-w-0 flex-1 text-xs leading-relaxed text-zinc-400 group-hover:text-zinc-300">
              {truncate(prompt, 180)}
            </span>
            {copied ? (
              <Check size={12} className="mt-0.5 shrink-0 text-emerald-400" />
            ) : (
              <Copy size={12} className="mt-0.5 shrink-0 text-zinc-600 opacity-0 transition group-hover:opacity-100" />
            )}
          </button>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={downloadAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-violet-500/40"
          >
            <Download size={12} /> Download all
          </button>
          {images.length === 1 && onAttach && (
            <button
              type="button"
              onClick={() => onAttach(images[0])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-medium text-violet-300 transition hover:bg-violet-500/20"
            >
              <ImagePlus size={12} /> Edit this image
            </button>
          )}
        </div>
      </div>

      {/* Gallery */}
      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        {images.map((src, i) => (
          <div key={i} className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
            <img src={src} alt={`Generated ${i + 1}`} className="w-full" />

            {/* Hover actions */}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1.5 bg-gradient-to-t from-black/80 to-transparent p-2.5 opacity-0 transition group-hover:opacity-100">
              {onAttach && (
                <button
                  type="button"
                  onClick={() => onAttach(src)}
                  title="Attach to composer for editing"
                  className="flex items-center gap-1 rounded-lg border border-violet-400/40 bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-violet-200 backdrop-blur transition hover:bg-violet-600/40"
                >
                  <ImagePlus size={12} /> Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => setLightbox(i)}
                title="View full size"
                className="rounded-lg border border-white/10 bg-black/60 p-1.5 text-white backdrop-blur transition hover:bg-black/80"
              >
                <Maximize2 size={13} />
              </button>
              <button
                type="button"
                onClick={() => downloadImage(src, i)}
                title="Download"
                className="rounded-lg border border-white/10 bg-black/60 p-1.5 text-white backdrop-blur transition hover:bg-black/80"
              >
                <Download size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox != null && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-zinc-400">
              {lightbox + 1} / {images.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => downloadImage(images[lightbox], lightbox)}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-200 transition hover:bg-white/10"
                title="Download"
              >
                <Download size={15} />
              </button>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                aria-label="Close"
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-200 transition hover:bg-white/10"
              >
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="relative flex flex-1 items-center justify-center p-4">
            {images.length > 1 && (
              <button
                type="button"
                onClick={() => setLightbox((i) => Math.max(0, i - 1))}
                disabled={lightbox === 0}
                aria-label="Previous"
                className="absolute left-3 rounded-full border border-white/10 bg-white/5 p-2.5 text-white transition hover:bg-white/10 disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <img src={images[lightbox]} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
            {images.length > 1 && (
              <button
                type="button"
                onClick={() => setLightbox((i) => Math.min(images.length - 1, i + 1))}
                disabled={lightbox === images.length - 1}
                aria-label="Next"
                className="absolute right-3 rounded-full border border-white/10 bg-white/5 p-2.5 text-white transition hover:bg-white/10 disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}