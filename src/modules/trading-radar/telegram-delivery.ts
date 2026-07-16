import { NotificationDeliveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildTelegramTradingMessage } from "./telegram-message";
import type { TradingDigest } from "./trading-digest";

type TelegramApiResponse = {
  ok?: boolean;
  result?: { message_id?: number };
  description?: string;
};

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

  await prisma.notificationDelivery.upsert({
    where: { idempotencyKey },
    update: { status: NotificationDeliveryStatus.PENDING, error: null },
    create: {
      digestId,
      channel: "telegram",
      idempotencyKey,
      status: NotificationDeliveryStatus.PENDING
    }
  });

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
    return prisma.notificationDelivery.update({
      where: { idempotencyKey },
      data: { status: NotificationDeliveryStatus.FAILED, error: messageText }
    });
  }
}
