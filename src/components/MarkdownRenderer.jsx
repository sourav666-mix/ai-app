// src/components/MarkdownRenderer.jsx
// GFM + highlight, streaming perf (~95 lines) [Batch 3]
// ═══════════════════════════════════════════════════════════════
//  MarkdownRenderer — GFM markdown → styled HTML.
//  • remark-gfm (tables, checklists, strikethrough)
//  • rehype-highlight (syntax highlighting via hljs github-dark)
//  • Custom <pre> → CodeBlock with copy/wrap, raw text extracted
//    from the hast node (survives highlight spans).
//  • While streaming VERY long content, highlighting is skipped
//    for performance and applied on the final render.
// ═══════════════════════════════════════════════════════════════

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import CodeBlock from './CodeBlock';

const HIGHLIGHT_SKIP_CHARS = 6000;

function nodeToText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.value;
  if (Array.isArray(node.children)) return node.children.map(nodeToText).join('');
  return '';
}

function extractPreMeta(node) {
  const codeEl = node?.children?.find((c) => c?.tagName === 'code') || node;
  const cls = Array.isArray(codeEl?.properties?.className)
    ? codeEl.properties.className
    : [];
  const langClass = cls.find(
    (c) => typeof c === 'string' && c.startsWith('language-')
  );
  return {
    language: langClass ? langClass.slice('language-'.length) : 'text',
    raw: nodeToText(codeEl),
  };
}

function MarkdownRenderer({ content = '', streaming = false }) {
  const skipHighlight = streaming && content.length > HIGHLIGHT_SKIP_CHARS;

  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={skipHighlight ? [] : [[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre({ node, children }) {
            const { language, raw } = extractPreMeta(node);
            return (
              <CodeBlock rawCode={raw} language={language}>
                {children}
              </CodeBlock>
            );
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownRenderer);