import { NextResponse } from 'next/server';
import { outreachCsv } from '@/lib/csv';
import { guardCompany } from '@/lib/auth';

// GET /api/companies/:id/export-outreach.csv — outreach drafts export
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'viewer');
  if (guard instanceof Response) return guard;
  const csv = await outreachCsv(params.id);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="outreach-${params.id}.csv"`,
    },
  });
}
