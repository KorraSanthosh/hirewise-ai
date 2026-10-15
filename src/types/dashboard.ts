export interface DashboardStats {
  totalCandidates: number;
  activeJobs: number;
  averageAIScore: number;
  shortlisted: number;
  recentUploads: number;
}

export interface CandidatePipelineStage {
  stage: string;
  candidates: number;
}

export interface MatchDistributionRange {
  range: string;
  candidates: number;
}

export interface DashboardAnalytics {
  pipeline: CandidatePipelineStage[];
  distribution: MatchDistributionRange[];
}