import { NextResponse } from 'next/server';
import { generateReportMarkdown } from '@/lib/report';
import { markdownToDocx } from '@/lib/export/docx';
import { guardCompany } from '@/lib/auth';

// GET /api/companies/:id/export.docx — full report as DOCX (always regenerated).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'viewer');
  if (guard instanceof Response) return guard;
  const markdown = await generateReportMarkdown(params.id);
  const docx = await markdownToDocx(markdown);
  return new NextResponse(new Uint8Array(docx), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="report-${params.id}.docx"`,
    },
  });
}
