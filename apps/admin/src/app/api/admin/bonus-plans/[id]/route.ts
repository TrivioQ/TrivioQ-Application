import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@trivioq/database';
import { z } from 'zod';

const prisma = new PrismaClient();

const UpdateBonusPlanSchema = z.object({
  title: z.string().min(1),
  periodType: z.enum(['WEEK', 'MONTH']),
  rewardType: z.enum(['POINTS', 'PREMIUM_DAYS']),
  startDate: z.string(),
  endDate: z.string(),
  payoutValues: z.array(z.number().int().min(0)).min(1).max(10),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateBonusPlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { title, periodType, rewardType, startDate, endDate, payoutValues } = parsed.data;
    const start = new Date(startDate);
    const end = new Date(endDate);

    const existing = await prisma.bonusPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Bonus plan not found' }, { status: 404 });
    }

    if (existing.endDate < new Date()) {
      return NextResponse.json({ error: 'Cannot edit an expired bonus plan' }, { status: 409 });
    }

    const overlap = await prisma.bonusPlan.findFirst({
      where: {
        id: { not: id },
        periodType,
        startDate: { lt: end },
        endDate: { gt: start },
      },
      select: { id: true, title: true },
    });

    if (overlap) {
      return NextResponse.json(
        {
          error: `Overlapping bonus plan exists: "${overlap.title}". Adjust the dates or remove the conflicting plan first.`,
          conflictId: overlap.id,
        },
        { status: 409 },
      );
    }

    const plan = await prisma.bonusPlan.update({
      where: { id },
      data: { title, periodType, rewardType, startDate: start, endDate: end, payoutValues },
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error('[PUT /api/admin/bonus-plans/[id]] Failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const existing = await prisma.bonusPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Bonus plan not found' }, { status: 404 });
    }

    if (existing.endDate < new Date()) {
      return NextResponse.json({ error: 'Cannot delete an expired bonus plan' }, { status: 409 });
    }

    await prisma.bonusPlan.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[DELETE /api/admin/bonus-plans/[id]] Failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
