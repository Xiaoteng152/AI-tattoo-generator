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
      <button className="ds-primary-btn" disabled={isRunning} onClick={runWorkflow} type="button">
        {isRunning ? "Workflow running…" : "Run MVP Workflow"}
      </button>
      {error ? <p className="ds-warning">{error}</p> : null}
    </div>
  );
}
