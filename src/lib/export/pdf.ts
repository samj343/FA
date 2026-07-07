import PDFDocument from 'pdfkit';
import { parseMarkdown, type Block, type InlineRun } from './mdmodel';

// Report Markdown → PDF via pdfkit (pure JS, built-in Helvetica AFM fonts —
// no binaries, works anywhere Node runs). Wide tables get a scaled-down font.

const MARGIN = 48;

function drawRuns(doc: PDFKit.PDFDocument, runs: InlineRun[], size: number, color = '#1e293b') {
  doc.fontSize(size).fillColor(color);
  runs.forEach((run, idx) => {
    doc.font(run.bold ? 'Helvetica-Bold' : run.italic ? 'Helvetica-Oblique' : 'Helvetica');
    doc.text(run.text, { continued: idx < runs.length - 1 });
  });
}

function drawTable(doc: PDFKit.PDFDocument, header: string[], rows: string[][]) {
  const pageWidth = doc.page.width - MARGIN * 2;
  const cols = header.length;
  // Scale font down for wide tables (the appendix has 14 columns).
  const fontSize = cols <= 5 ? 8.5 : cols <= 9 ? 7 : 5.5;
  const cellPad = 3;
  const colWidth = pageWidth / cols;

  const rowHeight = (cells: string[], bold: boolean): number => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    let h = 0;
    for (const cell of cells) {
      h = Math.max(h, doc.heightOfString(cell || ' ', { width: colWidth - cellPad * 2 }));
    }
    return h + cellPad * 2;
  };

  const drawRow = (cells: string[], bold: boolean, shade: boolean) => {
    const h = rowHeight(cells, bold);
    if (doc.y + h > doc.page.height - MARGIN) doc.addPage();
    const y = doc.y;
    if (shade) {
      doc.rect(MARGIN, y, pageWidth, h).fill('#f1f5f9');
    }
    doc.fillColor('#1e293b').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    cells.forEach((cell, c) => {
      doc.text(cell || ' ', MARGIN + c * colWidth + cellPad, y + cellPad, {
        width: colWidth - cellPad * 2,
      });
    });
    doc.moveTo(MARGIN, y + h).lineTo(MARGIN + pageWidth, y + h).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.x = MARGIN;
    doc.y = y + h;
  };

  drawRow(header, true, true);
  rows.forEach((r) => {
    // Pad/truncate ragged rows defensively.
    const cells = header.map((_, c) => r[c] ?? '');
    drawRow(cells, false, false);
  });
  doc.moveDown(0.6);
}

function renderBlock(doc: PDFKit.PDFDocument, block: Block) {
  switch (block.kind) {
    case 'heading': {
      const sizes = { 1: 18, 2: 14, 3: 11.5 } as const;
      if (block.level < 3 && doc.y > doc.page.height - MARGIN - 100) doc.addPage();
      doc.moveDown(block.level === 1 ? 0.2 : 0.8);
      doc.font('Helvetica-Bold').fontSize(sizes[block.level]).fillColor('#0c1220');
      doc.text(block.runs.map((r) => r.text).join(''));
      doc.moveDown(0.3);
      break;
    }
    case 'paragraph':
      drawRuns(doc, block.runs, 9.5);
      doc.moveDown(0.4);
      break;
    case 'bullets':
      for (const item of block.items) {
        const y0 = doc.y;
        if (y0 > doc.page.height - MARGIN - 20) doc.addPage();
        doc.font('Helvetica').fontSize(9.5).fillColor('#1e293b');
        doc.text('•', MARGIN, doc.y, { continued: false, width: 10 });
        doc.moveUp();
        doc.x = MARGIN + 12;
        drawRuns(doc, item, 9.5);
        doc.x = MARGIN;
      }
      doc.moveDown(0.4);
      break;
    case 'quote':
      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#92400e');
      doc.text(block.runs.map((r) => r.text).join(''), MARGIN + 10, doc.y, {
        width: doc.page.width - MARGIN * 2 - 20,
      });
      doc.x = MARGIN;
      doc.moveDown(0.4);
      break;
    case 'table':
      drawTable(doc, block.header, block.rows);
      break;
  }
}

export async function markdownToPdf(markdown: string): Promise<Buffer> {
  const blocks = parseMarkdown(markdown);
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  for (const block of blocks) renderBlock(doc, block);

  // Page footers.
  const range = doc.bufferedPageRange();
  for (let p = range.start; p < range.start + range.count; p++) {
    doc.switchToPage(p);
    doc.font('Helvetica').fontSize(7.5).fillColor('#94a3b8');
    doc.text(
      `BuyerScope — confidential draft for advisor review · page ${p + 1} of ${range.count}`,
      MARGIN,
      doc.page.height - 30,
      { width: doc.page.width - MARGIN * 2, align: 'center' }
    );
  }
  doc.end();
  return done;
}
