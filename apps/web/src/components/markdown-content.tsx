'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownContentProps {
  children: string;
  /** When true, renders inline (no wrapping block div, tighter spacing for option buttons) */
  inline?: boolean;
  className?: string;
}

/**
 * Renders Markdown text with GFM (tables, strikethrough, task lists) and
 * KaTeX math support ($inline$ and $$block$$).
 * Images are capped to max-width: 100% so they don't overflow containers.
 */
export function MarkdownContent({ children, inline = false, className = '' }: MarkdownContentProps) {
  const content = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        // Images — constrained and rounded
        img: ({ src, alt }) => <img src={src} alt={alt ?? ''} className="max-w-full h-auto rounded-lg my-2 object-contain" style={{ maxHeight: '300px' }} />,
        // Paragraphs — remove default margins when inline
        p: ({ children: pChildren }) => (inline ? <span className="tq-md-p">{pChildren}</span> : <p className="mb-2 last:mb-0">{pChildren}</p>),
        // Bold
        strong: ({ children: c }) => <strong className="font-bold">{c}</strong>,
        // Italic
        em: ({ children: c }) => <em className="italic">{c}</em>,
        // Inline code
        code: ({ children: c, className: cls }) => {
          const isBlock = cls?.includes('language-');
          return isBlock ? <code className="block bg-gray-100 dark:bg-white/10 rounded-md px-3 py-2 text-sm font-mono my-2 overflow-x-auto whitespace-pre">{c}</code> : <code className="bg-gray-100 dark:bg-white/10 rounded px-1 py-0.5 text-sm font-mono">{c}</code>;
        },
        // Tables — responsive wrapper
        table: ({ children: c }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full text-sm border-collapse border border-gray-200 dark:border-white/10">{c}</table>
          </div>
        ),
        th: ({ children: c }) => <th className="border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-1.5 text-left font-semibold">{c}</th>,
        td: ({ children: c }) => <td className="border border-gray-200 dark:border-white/10 px-3 py-1.5">{c}</td>,
        // Blockquote
        blockquote: ({ children: c }) => <blockquote className="border-l-4 border-indigo-400 pl-3 italic text-gray-600 dark:text-gray-400 my-2">{c}</blockquote>,
        // Lists
        ul: ({ children: c }) => <ul className="list-disc list-inside my-1 space-y-0.5">{c}</ul>,
        ol: ({ children: c }) => <ol className="list-decimal list-inside my-1 space-y-0.5">{c}</ol>,
        li: ({ children: c }) => <li className="ml-2">{c}</li>,
        // Headings (rare in questions but supported)
        h1: ({ children: c }) => <h1 className="text-xl font-bold my-2">{c}</h1>,
        h2: ({ children: c }) => <h2 className="text-lg font-bold my-1.5">{c}</h2>,
        h3: ({ children: c }) => <h3 className="text-base font-semibold my-1">{c}</h3>,
        // Horizontal rule
        hr: () => <hr className="border-gray-200 dark:border-white/10 my-2" />,
        // Links — open externally
        a: ({ href, children: c }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-500 dark:text-indigo-300 underline hover:no-underline">
            {c}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );

  if (inline) {
    return <span className={`tq-markdown-inline ${className}`}>{content}</span>;
  }

  return <div className={`tq-markdown ${className}`}>{content}</div>;
}
