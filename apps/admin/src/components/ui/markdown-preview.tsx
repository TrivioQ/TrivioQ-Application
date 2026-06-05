'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownPreviewProps {
  value: string;
  className?: string;
  /** Compact mode: tighter margins, used for choice previews */
  compact?: boolean;
}

/**
 * Live markdown preview for the admin panel.
 * Renders GFM + KaTeX math, with the same component overrides as the web renderer.
 */
export function MarkdownPreview({ value, className = '', compact = false }: MarkdownPreviewProps) {
  if (!value.trim()) {
    return (
      <div className={`text-sm text-muted-foreground italic px-3 py-2 border rounded-md bg-muted/30 ${className}`}>
        Preview will appear here…
      </div>
    );
  }

  return (
    <div className={`tq-md-preview prose prose-sm dark:prose-invert max-w-none border rounded-md px-3 py-2 bg-muted/30 text-sm ${compact ? 'space-y-0.5' : 'space-y-1'} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt ?? ''} className="max-w-full h-auto rounded my-1 object-contain" style={{ maxHeight: '250px' }} />
          ),
          p: ({ children }) => <p className={compact ? 'my-0' : 'my-1 last:mb-0'}>{children}</p>,
          code: ({ children, className: cls }) => {
            const isBlock = cls?.includes('language-');
            return isBlock ? (
              <code className="block bg-muted rounded px-2 py-1.5 text-xs font-mono overflow-x-auto whitespace-pre my-1">{children}</code>
            ) : (
              <code className="bg-muted rounded px-1 py-0.5 text-xs font-mono">{children}</code>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-1">
              <table className="min-w-full text-xs border-collapse border border-border">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-border bg-muted/50 px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/40 pl-3 italic text-muted-foreground my-1">{children}</blockquote>
          ),
          ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
              {children}
            </a>
          ),
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
