import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';
import { extractDeckText } from '@/lib/pdf';
import { audit, guardCompany } from '@/lib/auth';

// POST /api/companies/:id/upload-deck — multipart form with "file" (PDF).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'editor');
  if (guard instanceof Response) return guard;
  const company = await prisma.targetCompany.findUnique({ where: { id: params.id } });
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing "file" form field' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF decks are supported' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = '';
  let pageCount = 0;
  try {
    const extracted = await extractDeckText(buffer);
    text = extracted.text;
    pageCount = extracted.pageCount;
  } catch (err) {
    return NextResponse.json(
      { error: `Could not parse PDF: ${err instanceof Error ? err.message : String(err)}` },
      { status: 422 }
    );
  }

  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  await mkdir(uploadDir, { recursive: true });
  const safeName = path.basename(file.name).replace(/[^\w.\-]/g, '_');
  const storagePath = path.join(uploadDir, `${params.id}-${Date.now()}-${safeName}`);
  await writeFile(storagePath, buffer);

  const deck = await prisma.deck.create({
    data: {
      companyId: params.id,
      filename: file.name,
      storagePath,
      pageCount,
      extractedText: text,
    },
  });
  await audit({
    action: 'deck.uploaded',
    userId: guard.user.id,
    companyId: params.id,
    targetType: 'deck',
    targetId: deck.id,
    detail: { filename: file.name, pageCount },
  });
  return NextResponse.json(
    { id: deck.id, filename: deck.filename, pageCount, textLength: text.length },
    { status: 201 }
  );
}
