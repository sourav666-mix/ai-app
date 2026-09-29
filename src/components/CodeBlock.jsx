// src/components/CodeBlock.jsx
// Copy + wrap header bar (~75 lines) [Batch 3]
// ═══════════════════════════════════════════════════════════════
//  CodeBlock — syntax-highlighted block with header bar:
//  language label · wrap toggle · copy button.
//  `children` = the pre-highlighted <code> element from
//  rehype-highlight (passed through by MarkdownRenderer).
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Check, Copy, WrapText } from 'lucide-react';
import { cn, copyToClipboard } from '../lib/utils';

export default function CodeBlock({ rawCode = '', language = 'code', children }) {
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(rawCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-white/10 bg-[#0d1117]">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          {language}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setWrap((w) => !w)}
            title={wrap ? 'Disable soft wrap' : 'Enable soft wrap'}
            className={cn(
              'rounded-md p-1.5 transition',
              wrap ? 'bg-violet-500/20 text-violet-300' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
            )}
          >
            <WrapText size={13} />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy code"
            className={cn(
              'flex items-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium transition',
              copied
                ? 'text-emerald-400'
                : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
            )}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Code body */}
      <pre
        className={cn(
          'scrollbar-thin m-0 max-h-[480px] overflow-auto p-4 text-[13px] leading-6',
          wrap && 'whitespace-pre-wrap break-words'
        )}
      >
        {children}
      </pre>
    </div>
  );
}