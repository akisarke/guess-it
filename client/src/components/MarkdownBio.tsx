import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

export type MarkdownInline =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'strong' | 'emphasis' | 'code'; readonly value: string }
  | { readonly type: 'link'; readonly label: string; readonly href: string };

export type MarkdownBlock =
  | { readonly type: 'heading' | 'paragraph'; readonly content: MarkdownInline[] }
  | { readonly type: 'list'; readonly items: MarkdownInline[][] };

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value, 'https://guessit.invalid');
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

function parseInline(source: string): MarkdownInline[] {
  const parts: MarkdownInline[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[([^\]]+)\]\(([^)]+)\))/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ type: 'text', value: source.slice(cursor, index) });
    const token = match[0];
    if (token.startsWith('**') || token.startsWith('__')) parts.push({ type: 'strong', value: token.slice(2, -2) });
    else if (token.startsWith('*') || token.startsWith('_')) parts.push({ type: 'emphasis', value: token.slice(1, -1) });
    else if (token.startsWith('`')) parts.push({ type: 'code', value: token.slice(1, -1) });
    else {
      const href = safeUrl(match[3] ?? '');
      if (href) parts.push({ type: 'link', label: match[2] ?? '', href });
      else parts.push({ type: 'text', value: token });
    }
    cursor = index + token.length;
  }
  if (cursor < source.length) parts.push({ type: 'text', value: source.slice(cursor) });
  return parts;
}

export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = source.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]?.trim() ?? '';
    if (!line) { index += 1; continue; }
    if (line.startsWith('# ')) {
      blocks.push({ type: 'heading', content: parseInline(line.slice(2)) });
      index += 1;
      continue;
    }
    if (line.startsWith('- ')) {
      const items: MarkdownInline[][] = [];
      while (index < lines.length && (lines[index]?.trim().startsWith('- ') ?? false)) {
        items.push(parseInline((lines[index] ?? '').trim().slice(2)));
        index += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && (lines[index]?.trim() ?? '') && !(lines[index]?.trim().startsWith('# ') ?? false) && !(lines[index]?.trim().startsWith('- ') ?? false)) {
      paragraph.push((lines[index] ?? '').trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', content: parseInline(paragraph.join('\n')) });
  }
  return blocks;
}

function renderInline(content: MarkdownInline[], keyPrefix: string): ReactNode[] {
  return content.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.type === 'strong') return <strong key={key}>{part.value}</strong>;
    if (part.type === 'emphasis') return <em key={key}>{part.value}</em>;
    if (part.type === 'code') return <code key={key} className="rounded bg-hc-ink/10 px-1.5 py-0.5 text-[0.9em] dark:bg-white/10">{part.value}</code>;
    if (part.type === 'link') return <a key={key} href={part.href} target="_blank" rel="noreferrer" className="font-semibold text-hc-violet underline decoration-hc-violet/40 underline-offset-2 dark:text-hc-yellow">{part.label}<ExternalLink size={12} className="ml-1 inline" aria-hidden="true" /></a>;
    return <span key={key}>{part.value.split('\n').map((line, lineIndex) => <span key={`${key}-${lineIndex}`}>{lineIndex > 0 && <br />}{line}</span>)}</span>;
  });
}

export function MarkdownBio({ source }: { readonly source: string }): ReactNode {
  return <div className="space-y-2">{parseMarkdownBlocks(source).map((block, index) => block.type === 'heading' ? <h3 key={index} className="font-display font-bold">{renderInline(block.content, `heading-${index}`)}</h3> : block.type === 'list' ? <ul key={index} className="list-disc space-y-1 pl-5">{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `list-${index}-${itemIndex}`)}</li>)}</ul> : <p key={index}>{renderInline(block.content, `paragraph-${index}`)}</p>)}</div>;
}
