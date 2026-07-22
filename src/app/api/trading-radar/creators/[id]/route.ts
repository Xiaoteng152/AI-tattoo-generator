import { NextResponse } from "next/server";
import { z } from "zod";
import { hasTradingRadarSession } from "@/modules/trading-radar/route-auth";
import { CreatorLimitError, setWatchedCreatorEnabled } from "@/modules/trading-radar/radar-service";

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
  try {
    return NextResponse.json(await setWatchedCreatorEnabled(id, parsed.data.enabled));
  } catch (error) {
    if (error instanceof CreatorLimitError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update creator" },
      { status: 500 }
    );
  }
}
