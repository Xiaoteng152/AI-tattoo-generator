import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null
});

export const workflowQueue = new Queue("workflow-runs", {
  connection: redisConnection
});
