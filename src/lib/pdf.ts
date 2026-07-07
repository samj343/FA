// Pitch-deck text extraction. Imports the internal module directly to avoid
// pdf-parse's index.js debug harness (which tries to read a test fixture when
// required outside its own repo).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
  buf: Uint8Array
) => Promise<{ text: string; numpages: number }>;

export async function extractDeckText(
  buffer: Buffer
): Promise<{ text: string; pageCount: number }> {
  // Copy into a fresh Uint8Array: Node Buffers are often views into a shared
  // pool (byteOffset != 0), and pdf.js reads `bytes.buffer` assuming offset 0
  // — small PDFs silently mis-parse ("bad XRef entry") without this.
  const data = new Uint8Array(buffer);
  const result = await pdfParse(data);
  return { text: result.text ?? '', pageCount: result.numpages ?? 0 };
}
