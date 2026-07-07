import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const PatchSchema = z.object({
  excluded: z.boolean().optional(),
  name: z.string().min(1).optional(),
  initialRationale: z.string().optional(),
});

// PATCH /api/companies/:id/buyers/:buyerId — edit / exclude a buyer.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; buyerId: string } }
) {
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const buyer = await prisma.buyer.findFirst({
    where: { id: params.buyerId, companyId: params.id },
  });
  if (!buyer) return NextResponse.json({ error: 'Buyer not found' }, { status: 404 });
  const updated = await prisma.buyer.update({ where: { id: buyer.id }, data: parsed.data });
  return NextResponse.json(updated);
}
