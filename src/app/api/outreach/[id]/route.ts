import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const STATUSES = [
  'Draft', 'Needs Review', 'Approved', 'Rejected', 'Sent', 'Follow-up Needed',
  'Not Interested', 'Interested', 'NDA Requested', 'Intro Call Scheduled',
] as const;

const PatchSchema = z.object({
  subject: z.string().optional(),
  body: z.string().optional(),
  status: z.enum(STATUSES).optional(),
});

// PATCH /api/outreach/:id — edit draft content or move it through the
// workflow statuses. Marking "Sent" requires prior approval.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const message = await prisma.outreachMessage.findUnique({ where: { id: params.id } });
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (parsed.data.status === 'Sent' && !message.approvedByUser) {
    return NextResponse.json(
      { error: 'This draft must be approved before it can be marked as sent.' },
      { status: 409 }
    );
  }

  // Editing the body of an approved message resets it to Needs Review.
  const contentEdited = parsed.data.body !== undefined || parsed.data.subject !== undefined;
  const updated = await prisma.outreachMessage.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      ...(contentEdited && message.approvedByUser && !parsed.data.status
        ? { status: 'Needs Review', approvedByUser: false }
        : {}),
      ...(parsed.data.status === 'Sent' ? { sentAt: new Date() } : {}),
    },
  });
  return NextResponse.json(updated);
}
