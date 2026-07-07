import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateReportMarkdown } from '@/lib/report';

// GET /api/companies/:id/report — latest report
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const report = await prisma.report.findFirst({
    where: { companyId: params.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!report) return NextResponse.json({ error: 'No report yet' }, { status: 404 });
  return NextResponse.json(report);
}

// POST /api/companies/:id/report — regenerate from current (possibly edited) data
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const company = await prisma.targetCompany.findUnique({ where: { id: params.id } });
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  const markdown = await generateReportMarkdown(params.id);
  const report = await prisma.report.create({
    data: { companyId: params.id, title: `${company.name} — Buyer Discovery Packet`, markdown },
  });
  return NextResponse.json(report, { status: 201 });
}
