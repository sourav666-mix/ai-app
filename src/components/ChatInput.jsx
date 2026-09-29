// src/components/ChatInput.jsx
// Composer: files, camera, drag&drop, paste, send/stop (~280 lines) [Batch 4+5 -- B5 patch: injectedAttachments prop]
// ═══════════════════════════════════════════════════════════════
//  ChatInput — the full composer:
//  auto-resizing textarea · attach files · camera · drag & drop ·
//  paste images · attachment strip · Send/Stop · injected prompts.
//  Owns text + attachment state; hands everything to onSend.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Camera, Loader2, Paperclip, Square } from 'lucide-react';

import AttachmentPreview from './AttachmentPreview';
import CameraModal from './CameraModal';
import { processFiles } from '../lib/files';
import { isCameraSupported } from '../lib/media';
import { FILE_ACCEPT, LIMITS } from '../config/constants';
import { cn } from '../lib/utils';

const PLACEHOLDERS = {
  chat: 'Message Nova…',
  research: 'What should Nova research in depth?',
  search: 'Ask anything — grounded in live web results…',
  image: 'Describe the image to generate (or attach one to edit)…',
  build: 'Describe the website, app or game to build…',
};

const ACCEPT = [
  ...FILE_ACCEPT.imageExts,
  ...FILE_ACCEPT.pdfExts,
  ...FILE_ACCEPT.textExts,
].join(',');

export default function ChatInput({
  onSend,
  onStop,
  isStreaming = false,
  mode = 'chat',
  sendOnEnter = true,
  autoFocus = false,
  injected, // text injected from outside (WelcomeScreen suggestions)
  onInjectedConsumed,
}) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);

  const taRef = useRef(null);
  const fileRef = useRef(null);
  const dragDepth = useRef(0);
  const noticeTimer = useRef(null);

  const cameraSupported = isCameraSupported();

  const flashNotice = useCallback((msg) => {
    setNotice(msg);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2600);
  }, []);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  useEffect(() => {
    if (autoFocus) taRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    // On phones the keyboard eats ~half the viewport — cap the composer lower
    const cap = typeof window !== 'undefined' && window.innerWidth < 640 ? 140 : 200;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, cap)}px`;
  }, []);

  // ── Attachments ──────────────────────────────────────────────
  const addFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      const room = LIMITS.MAX_ATTACHMENTS - attachments.length;
      if (room <= 0) {
        flashNotice(`Max ${LIMITS.MAX_ATTACHMENTS} attachments per message`);
        return;
      }
      if (files.length > room) {
        flashNotice(`Only ${room} more attachment${room > 1 ? 's' : ''} allowed`);
      }
      setBusy(true);
      const processed = await processFiles(files.slice(0, room));
      setAttachments((prev) => [...prev, ...processed]);
      setBusy(false);
    },
    [attachments.length, flashNotice]
  );

  const removeAttachment = useCallback((id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Injected prompt (from WelcomeScreen cards) ───────────────
  useEffect(() => {
    if (injected) {
      setText(injected);
      requestAnimationFrame(() => {
        taRef.current?.focus();
        resize();
      });
      onInjectedConsumed?.();
    }
  }, [injected, onInjectedConsumed, resize]);

  // ── Send / stop ──────────────────────────────────────────────
  const readyCount = attachments.filter((a) => a.status === 'ready').length;
  const canSend = !isStreaming && !busy && (text.trim().length > 0 || readyCount > 0);

  const doSend = useCallback(() => {
    if (!canSend) return;
    onSend?.({ text: text.trim(), attachments });
    setText('');
    setAttachments([]);
    requestAnimationFrame(resize);
  }, [canSend, onSend, text, attachments, resize]);

  const handleKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return;
    const sendCombo = sendOnEnter
      ? e.key === 'Enter' && !e.shiftKey
      : e.key === 'Enter' && (e.metaKey || e.ctrlKey);
    if (sendCombo) {
      e.preventDefault();
      doSend();
    }
  };

  const handlePaste = (e) => {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const iconBtn =
    'grid h-11 w-11 shrink-0 place-items-center rounded-xl text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9';

  return (
    <div className="px-1 pb-1">
      <div className="relative">
        <AttachmentPreview attachments={attachments} onRemove={removeAttachment} />

        {/* Composer */}
        <div
          className={cn(
            'relative flex items-end gap-1 rounded-2xl border bg-surface-2/90 p-2 backdrop-blur-xl transition ease-spring',
            dragOver
              ? 'border-violet-500 shadow-glow'
              : 'border-white/10 focus-within:border-violet-500/50 focus-within:shadow-glow-sm'
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            dragDepth.current += 1;
            setDragOver(true);
          }}
          onDragLeave={() => {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragOver(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            dragDepth.current = 0;
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          {dragOver && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-violet-500 bg-violet-500/10 text-sm font-medium text-violet-200">
              Drop files to attach
            </div>
          )}

          {/* Attach files */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            title="Attach files"
            className={iconBtn}
          >
            {busy ? <Loader2 size={17} className="animate-spin text-violet-400" /> : <Paperclip size={17} />}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />

          {/* Camera */}
          {cameraSupported && (
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              title="Take a photo"
              className={iconBtn}
            >
              <Camera size={17} />
            </button>
          )}

          {/* Textarea */}
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              resize();
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={1}
            placeholder={PLACEHOLDERS[mode] || PLACEHOLDERS.chat}
            className="scrollbar-thin max-h-[140px] min-h-[40px] flex-1 resize-none bg-transparent px-1.5 py-2 text-base leading-6 outline-none placeholder:text-zinc-600 sm:max-h-[200px] sm:min-h-[36px] sm:text-[15px]"
          />

          {/* Send / Stop */}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              title="Stop generating"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition ease-spring hover:border-red-500/40 hover:text-red-400 active:scale-90 sm:h-9 sm:w-9"
            >
              <Square size={14} className="fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={doSend}
              disabled={!canSend}
              aria-label="Send message"
              title="Send"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-glow-sm transition ease-spring hover:shadow-glow hover:brightness-110 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:h-9 sm:w-9"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>

      {notice && <p className="mt-1.5 px-2 text-[11px] text-amber-400">{notice}</p>}

      {/* Long-message estimate — helpful in very long chats */}
      {text.length > 200 && (
        <p className="mt-1.5 px-2 text-[10px] text-zinc-600" aria-live="polite">
          {text.length.toLocaleString()} characters · ~{Math.max(
            1,
            Math.ceil(text.length / 4)
          ).toLocaleString()} tokens
        </p>
      )}

      <p className="mt-1.5 hidden px-2 text-[10px] text-zinc-600 sm:block">
        {sendOnEnter ? 'Enter to send · Shift+Enter for newline' : 'Ctrl/⌘+Enter to send'} · Drag
        & drop or paste images to attach
      </p>

      <CameraModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onUse={(atts) =>
          setAttachments((prev) => [...prev, ...atts].slice(0, LIMITS.MAX_ATTACHMENTS))
        }
      />
    </div>
  );
}