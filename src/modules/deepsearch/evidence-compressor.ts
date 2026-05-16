import type { DeepSearchObservation, DeepSearchPlan, EvidenceBundle } from "./types";

function makeBundleId(questionId: string) {
  return `bundle_${questionId}`;
}

function metricSummary(metrics: Record<string, number | undefined>) {
  const parts = [
    metrics.upvotes !== undefined ? `${metrics.upvotes} upvotes` : null,
    metrics.comments !== undefined ? `${metrics.comments} comments` : null,
    metrics.favorites !== undefined ? `${metrics.favorites} likes` : null,
    metrics.retweets !== undefined ? `${metrics.retweets} reposts` : null,
    metrics.replies !== undefined ? `${metrics.replies} replies` : null,
    metrics.views !== undefined ? `${metrics.views} views` : null,
    metrics.saves !== undefined ? `${metrics.saves} saves/views` : null,
    metrics.salesSignal !== undefined ? `${metrics.salesSignal} commercial signal` : null
  ].filter(Boolean);

  return parts.length ? parts.join(" / ") : "no public metrics";
}

function explainEvidence(observation: DeepSearchObservation) {
  const painPoint = observation.enrichment.painPoints[0];
  const angle = observation.enrichment.contentAngles[0];

  if (painPoint) {
    return `${observation.source} evidence points to: ${painPoint}.`;
  }

  if (angle) {
    return `${observation.source} evidence supports content angle: ${angle}.`;
  }

  return `${observation.source} evidence supports this question with source-backed user language.`;
}

function topObservations(observations: DeepSearchObservation[]) {
  return [...observations]
    .sort((a, b) => b.normalized.engagementScore - a.normalized.engagementScore)
    .slice(0, 5);
}

export function compressEvidenceBundles(plan: DeepSearchPlan, observations: DeepSearchObservation[]): EvidenceBundle[] {
  return plan.questions.flatMap((question) => {
    const questionObservations = observations.filter((observation) => observation.questionId === question.id);

    if (!questionObservations.length) {
      return [];
    }

    const groupedBySource = new Map<string, DeepSearchObservation[]>();

    for (const observation of questionObservations) {
      groupedBySource.set(observation.source, [...(groupedBySource.get(observation.source) ?? []), observation]);
    }

    const sources = Array.from(groupedBySource.entries()).map(([source, sourceObservations]) => {
      const representatives = topObservations(sourceObservations);
      const keyFindings = Array.from(
        new Set(
          representatives.flatMap((observation) => [
            observation.enrichment.evidenceSummary,
            ...observation.enrichment.painPoints.slice(0, 2),
            ...observation.enrichment.contentAngles.slice(0, 1)
          ])
        )
      ).slice(0, 4);

      return {
        source: source as EvidenceBundle["sources"][number]["source"],
        keyFindings,
        representativeEvidence: representatives.map((observation) => ({
          rawItemId: observation.rawItem.externalId,
          title: observation.normalized.title,
          url: observation.normalized.sourceUrl,
          metricSummary: metricSummary(observation.rawItem.metrics),
          whyItMatters: explainEvidence(observation)
        }))
      };
    });

    const strongest = topObservations(questionObservations)[0];
    const sourceCoverageBonus = Math.min(20, sources.length * 10);
    const confidence = Math.min(95, 45 + sourceCoverageBonus + Math.round(questionObservations.length * 2.5));

    return [
      {
        id: makeBundleId(question.id),
        questionId: question.id,
        opportunityCandidate: strongest.enrichment.keywords[0] ?? strongest.normalized.title,
        sources,
        compressedSummary: `${question.question} ${sources
          .flatMap((source) => source.keyFindings)
          .slice(0, 3)
          .join(" ")}`,
        confidence
      }
    ];
  });
}
