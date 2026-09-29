// src/components/CameraModal.jsx
// Shutter, flash, film strip (~230 lines) [Batch 4]
// ═══════════════════════════════════════════════════════════════
//  CameraModal — live preview, shutter with flash effect,
//  front/back switching, film-strip of shots, multi-photo attach.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Camera, Check, ImagePlus, Loader2, SwitchCamera, X } from 'lucide-react';

import Modal from './Modal';
import { useCamera } from '../hooks/useCamera';
import { createImageAttachment } from '../lib/files';
import { cn } from '../lib/utils';

const MAX_SHOTS = 8;

export default function CameraModal({ open, onClose, onUse }) {
  const cam = useCamera();
  const [shots, setShots] = useState([]);
  const [flash, setFlash] = useState(false);

  // Start on open, stop on close (cleanup handles both paths)
  useEffect(() => {
    if (open) {
      setShots([]);
      cam.start().catch(() => {});
    }
    return () => {
      if (open) cam.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shoot = () => {
    try {
      const dataUrl = cam.capture({ maxDim: 1568, quality: 0.9 });
      setFlash(true);
      setTimeout(() => setFlash(false), 160);
      setShots((s) => (s.length >= MAX_SHOTS ? s : [...s, dataUrl]));
    } catch {
      /* cam.error surfaces the problem */
    }
  };

  const usePhotos = () => {
    if (!shots.length) return;
    const atts = shots.map((src, i) =>
      createImageAttachment(src, `camera-${Date.now()}-${i + 1}.jpg`)
    );
    onUse?.(atts);
    onClose?.();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Camera"
      subtitle="Take a photo to send to a vision model"
      icon={Camera}
      width="max-w-lg"
    >
      <div className="space-y-4 p-5">
        {/* Preview */}
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
          {/* Flash */}
          {flash && <div className="absolute inset-0 animate-fade-in bg-white" />}

          {!cam.isActive && (
            <div className="absolute inset-0 grid place-items-center">
              {cam.isStarting ? (
                <Loader2 size={22} className="animate-spin text-zinc-400" />
              ) : cam.error ? (
                <p className="max-w-[80%] text-center text-xs text-red-300">{cam.error.message}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => cam.start()}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                >
                  Start camera
                </button>
              )}
            </div>
          )}

          {/* Facing indicator */}
          {cam.isActive && (
            <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300 backdrop-blur">
              {cam.facing === 'user' ? 'Front' : 'Back'}
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {cam.deviceCount > 1 && (
            <button
              type="button"
              onClick={cam.switchCamera}
              disabled={!cam.isActive}
              title="Switch camera"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 disabled:opacity-40"
            >
              <SwitchCamera size={17} />
            </button>
          )}

          <button
            type="button"
            onClick={shoot}
            disabled={!cam.isActive}
            title="Capture"
            aria-label="Capture photo"
            className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-glow transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Camera size={22} />
          </button>

          {shots.length > 0 ? (
            <button
              type="button"
              onClick={() => setShots([])}
              title="Clear all shots"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:border-red-500/40 hover:text-red-400"
            >
              <X size={16} />
            </button>
          ) : (
            <span className="h-10 w-10" />
          )}
        </div>

        {/* Film strip */}
        {shots.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {shots.map((src, i) => (
              <div key={i} className="group relative">
                <img
                  src={src}
                  alt={`Shot ${i + 1}`}
                  className="h-16 w-16 rounded-lg border border-emerald-500/30 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setShots((s) => s.filter((_, j) => j !== i))}
                  aria-label={`Remove shot ${i + 1}`}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-white/10 bg-surface-3 text-zinc-400 shadow transition hover:text-red-400"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm text-zinc-400 transition hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={usePhotos}
            disabled={!shots.length}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {shots.length > 1 ? <ImagePlus size={15} /> : <Check size={15} />}
            Add {shots.length || ''} photo{shots.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </Modal>
  );
}