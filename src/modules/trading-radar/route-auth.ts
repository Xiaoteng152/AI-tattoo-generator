import { auth } from "@/auth";

export async function hasTradingRadarSession() {
  const session = await auth();
  return Boolean(session?.user?.email);
}

export function hasValidCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}
