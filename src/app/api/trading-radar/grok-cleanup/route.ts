import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeGrokIngest, GrokAuthError } from "@/modules/trading-radar/grok-auth";

export const runtime = "nodejs";

const RUN_ID = "20260722T101125Z-8fa6130b25";
const DIGEST_ID = "cmrvxbisz000djl04uhju91kp";
const CONFIRMATION = `cleanup:${RUN_ID}`;

type CleanupRequest = {
  confirm?: string;
  dryRun?: boolean;
};

async function inspectTargets() {
  const [run, rawItems, digest, deliveries] = await Promise.all([
    prisma.grokRadarRun.findUnique({
      where: { id: RUN_ID },
      select: { id: true, status: true }
    }),
    prisma.creatorRawItem.findMany({
      where: { grokRunId: RUN_ID },
      select: { id: true }
    }),
    prisma.tradingDigest.findUnique({
      where: { id: DIGEST_ID },
      select: { id: true, sourceGrokRunId: true, rawItemIds: true, creatorIds: true }
    }),
    prisma.notificationDelivery.findMany({
      where: { digestId: DIGEST_ID },
      select: { id: true, status: true }
    })
  ]);

  const rawItemIds = rawItems.map((item) => item.id).sort();
  const digestRawItemIds = [...(digest?.rawItemIds ?? [])].sort();
  const exactRawItemSet =
    rawItemIds.length === digestRawItemIds.length &&
    rawItemIds.every((id, index) => id === digestRawItemIds[index]);

  return {
    run,
    rawItemIds,
    digest,
    deliveries,
    exactRawItemSet
  };
}

function assertExpectedTargets(targets: Awaited<ReturnType<typeof inspectTargets>>) {
  if (!targets.run || targets.run.status !== "SUCCEEDED") {
    throw new Error("cleanup_run_mismatch");
  }
  if (targets.rawItemIds.length !== 6) {
    throw new Error("cleanup_raw_item_count_mismatch");
  }
  if (!targets.digest || targets.digest.sourceGrokRunId !== RUN_ID) {
    throw new Error("cleanup_digest_mismatch");
  }
  if (!targets.exactRawItemSet) {
    throw new Error("cleanup_digest_raw_items_mismatch");
  }
}

function summarize(targets: Awaited<ReturnType<typeof inspectTargets>>) {
  return {
    runId: targets.run?.id ?? null,
    runStatus: targets.run?.status ?? null,
    rawItemCount: targets.rawItemIds.length,
    digestId: targets.digest?.id ?? null,
    digestCreatorCount: targets.digest?.creatorIds.length ?? null,
    digestRawItemCount: targets.digest?.rawItemIds.length ?? null,
    exactRawItemSet: targets.exactRawItemSet,
    deliveryCount: targets.deliveries.length,
    deliveryStatuses: targets.deliveries.map((delivery) => delivery.status)
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = await authorizeGrokIngest(request);
    const payload = JSON.parse(rawBody) as CleanupRequest;
    if (payload.confirm !== CONFIRMATION) {
      return NextResponse.json({ error: "cleanup_confirmation_mismatch" }, { status: 400 });
    }

    const before = await inspectTargets();
    assertExpectedTargets(before);
    if (payload.dryRun !== false) {
      return NextResponse.json({ ok: true, dryRun: true, before: summarize(before) });
    }

    const result = await prisma.$transaction(async (tx) => {
      const [run, rawItems, digest, deliveryCount] = await Promise.all([
        tx.grokRadarRun.findUnique({ where: { id: RUN_ID }, select: { status: true } }),
        tx.creatorRawItem.findMany({ where: { grokRunId: RUN_ID }, select: { id: true } }),
        tx.tradingDigest.findUnique({
          where: { id: DIGEST_ID },
          select: { sourceGrokRunId: true, rawItemIds: true }
        }),
        tx.notificationDelivery.count({ where: { digestId: DIGEST_ID } })
      ]);
      const rawItemIds = rawItems.map((item) => item.id).sort();
      const digestRawItemIds = [...(digest?.rawItemIds ?? [])].sort();
      if (
        run?.status !== "SUCCEEDED" ||
        rawItemIds.length !== 6 ||
        digest?.sourceGrokRunId !== RUN_ID ||
        rawItemIds.length !== digestRawItemIds.length ||
        !rawItemIds.every((id, index) => id === digestRawItemIds[index]) ||
        deliveryCount !== before.deliveries.length
      ) {
        throw new Error("cleanup_targets_changed");
      }

      const deleted = await tx.creatorRawItem.deleteMany({ where: { grokRunId: RUN_ID } });
      const updatedDigest = await tx.tradingDigest.update({
        where: { id: DIGEST_ID },
        data: { creatorIds: [] },
        select: { id: true, creatorIds: true }
      });
      const deliveries = await tx.notificationDelivery.count({ where: { digestId: DIGEST_ID } });
      if (deleted.count !== 6 || updatedDigest.creatorIds.length !== 0 || deliveries !== deliveryCount) {
        throw new Error("cleanup_postcondition_failed");
      }
      return { deletedRawItems: deleted.count, digestCreatorCount: updatedDigest.creatorIds.length, deliveries };
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ ok: true, dryRun: false, before: summarize(before), result });
  } catch (error) {
    if (error instanceof GrokAuthError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "cleanup_failed";
    const expectedFailure = message.startsWith("cleanup_");
    return NextResponse.json({ error: expectedFailure ? message : "cleanup_failed" }, { status: expectedFailure ? 409 : 500 });
  }
}
