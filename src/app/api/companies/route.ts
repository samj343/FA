import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { audit, getSessionUser, unauthorized } from '@/lib/auth';

const CreateCompanySchema = z.object({
  name: z.string().min(1),
  website: z.string().optional(),
  description: z.string().optional(),
  sector: z.string().optional(),
  financialNotes: z.string().optional(),
  customerNotes: z.string().optional(),
  founderNotes: z.string().optional(),
  marketNotes: z.string().optional(),
  preferredBuyerTypes: z.string().optional(),
  excludedBuyers: z.array(z.string()).optional(),
  confidentialityLevel: z.enum(['high', 'medium', 'low']).optional(),
});

// POST /api/companies — create a new target company; creator becomes owner.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = CreateCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { excludedBuyers, ...rest } = parsed.data;
  const company = await prisma.targetCompany.create({
    data: {
      ...rest,
      excludedBuyers: JSON.stringify(excludedBuyers ?? []),
      confidentialityLevel: parsed.data.confidentialityLevel ?? 'high',
      members: { create: { userId: user.id, role: 'owner' } },
    },
  });
  await audit({
    action: 'company.created',
    userId: user.id,
    companyId: company.id,
    targetType: 'company',
    targetId: company.id,
    detail: { name: company.name },
  });
  return NextResponse.json(company, { status: 201 });
}

// GET /api/companies — companies the current user is a member of.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const companies = await prisma.targetCompany.findMany({
    where: { members: { some: { userId: user.id } } },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { buyers: true, reports: true } } },
  });
  return NextResponse.json(companies);
}
