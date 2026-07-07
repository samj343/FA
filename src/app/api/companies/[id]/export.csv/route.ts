import { NextResponse } from 'next/server';
import { buyerTableCsv } from '@/lib/csv';
import { guardCompany } from '@/lib/auth';

// GET /api/companies/:id/export.csv — ranked buyer table (Sheets-compatible)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'viewer');
  if (guard instanceof Response) return guard;
  const csv = await buyerTableCsv(params.id);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="buyers-${params.id}.csv"`,
    },
  });
}
