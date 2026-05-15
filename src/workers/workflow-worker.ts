import { Worker } from "bullmq";
import { runMvpWorkflow } from "@/modules/workflow/run-workflow";
import { redisConnection } from "./queue";

export const workflowWorker = new Worker(
  "workflow-runs",
  async () => {
    return runMvpWorkflow();
  },
  {
    connection: redisConnection
  }
);
