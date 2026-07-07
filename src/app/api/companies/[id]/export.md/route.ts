import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateReportMarkdown } from '@/lib/report';
import { guardCompany } from '@/lib/auth';

// GET /api/companies/:id/export.md — full report as Markdown download.
// Always regenerated so it reflects the advisor's latest edits.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'viewer');
  if (guard instanceof Response) return guard;
  const company = await prisma.targetCompany.findUnique({ where: { id: params.id } });
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const markdown = await generateReportMarkdown(params.id);
  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="report-${params.id}.md"`,
    },
  });
}
