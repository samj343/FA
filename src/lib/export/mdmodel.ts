// Parses the report's Markdown subset (headings, paragraphs, bullets,
// blockquotes, tables, **bold**/_italic_) into a block model shared by the
// PDF and DOCX renderers.

export type InlineRun = { text: string; bold?: boolean; italic?: boolean };

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; runs: InlineRun[] }
  | { kind: 'paragraph'; runs: InlineRun[] }
  | { kind: 'bullets'; items: InlineRun[][] }
  | { kind: 'quote'; runs: InlineRun[] }
  | { kind: 'table'; header: string[]; rows: string[][] };

export function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let rest = text;
  const re = /(\*\*([^*]+)\*\*)|(_([^_]+)_)/;
  while (rest.length) {
    const m = rest.match(re);
    if (!m || m.index === undefined) {
      runs.push({ text: rest });
      break;
    }
    if (m.index > 0) runs.push({ text: rest.slice(0, m.index) });
    if (m[2] !== undefined) runs.push({ text: m[2], bold: true });
    else runs.push({ text: m[4]!, italic: true });
    rest = rest.slice(m.index + m[0].length);
  }
  return runs.filter((r) => r.text.length > 0);
}

function stripInline(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/_([^_]+)_/g, '$1');
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) tableLines.push(lines[i++]);
      const rows = tableLines.map((l) =>
        l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => stripInline(c.trim()))
      );
      const dataRows = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      const [header, ...body] = dataRows;
      if (header) blocks.push({ kind: 'table', header, rows: body });
      continue;
    }

    if (line.startsWith('- ')) {
      const items: InlineRun[][] = [];
      while (i < lines.length && lines[i].startsWith('- ')) items.push(parseInline(lines[i++].slice(2)));
      blocks.push({ kind: 'bullets', items });
      continue;
    }

    if (line.startsWith('### ')) blocks.push({ kind: 'heading', level: 3, runs: parseInline(line.slice(4)) });
    else if (line.startsWith('## ')) blocks.push({ kind: 'heading', level: 2, runs: parseInline(line.slice(3)) });
    else if (line.startsWith('# ')) blocks.push({ kind: 'heading', level: 1, runs: parseInline(line.slice(2)) });
    else if (line.startsWith('> ')) blocks.push({ kind: 'quote', runs: parseInline(line.slice(2)) });
    else if (line.trim() !== '') blocks.push({ kind: 'paragraph', runs: parseInline(line) });
    i++;
  }
  return blocks;
}
