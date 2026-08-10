'use client';

import * as React from 'react';
import Link from 'next/link';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import { Check, Copy } from 'lucide-react';

import { cn } from '@/lib/utils';
import { isEmojiOnly, linkifyMentions } from '@/features/messages/markdown';

function CodeBlock({ children, ...props }: React.ComponentProps<'pre'>) {
  const [copied, setCopied] = React.useState(false);
  const ref = React.useRef<HTMLPreElement>(null);

  const copy = async () => {
    const text = ref.current?.innerText ?? '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; failing silently beats an error toast here.
    }
  };

  return (
    <div className="group/code relative">
      <pre ref={ref} {...props}>
        {children}
      </pre>
      <button
        type="button"
        onClick={copy}
        className={cn(
          'absolute right-2 top-2 grid size-7 place-items-center rounded-lg',
          'border border-[var(--hairline)] bg-[var(--surface)] text-[var(--text-3)]',
          'opacity-0 transition-all duration-150 group-hover/code:opacity-100',
          'hover:text-[var(--text-1)] focus-visible:opacity-100',
        )}
        aria-label={copied ? 'Copied' : 'Copy code'}
      >
        {copied ? <Check className="size-3.5 text-[var(--success)]" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

const components: Components = {
  pre: CodeBlock,
  a({ href, children, ...props }) {
    if (href?.startsWith('/')) {
      return (
        <Link href={href} className="font-medium">
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" {...props}>
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    if (typeof src !== 'string') return null;
    return (
      // Markdown images are rare and arbitrary-origin, so they stay unoptimised.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ''}
        loading="lazy"
        className="max-h-80 rounded-[var(--radius-field)] border border-[var(--hairline)]"
      />
    );
  },
};

const remarkPlugins = [remarkGfm];
// Sanitise first, then highlight — the highlighter only ever adds <span>s.
const rehypePlugins = [rehypeSanitize, rehypeHighlight];

export const MessageContent = React.memo(function MessageContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const source = React.useMemo(() => linkifyMentions(content), [content]);
  const jumbo = React.useMemo(() => isEmojiOnly(content), [content]);

  if (jumbo) {
    return <p className={cn('text-[2.5rem] leading-tight', className)}>{content.trim()}</p>;
  }

  return (
    <div className={cn('markdown', className)}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
});
