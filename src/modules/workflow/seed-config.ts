import { prisma } from "@/lib/prisma";

export async function ensureSeedWorkflowConfig() {
  const existing = await prisma.workflowConfig.findFirst({
    where: {
      name: "AI tattoo generator MVP workflow"
    },
    include: {
      sources: true
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.workflowConfig.create({
    data: {
      name: "AI tattoo generator MVP workflow",
      productDirection: "AI tattoo generator",
      keywords: ["ai tattoo", "tattoo generator", "minimal tattoo", "fine line tattoo", "tattoo ideas"],
      filters: {
        minEngagement: 20,
        language: "en"
      },
      promptVersion: "mvp-v0",
      outputTemplate: "seo-brief-markdown",
      reviewThreshold: 70,
      sources: {
        create: [
          {
            source: "reddit",
            config: {
              mode: "mock",
              purpose: "problem discovery and discussion heat"
            }
          },
          {
            source: "etsy",
            config: {
              mode: "mock",
              purpose: "commercial demand validation"
            }
          }
        ]
      }
    },
    include: {
      sources: true
    }
  });
}
