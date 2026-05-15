"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunWorkflowButton() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runWorkflow() {
    setIsRunning(true);
    setError(null);

    const response = await fetch("/api/workflow-runs", {
      method: "POST"
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Workflow run failed");
      setIsRunning(false);
      return;
    }

    router.refresh();
    setIsRunning(false);
  }

  return (
    <div>
      <button className="run-button" disabled={isRunning} onClick={runWorkflow}>
        {isRunning ? "正在扫描信号..." : "运行 MVP 工作流"}
      </button>
      {error ? <p className="muted">{error}</p> : null}
    </div>
  );
}
