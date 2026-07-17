import { NotificationDeliveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildTelegramTradingMessage } from "./telegram-message";
import type { TradingDigest } from "./trading-digest";

type TelegramApiResponse = {
  ok?: boolean;
  result?: { message_id?: number };
  description?: string;
};

type DeliveryWithStatus = { status: NotificationDeliveryStatus };

type TelegramDeliveryClaimDeps<T extends DeliveryWithStatus> = {
  createPending: () => Promise<T>;
  findExisting: () => Promise<T | null>;
  retryFailed: () => Promise<boolean>;
};

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/**
 * Uses the unique idempotency key as an atomic send claim. Failed deliveries may
 * be retried, but an in-flight PENDING delivery is never reclaimed concurrently.
 */
export async function claimTelegramDelivery<T extends DeliveryWithStatus>(deps: TelegramDeliveryClaimDeps<T>) {
  try {
    const delivery = await deps.createPending();
    return { claimed: true, delivery } as const;
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
  }

  const existing = await deps.findExisting();
  if (!existing) {
    throw new Error("Telegram delivery claim exists but cannot be loaded");
  }
  if (
    existing.status === NotificationDeliveryStatus.SENT ||
    existing.status === NotificationDeliveryStatus.SKIPPED ||
    existing.status === NotificationDeliveryStatus.PENDING
  ) {
    return { claimed: false, delivery: existing } as const;
  }

  if (await deps.retryFailed()) {
    return { claimed: true, delivery: null } as const;
  }
  return { claimed: false, delivery: await deps.findExisting() } as const;
}

export async function deliverTradingDigestToTelegram(digestId: string, digest: TradingDigest) {
  const message = buildTelegramTradingMessage({ digestId, ...digest });
  const idempotencyKey = message?.idempotencyKey ?? `telegram:trading-digest:${digestId}`;
  const existing = await prisma.notificationDelivery.findUnique({ where: { idempotencyKey } });

  if (existing?.status === NotificationDeliveryStatus.SENT || existing?.status === NotificationDeliveryStatus.SKIPPED) {
    return existing;
  }

  if (!message) {
    return prisma.notificationDelivery.upsert({
      where: { idempotencyKey },
      update: { status: NotificationDeliveryStatus.SKIPPED, error: null },
      create: {
        digestId,
        channel: "telegram",
        idempotencyKey,
        status: NotificationDeliveryStatus.SKIPPED
      }
    });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    return prisma.notificationDelivery.upsert({
      where: { idempotencyKey },
      update: { status: NotificationDeliveryStatus.NOT_CONFIGURED, error: "Telegram 未配置" },
      create: {
        digestId,
        channel: "telegram",
        idempotencyKey,
        status: NotificationDeliveryStatus.NOT_CONFIGURED,
        error: "Telegram 未配置"
      }
    });
  }

  const claim = await claimTelegramDelivery({
    createPending: () =>
      prisma.notificationDelivery.create({
        data: {
          digestId,
          channel: "telegram",
          idempotencyKey,
          status: NotificationDeliveryStatus.PENDING
        }
      }),
    findExisting: () => prisma.notificationDelivery.findUnique({ where: { idempotencyKey } }),
    retryFailed: async () => {
      const result = await prisma.notificationDelivery.updateMany({
        where: {
          idempotencyKey,
          status: { in: [NotificationDeliveryStatus.FAILED, NotificationDeliveryStatus.NOT_CONFIGURED] }
        },
        data: {
          status: NotificationDeliveryStatus.PENDING,
          providerMessageId: null,
          sentAt: null,
          error: null
        }
      });
      return result.count === 1;
    }
  });

  if (!claim.claimed) return claim.delivery;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message.text,
        disable_web_page_preview: true
      })
    });
    const payload = (await response.json().catch(() => ({}))) as TelegramApiResponse;

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.description ?? `Telegram failed: ${response.status}`);
    }

    return prisma.notificationDelivery.update({
      where: { idempotencyKey },
      data: {
        status: NotificationDeliveryStatus.SENT,
        providerMessageId: payload.result?.message_id ? String(payload.result.message_id) : null,
        sentAt: new Date(),
        error: null
      }
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Telegram delivery failed";
    await prisma.notificationDelivery.updateMany({
      where: { idempotencyKey, status: NotificationDeliveryStatus.PENDING },
      data: { status: NotificationDeliveryStatus.FAILED, error: messageText }
    });
    throw new Error(messageText);
  }
}
