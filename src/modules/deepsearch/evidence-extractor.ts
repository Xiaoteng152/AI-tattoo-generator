/**
 * Evidence Extractor（L2→压缩包）：按研究问题聚合 finding，同源 URL 去重，产出 EvidenceBundle。
 * 不生成最终结论，只为 Synthesis 准备带来源的代表性证据子集。
 */
import type {
  AgentFinding,
  DeepSearchPlan,
  EvidenceBundle,
  EvidenceBundleSource,
  Evidence
} from "./types";

function normaliseUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

// 归一化 URL 后保留置信度更高的一条，合并重复 SERP/帖子链接
function dedupeEvidence(evidenceList: Evidence[]) {
  const map = new Map<string, Evidence>();
  for (const evidence of evidenceList) {
    const key = normaliseUrl(evidence.url);
    const existing = map.get(key);

    if (!existing || existing.confidence < evidence.confidence) {
      map.set(key, evidence);
    }
  }

  return Array.from(map.values());
}

function pickKeyFindings(finding: AgentFinding) {
  const lines = [finding.summary, ...finding.gaps.slice(0, 2)];
  return Array.from(new Set(lines.filter(Boolean))).slice(0, 4);
}

function bundleId(questionId: string) {
  return `bundle_${questionId}`;
}

export type ExtractEvidenceInput = {
  plan: DeepSearchPlan;
  findings: AgentFinding[];
};

/** 每个 plan question 至多一个 bundle；无 evidence 的问题被跳过 */
export function extractEvidenceBundles(input: ExtractEvidenceInput): EvidenceBundle[] {
  return input.plan.questions
    .map((question) => {
      const findingsForQuestion = input.findings.filter((finding) => finding.taskId === question.id);

      if (!findingsForQuestion.length) {
        return null;
      }

      const sources: EvidenceBundleSource[] = [];
      const seenSources = new Map<string, EvidenceBundleSource>();

      for (const finding of findingsForQuestion) {
        for (const evidence of finding.evidence) {
          const key = evidence.sourceType;
          let group = seenSources.get(key);

          if (!group) {
            group = {
              source: evidence.sourceType,
              keyFindings: pickKeyFindings(finding),
              representativeEvidence: []
            };
            seenSources.set(key, group);
            sources.push(group);
          }

          group.representativeEvidence.push(evidence);
        }
      }

      for (const group of sources) {
        group.representativeEvidence = dedupeEvidence(group.representativeEvidence)
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 4);
      }

      const allEvidence = sources.flatMap((group) => group.representativeEvidence);

      if (!allEvidence.length) {
        return null;
      }

      const opportunityCandidate =
        findingsForQuestion[0].summary.split(".")[0] ?? question.question;

      const avgConfidence =
        allEvidence.reduce((sum, evidence) => sum + evidence.confidence, 0) /
        allEvidence.length;

      const compressedSummary = [
        question.question,
        ...findingsForQuestion.map((finding) => finding.summary)
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 320);

      return {
        id: bundleId(question.id),
        questionId: question.id,
        opportunityCandidate,
        sources,
        compressedSummary,
        confidence: Math.round(Math.min(0.95, Math.max(0.2, avgConfidence)) * 100)
      } satisfies EvidenceBundle;
    })
    .filter((bundle): bundle is EvidenceBundle => bundle !== null);
}
