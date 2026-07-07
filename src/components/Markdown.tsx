// Minimal, dependency-free Markdown renderer covering what the report uses:
// headings, tables, bullet lists, blockquotes, bold/italic, paragraphs.

import React from 'react';

function inline(text: string, key: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let rest = text;
  let i = 0;
  const re = /(\*\*([^*]+)\*\*)|(_([^_]+)_)/;
  while (rest.length) {
    const m = rest.match(re);
    if (!m || m.index === undefined) {
      parts.push(rest);
      break;
    }
    if (m.index > 0) parts.push(rest.slice(0, m.index));
    if (m[2] !== undefined) parts.push(<strong key={`${key}-${i++}`}>{m[2]}</strong>);
    else parts.push(<em key={`${key}-${i++}`}>{m[4]}</em>);
    rest = rest.slice(m.index + m[0].length);
  }
  return parts;
}

export default function Markdown({ source }: { source: string }) {
  const lines = source.split('\n');
  const out: React.ReactNode[] = [];
  let k = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('|')) {
      // table block
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) tableLines.push(lines[i++]);
      const rows = tableLines
        .filter((l) => !/^\|[\s:|-]+\|$/.test(l.replace(/-/g, '-')))
        .map((l) => l.slice(1, l.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim()));
      const dataRows = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      const [head, ...body] = dataRows;
      out.push(
        <div key={k++} className="my-3 overflow-x-auto">
          <table className="table-base">
            <thead><tr>{head?.map((c, j) => <th key={j}>{inline(c, k)}</th>)}</tr></thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, k)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) items.push(lines[i++].slice(2));
      out.push(
        <ul key={k++} className="my-2 list-disc space-y-1 pl-6 text-sm text-slate-700">
          {items.map((item, j) => <li key={j}>{inline(item, k)}</li>)}
        </ul>
      );
      continue;
    }

    if (line.startsWith('### ')) out.push(<h3 key={k++} className="mt-5 text-base font-bold">{inline(line.slice(4), k)}</h3>);
    else if (line.startsWith('## ')) out.push(<h2 key={k++} className="mt-8 border-b border-slate-200 pb-1 text-lg font-bold">{inline(line.slice(3), k)}</h2>);
    else if (line.startsWith('# ')) out.push(<h1 key={k++} className="text-2xl font-bold">{inline(line.slice(2), k)}</h1>);
    else if (line.startsWith('> ')) out.push(<blockquote key={k++} className="my-2 border-l-4 border-amber-300 bg-amber-50 px-3 py-2 text-sm text-slate-700">{inline(line.slice(2), k)}</blockquote>);
    else if (line.trim() === '') out.push(<div key={k++} className="h-2" />);
    else out.push(<p key={k++} className="text-sm leading-relaxed text-slate-700">{inline(line, k)}</p>);
    i++;
  }

  return <div>{out}</div>;
}
