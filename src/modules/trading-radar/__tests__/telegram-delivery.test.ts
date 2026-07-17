import assert from "node:assert/strict";
import { test } from "node:test";
import { NotificationDeliveryStatus } from "@prisma/client";
import { claimTelegramDelivery } from "../telegram-delivery";

type FakeDelivery = { status: NotificationDeliveryStatus };

test("concurrent Telegram deliveries grant exactly one initial send claim", async () => {
  let delivery: FakeDelivery | null = null;

  const claim = () =>
    claimTelegramDelivery({
      createPending: async () => {
        if (delivery) throw { code: "P2002" };
        delivery = { status: NotificationDeliveryStatus.PENDING };
        return delivery;
      },
      findExisting: async () => delivery,
      retryFailed: async () => false
    });

  const claims = await Promise.all([claim(), claim()]);
  assert.equal(claims.filter((result) => result.claimed).length, 1);
});

test("concurrent Telegram retries atomically reclaim one failed delivery", async () => {
  let delivery: FakeDelivery = { status: NotificationDeliveryStatus.FAILED };

  const claim = () =>
    claimTelegramDelivery({
      createPending: async () => {
        throw { code: "P2002" };
      },
      findExisting: async () => delivery,
      retryFailed: async () => {
        if (delivery.status !== NotificationDeliveryStatus.FAILED) return false;
        delivery = { status: NotificationDeliveryStatus.PENDING };
        return true;
      }
    });

  const claims = await Promise.all([claim(), claim()]);
  assert.equal(claims.filter((result) => result.claimed).length, 1);
});
