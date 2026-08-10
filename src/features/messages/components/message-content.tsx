'use client';

import * as React from 'react';
import Link from 'next/link';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

type RehypePlugins = NonNullable<React.ComponentProps<typeof ReactMarkdown>['rehypePlugins']>;

const remarkPlugins = [remarkGfm];
const sanitiseOnly: RehypePlugins = [rehypeSanitize];

/** Fetched at most once per session, then reused by every message. */
let highlightPlugin: RehypePlugins[number] | null = null;

/**
 * `rehype-highlight` drags in highlight.js — around 170 kB that only earns its
 * place when a message actually contains a fenced code block, and most do not.
 * Keeping it in the static import put it on the critical path of the chat
 * route for everyone.
 *
 * Until it arrives the block renders unhighlighted: the same code without
 * colour, rather than a message that is missing.
 */
function useHighlightPlugin(content: string): RehypePlugins {
  const needed = React.useMemo(() => content.includes('```'), [content]);
  // Both reads are wrapped: a plugin is a function, and bare functions are
  // treated as lazy initialisers / updaters by `useState`.
  const [loaded, setLoaded] = React.useState<RehypePlugins[number] | null>(() => highlightPlugin);

  React.useEffect(() => {
    if (!needed || highlightPlugin) return;

    let cancelled = false;
    void import('rehype-highlight').then((module) => {
      highlightPlugin = module.default;
      // Wrapped in a function: the plugin is itself a function, which
      // `setState` would otherwise treat as an updater.
      if (!cancelled) setLoaded(() => module.default);
    });

    return () => {
      cancelled = true;
    };
  }, [needed]);

  return React.useMemo(
    // Sanitise first, then highlight — the highlighter only ever adds <span>s.
    () => (needed && loaded ? [rehypeSanitize, loaded] : sanitiseOnly),
    [needed, loaded],
  );
}

export const MessageContent = React.memo(function MessageContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const source = React.useMemo(() => linkifyMentions(content), [content]);
  const jumbo = React.useMemo(() => isEmojiOnly(content), [content]);
  const rehypePlugins = useHighlightPlugin(content);

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
