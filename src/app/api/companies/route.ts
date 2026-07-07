import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

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

// POST /api/companies — create a new target company
export async function POST(req: NextRequest) {
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
    },
  });
  return NextResponse.json(company, { status: 201 });
}

// GET /api/companies — list companies
export async function GET() {
  const companies = await prisma.targetCompany.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { buyers: true, reports: true } } },
  });
  return NextResponse.json(companies);
}
