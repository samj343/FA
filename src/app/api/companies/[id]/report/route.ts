import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateReportMarkdown } from '@/lib/report';
import { audit, guardCompany } from '@/lib/auth';

// GET /api/companies/:id/report — latest report
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'viewer');
  if (guard instanceof Response) return guard;
  const report = await prisma.report.findFirst({
    where: { companyId: params.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!report) return NextResponse.json({ error: 'No report yet' }, { status: 404 });
  return NextResponse.json(report);
}

// POST /api/companies/:id/report — regenerate from current (possibly edited) data
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardCompany(params.id, 'editor');
  if (guard instanceof Response) return guard;
  const company = await prisma.targetCompany.findUnique({ where: { id: params.id } });
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  const markdown = await generateReportMarkdown(params.id);
  const report = await prisma.report.create({
    data: { companyId: params.id, title: `${company.name} — Buyer Discovery Packet`, markdown },
  });
  await audit({
    action: 'report.regenerated',
    userId: guard.user.id,
    companyId: params.id,
    targetType: 'report',
    targetId: report.id,
  });
  return NextResponse.json(report, { status: 201 });
}
