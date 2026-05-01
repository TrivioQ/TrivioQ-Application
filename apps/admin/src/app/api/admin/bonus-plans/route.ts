import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@trivioq/database';
import { z } from 'zod';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const plans = await prisma.bonusPlan.findMany({
      orderBy: { startDate: 'desc' },
    });
    return NextResponse.json(plans);
  } catch (error) {
    console.error('[GET /api/admin/bonus-plans] Failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const CreateBonusPlanSchema = z.object({
  title: z.string().min(1),
  periodType: z.enum(['WEEK', 'MONTH']),
  rewardType: z.enum(['POINTS', 'PREMIUM_DAYS']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  payoutValues: z.array(z.number().int().min(0)).min(1).max(10),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateBonusPlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { title, periodType, rewardType, startDate, endDate, payoutValues } = parsed.data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check for overlapping plans in the same period type
    const overlap = await prisma.bonusPlan.findFirst({
      where: {
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

    const plan = await prisma.bonusPlan.create({
      data: {
        title,
        periodType,
        rewardType,
        startDate: start,
        endDate: end,
        payoutValues,
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/bonus-plans] Failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
