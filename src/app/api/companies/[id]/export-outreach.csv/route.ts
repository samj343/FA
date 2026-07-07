import { NextResponse } from 'next/server';
import { outreachCsv } from '@/lib/csv';

// GET /api/companies/:id/export-outreach.csv — outreach drafts export
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const csv = await outreachCsv(params.id);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="outreach-${params.id}.csv"`,
    },
  });
}
