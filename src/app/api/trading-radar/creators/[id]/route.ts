import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasTradingRadarSession } from "@/modules/trading-radar/route-auth";

const patchSchema = z.object({ enabled: z.boolean() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await hasTradingRadarSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid creator state" }, { status: 400 });
  }
  const { id } = await context.params;
  return NextResponse.json(await prisma.watchedCreator.update({ where: { id }, data: parsed.data }));
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await hasTradingRadarSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  await prisma.watchedCreator.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
