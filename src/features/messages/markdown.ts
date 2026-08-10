/**
 * Turns `@handle` into a markdown link, leaving code spans and fenced blocks
 * untouched so `user@host` in a snippet is never mangled.
 */
const CODE_SEGMENTS = /(```[\s\S]*?```|`[^`\n]*`)/g;
const MENTION = /(^|[^\w/@])@([a-z0-9_]{3,24})\b/g;

export function linkifyMentions(markdown: string): string {
  return markdown
    .split(CODE_SEGMENTS)
    .map((segment) =>
      segment.startsWith('`') ? segment : segment.replace(MENTION, '$1[@$2](/u/$2)'),
    )
    .join('');
}

/** A message that is nothing but emoji renders large, like every other chat app. */
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|️|‍|\s)+$/u;

export function isEmojiOnly(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 12) return false;
  return EMOJI_ONLY.test(trimmed);
}
