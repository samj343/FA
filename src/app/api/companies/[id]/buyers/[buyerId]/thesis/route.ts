import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { audit, guardCompany } from '@/lib/auth';

const PatchSchema = z.object({
  acquisitionThesis: z.string().optional(),
  productSynergy: z.string().optional(),
  revenueSynergy: z.string().optional(),
  customerSynergy: z.string().optional(),
  technologySynergy: z.string().optional(),
  competitiveRationale: z.string().optional(),
  integrationPath: z.string().optional(),
  recommendedOutreachAngle: z.string().optional(),
  bestContactType: z.string().optional(),
});

// PATCH /api/companies/:id/buyers/:buyerId/thesis — advisor edits to a thesis.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; buyerId: string } }
) {
  const guard = await guardCompany(params.id, 'editor');
  if (guard instanceof Response) return guard;
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const buyer = await prisma.buyer.findFirst({
    where: { id: params.buyerId, companyId: params.id },
    include: { thesis: true },
  });
  if (!buyer?.thesis) return NextResponse.json({ error: 'Thesis not found' }, { status: 404 });
  const updated = await prisma.buyerThesis.update({
    where: { buyerId: buyer.id },
    data: parsed.data,
  });
  await audit({
    action: 'thesis.edited',
    userId: guard.user.id,
    companyId: params.id,
    targetType: 'buyer_thesis',
    targetId: buyer.id,
    detail: { buyer: buyer.name, fields: Object.keys(parsed.data) },
  });
  return NextResponse.json(updated);
}
