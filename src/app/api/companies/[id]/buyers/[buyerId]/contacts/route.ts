import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { audit, guardCompany } from '@/lib/auth';

const CreateSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  type: z.enum(['corp_dev', 'product', 'ceo', 'other']).default('corp_dev'),
  email: z.string().email().optional().or(z.literal('')),
  linkedin: z.string().optional(),
});

// GET /api/companies/:id/buyers/:buyerId/contacts
export async function GET(
  _req: Request,
  { params }: { params: { id: string; buyerId: string } }
) {
  const guard = await guardCompany(params.id, 'viewer');
  if (guard instanceof Response) return guard;
  const contacts = await prisma.contact.findMany({
    where: { buyerId: params.buyerId, buyer: { companyId: params.id } },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(contacts);
}

// POST /api/companies/:id/buyers/:buyerId/contacts — add a buyer contact.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; buyerId: string } }
) {
  const guard = await guardCompany(params.id, 'editor');
  if (guard instanceof Response) return guard;
  const buyer = await prisma.buyer.findFirst({
    where: { id: params.buyerId, companyId: params.id },
  });
  if (!buyer) return NextResponse.json({ error: 'Buyer not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const contact = await prisma.contact.create({
    data: { ...parsed.data, email: parsed.data.email || null, buyerId: buyer.id },
  });
  await audit({
    action: 'contact.created',
    userId: guard.user.id,
    companyId: params.id,
    targetType: 'contact',
    targetId: contact.id,
    detail: { buyer: buyer.name, name: contact.name, type: contact.type },
  });
  return NextResponse.json(contact, { status: 201 });
}

const DeleteSchema = z.object({ contactId: z.string() });

// DELETE /api/companies/:id/buyers/:buyerId/contacts
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; buyerId: string } }
) {
  const guard = await guardCompany(params.id, 'editor');
  if (guard instanceof Response) return guard;
  const body = await req.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'contactId required' }, { status: 400 });

  const contact = await prisma.contact.findFirst({
    where: { id: parsed.data.contactId, buyerId: params.buyerId, buyer: { companyId: params.id } },
  });
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  await prisma.contact.delete({ where: { id: contact.id } });
  await audit({
    action: 'contact.deleted',
    userId: guard.user.id,
    companyId: params.id,
    targetType: 'contact',
    targetId: contact.id,
    detail: { name: contact.name },
  });
  return NextResponse.json({ ok: true });
}
