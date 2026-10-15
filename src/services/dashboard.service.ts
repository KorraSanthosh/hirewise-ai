import { prisma } from "@/lib/prisma";
import { DashboardStats, DashboardAnalytics } from "@/types/dashboard";

export async function getDashboardStats(): Promise<DashboardStats> {
  // Run all queries in parallel for better performance
  const [
    totalCandidates,
    activeJobs,
    averageScore,
    shortlisted,
    recentUploads,
  ] = await Promise.all([
    prisma.candidate.count(),

    prisma.job.count(),

    prisma.match.aggregate({
      _avg: {
        overallScore: true,
      },
    }),

    prisma.match.count({
      where: {
        recruiterStatus: "SHORTLISTED",
      },
    }),

    prisma.candidate.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    totalCandidates,
    activeJobs,
    averageAIScore: Number(
      ((averageScore._avg.overallScore ?? 0) * 100).toFixed(1)
    ),
    shortlisted,
    recentUploads,
  };
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  const statuses = ["PENDING", "SHORTLISTED", "REJECTED"];
  
  const [
    pipelineCounts,
    range90to100,
    range80to89,
    range70to79,
    range60to69,
    rangeBelow60,
  ] = await Promise.all([
    Promise.all(
      statuses.map(async (status) => {
        const count = await prisma.match.count({
          where: { recruiterStatus: status },
        });
        return {
          stage: status.charAt(0) + status.slice(1).toLowerCase(),
          candidates: count,
        };
      })
    ),
    prisma.match.count({
      where: {
        overallScore: {
          gte: 0.90,
          lte: 1.0,
        },
      },
    }),
    prisma.match.count({
      where: {
        overallScore: {
          gte: 0.80,
          lt: 0.90,
        },
      },
    }),
    prisma.match.count({
      where: {
        overallScore: {
          gte: 0.70,
          lt: 0.80,
        },
      },
    }),
    prisma.match.count({
      where: {
        overallScore: {
          gte: 0.60,
          lt: 0.70,
        },
      },
    }),
    prisma.match.count({
      where: {
        overallScore: {
          lt: 0.60,
        },
      },
    }),
  ]);

  return {
    pipeline: pipelineCounts,
    distribution: [
      { range: "90–100", candidates: range90to100 },
      { range: "80–89", candidates: range80to89 },
      { range: "70–79", candidates: range70to79 },
      { range: "60–69", candidates: range60to69 },
      { range: "Below 60", candidates: rangeBelow60 },
    ],
  };
}