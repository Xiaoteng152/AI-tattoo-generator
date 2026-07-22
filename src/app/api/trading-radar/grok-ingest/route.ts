import { NextResponse } from "next/server";
import { authorizeGrokIngest, GrokAuthError } from "@/modules/trading-radar/grok-auth";
import { GrokIngestError, ingestGrokRun, type GrokIngestPayload } from "@/modules/trading-radar/grok-ingest";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await authorizeGrokIngest(request);
    const payload = JSON.parse(rawBody) as GrokIngestPayload;
    const result = await ingestGrokRun(payload, {
      idempotencyKey: request.headers.get("idempotency-key")
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GrokAuthError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    if (error instanceof GrokIngestError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    return NextResponse.json({ error: "ingest_failed" }, { status: 500 });
  }
}
