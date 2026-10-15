import { prisma } from "@/lib/prisma";

export interface DashboardCandidate {
  matchId: string;
  candidateId: string;
  name: string;
  yearsOfExperience: number;
  overallScore: number;
  recruiterStatus: string;
  currentTitle: string | null;
  currentCompany: string | null;
  createdAt: Date;
}

export async function getTopCandidates(): Promise<DashboardCandidate[]> {
  const matches = await prisma.match.findMany({
    orderBy: {
      overallScore: "desc",
    },
    take: 10,
    include: {
      candidate: true,
    },
  });

  return matches.map((m) => ({
    matchId: m.id,
    candidateId: m.candidateId,
    name: m.candidate.name,
    yearsOfExperience: m.candidate.yearsOfExperience,
    overallScore: m.overallScore * 100,
    recruiterStatus: m.recruiterStatus,
    currentTitle: m.candidate.currentTitle,
    currentCompany: m.candidate.currentCompany,
    createdAt: m.createdAt,
  }));
}
