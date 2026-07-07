import { NextResponse } from 'next/server';
import { buyerTableCsv } from '@/lib/csv';

// GET /api/companies/:id/export.csv — ranked buyer table (Sheets-compatible)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const csv = await buyerTableCsv(params.id);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="buyers-${params.id}.csv"`,
    },
  });
}
