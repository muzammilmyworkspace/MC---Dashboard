import { Fragment, type ReactNode } from "react";

/**
 * A deliberately tiny markdown subset (headings, bold, italic, links,
 * bullet lists, paragraphs) rendered straight to React elements — no
 * `dangerouslySetInnerHTML`, so there is nothing here for a pasted script
 * tag to do.
 */
const INLINE_RE = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_RE.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const key = `${keyPrefix}-${i++}`;
    if (match[2] !== undefined) nodes.push(<strong key={key}>{match[2]}</strong>);
    else if (match[3] !== undefined) nodes.push(<em key={key}>{match[3]}</em>);
    else if (match[4] !== undefined) nodes.push(<em key={key}>{match[4]}</em>);
    else if (match[5] !== undefined && match[6] !== undefined)
      nodes.push(
        <a key={key} href={match[6]} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline underline-offset-2">
          {match[5]}
        </a>
      );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function MarkdownPreview({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  if (blocks.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing to preview yet — start writing on the left.</p>;
  }

  return (
    <div className="space-y-4 text-[15px] leading-relaxed">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");

        if (block.startsWith("### "))
          return <h3 key={bi} className="text-lg font-semibold tracking-tight">{renderInline(block.slice(4), `h3-${bi}`)}</h3>;
        if (block.startsWith("## "))
          return <h2 key={bi} className="text-xl font-semibold tracking-tight">{renderInline(block.slice(3), `h2-${bi}`)}</h2>;
        if (block.startsWith("# "))
          return <h1 key={bi} className="text-2xl font-semibold tracking-tight">{renderInline(block.slice(2), `h1-${bi}`)}</h1>;

        if (lines.every((l) => /^[-*]\s+/.test(l))) {
          return (
            <ul key={bi} className="list-disc space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^[-*]\s+/, ""), `li-${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(l, `p-${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
