import { NextResponse } from 'next/server';
import { generateReportMarkdown } from '@/lib/report';
import { markdownToPdf } from '@/lib/export/pdf';
import { guardCompany } from '@/lib/auth';

// GET /api/companies/:id/export.pdf — full report as PDF (always regenerated).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'viewer');
  if (guard instanceof Response) return guard;
  const markdown = await generateReportMarkdown(params.id);
  const pdf = await markdownToPdf(markdown);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${params.id}.pdf"`,
    },
  });
}
