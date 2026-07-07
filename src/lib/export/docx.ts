import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
} from 'docx';
import { parseMarkdown, type Block, type InlineRun } from './mdmodel';

// Report Markdown → DOCX via the pure-JS `docx` package.

function runs(inline: InlineRun[], opts: { italics?: boolean; color?: string } = {}): TextRun[] {
  return inline.map(
    (r) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italic || opts.italics,
        color: opts.color,
      })
  );
}

function blockToDocx(block: Block): (Paragraph | Table)[] {
  switch (block.kind) {
    case 'heading': {
      const levels = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
      } as const;
      return [
        new Paragraph({
          heading: levels[block.level],
          spacing: { before: block.level === 1 ? 0 : 240, after: 120 },
          children: runs(block.runs),
        }),
      ];
    }
    case 'paragraph':
      return [new Paragraph({ spacing: { after: 120 }, children: runs(block.runs) })];
    case 'bullets':
      return block.items.map(
        (item) =>
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: runs(item),
          })
      );
    case 'quote':
      return [
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 120 },
          children: runs(block.runs, { italics: true, color: '92400E' }),
        }),
      ];
    case 'table': {
      const mkRow = (cells: string[], header: boolean) =>
        new TableRow({
          tableHeader: header,
          children: cells.map(
            (c) =>
              new TableCell({
                shading: header ? { fill: 'F1F5F9' } : undefined,
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: c || ' ', bold: header, size: 16 })],
                  }),
                ],
              })
          ),
        });
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
            left: { style: BorderStyle.NONE, size: 0 },
            right: { style: BorderStyle.NONE, size: 0 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
            insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'F1F5F9' },
          },
          rows: [
            mkRow(block.header, true),
            ...block.rows.map((r) => mkRow(block.header.map((_, c) => r[c] ?? ''), false)),
          ],
        }),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
      ];
    }
  }
}

export async function markdownToDocx(markdown: string): Promise<Buffer> {
  const blocks = parseMarkdown(markdown);
  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Calibri', size: 20 } } },
    },
    sections: [{ children: blocks.flatMap(blockToDocx) }],
  });
  return Packer.toBuffer(doc);
}
