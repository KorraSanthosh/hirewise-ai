"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import CandidatePipelineChart from "@/components/charts/CandidatePipelineChart";
import MatchDistributionChart from "@/components/charts/MatchDistributionChart";
import { DashboardStats, DashboardAnalytics } from "@/types/dashboard";
import { DashboardCandidate } from "@/services/candidate-dashboard.service";
import {
  Users,
  BriefcaseBusiness,
  Trophy,
  TrendingUp,
} from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [candidates, setCandidates] = useState<DashboardCandidate[]>([]);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(true);
  
  const [statsError, setStatsError] = useState<string | null>(null);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/dashboard/stats");
        if (!res.ok) {
          throw new Error("Failed to fetch dashboard statistics");
        }
        const data: DashboardStats = await res.json();
        setStats(data);
      } catch (err: any) {
        setStatsError(err.message || "An unexpected error occurred");
      } finally {
        setLoadingStats(false);
      }
    }

    async function fetchCandidates() {
      try {
        const res = await fetch("/api/dashboard/candidates");
        if (!res.ok) {
          throw new Error("Failed to fetch top candidates");
        }
        const data: DashboardCandidate[] = await res.json();
        setCandidates(data);
      } catch (err: any) {
        setCandidatesError(err.message || "An unexpected error occurred");
      } finally {
        setLoadingCandidates(false);
      }
    }

    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/dashboard/analytics");
        if (!res.ok) {
          throw new Error("Failed to fetch dashboard analytics");
        }
        const data: DashboardAnalytics = await res.json();
        setAnalytics(data);
      } catch (err: any) {
        setAnalyticsError(err.message || "An unexpected error occurred");
      } finally {
        setLoadingAnalytics(false);
      }
    }

    fetchStats();
    fetchCandidates();
    fetchAnalytics();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "SHORTLISTED":
        return (
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
            Shortlisted
          </span>
        );
      case "PENDING":
        return (
          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
            Pending
          </span>
        );
      case "REJECTED":
        return (
          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
            Rejected
          </span>
        );
      default:
        return (
          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
            {status || "Unknown"}
          </span>
        );
    }
  };

  const retryFetchStats = () => {
    setLoadingStats(true);
    setStatsError(null);
    fetch("/api/dashboard/stats")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch dashboard statistics");
        return res.json();
      })
      .then((data) => {
        setStats(data);
        setLoadingStats(false);
      })
      .catch((err) => {
        setStatsError(err.message || "An unexpected error occurred");
        setLoadingStats(false);
      });
  };

  const retryFetchCandidates = () => {
    setLoadingCandidates(true);
    setCandidatesError(null);
    fetch("/api/dashboard/candidates")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch top candidates");
        return res.json();
      })
      .then((data) => {
        setCandidates(data);
        setLoadingCandidates(false);
      })
      .catch((err) => {
        setCandidatesError(err.message || "An unexpected error occurred");
        setLoadingCandidates(false);
      });
  };

  const retryFetchAnalytics = () => {
    setLoadingAnalytics(true);
    setAnalyticsError(null);
    fetch("/api/dashboard/analytics")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch dashboard analytics");
        return res.json();
      })
      .then((data) => {
        setAnalytics(data);
        setLoadingAnalytics(false);
      })
      .catch((err) => {
        setAnalyticsError(err.message || "An unexpected error occurred");
        setLoadingAnalytics(false);
      });
  };

  if (loadingStats) {
    return (
      <DashboardLayout>
        {/* Heading Skeleton */}
        <div className="mb-8 animate-pulse">
          <div className="h-10 w-64 bg-slate-200 rounded-lg"></div>
          <div className="h-4 w-80 bg-slate-200 rounded-lg mt-3"></div>
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="space-y-3 flex-1">
                  <div className="h-4 w-24 bg-slate-200 rounded"></div>
                  <div className="h-8 w-16 bg-slate-200 rounded"></div>
                  <div className="h-3 w-32 bg-slate-200 rounded"></div>
                </div>
                <div className="h-12 w-12 bg-slate-200 rounded-2xl"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-2 gap-6 mt-8 animate-pulse">
          <div className="bg-white rounded-2xl shadow-sm p-6 h-80">
            <div className="h-6 w-40 bg-slate-200 rounded mb-4"></div>
            <div className="h-48 bg-slate-100 rounded-xl"></div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6 h-80">
            <div className="h-6 w-40 bg-slate-200 rounded mb-4"></div>
            <div className="h-48 bg-slate-100 rounded-xl"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (statsError) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-800 shadow-sm max-w-2xl mx-auto mt-8">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Unable to load dashboard statistics</h3>
              <p className="text-sm text-red-700 mt-1">{statsError}</p>
              <button 
                onClick={retryFetchStats}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition duration-150 shadow-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-800">
          👋 Welcome back, Recruiter
        </h1>

        <p className="text-slate-500 mt-2">
          AI has analyzed {stats?.recentUploads.toLocaleString() ?? 0} resumes in the last 7 days.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard
          title="Total Candidates"
          value={stats?.totalCandidates.toLocaleString() ?? "0"}
          change={stats ? `+${stats.recentUploads.toLocaleString()} this week` : "Synced with Database"}
          icon={Users}
          color="bg-blue-600"
        />

        <StatCard
          title="Active Jobs"
          value={stats?.activeJobs.toLocaleString() ?? "0"}
          change="Synced with Database"
          icon={BriefcaseBusiness}
          color="bg-green-600"
        />

        <StatCard
          title="Shortlisted"
          value={stats?.shortlisted.toLocaleString() ?? "0"}
          change="Updated in Real Time"
          icon={Trophy}
          color="bg-yellow-500"
        />

        <StatCard
          title="Average AI Score"
          value={stats ? `${stats.averageAIScore}%` : "0%"}
          change="Live Data"
          icon={TrendingUp}
          color="bg-purple-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 h-80 flex flex-col justify-between">
          <h2 className="font-semibold text-xl mb-4">
            Candidate Pipeline
          </h2>

          <div className="flex-1 flex items-center justify-center text-gray-400">
            {analyticsError ? (
              <div className="text-center text-red-500 text-sm">
                <span>{analyticsError}</span>
                <button
                  onClick={retryFetchAnalytics}
                  className="block mx-auto mt-2 underline hover:text-red-700 font-semibold"
                >
                  Retry
                </button>
              </div>
            ) : (
              <CandidatePipelineChart
                data={analytics?.pipeline ?? []}
                loading={loadingAnalytics}
              />
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 h-80 flex flex-col justify-between">
          <h2 className="font-semibold text-xl mb-4">
            AI Match Distribution
          </h2>

          <div className="flex-1 flex items-center justify-center text-gray-400">
            {analyticsError ? (
              <div className="text-center text-red-500 text-sm">
                <span>{analyticsError}</span>
                <button
                  onClick={retryFetchAnalytics}
                  className="block mx-auto mt-2 underline hover:text-red-700 font-semibold"
                >
                  Retry
                </button>
              </div>
            ) : (
              <MatchDistributionChart
                data={analytics?.distribution ?? []}
                loading={loadingAnalytics}
              />
            )}
          </div>
        </div>
      </div>

      {/* Recent Candidates */}
      <div className="bg-white rounded-2xl shadow-sm mt-8 p-6">
        <h2 className="text-2xl font-semibold mb-5">
          Top Ranked Candidates
        </h2>

        <table className="w-full">
          <thead>
            <tr className="text-left border-b text-slate-500 text-sm font-semibold">
              <th className="py-3">Candidate</th>
              <th>Current Title</th>
              <th>Experience</th>
              <th>AI Score</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {loadingCandidates ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="border-b animate-pulse">
                  <td className="py-4">
                    <div className="h-5 w-24 bg-slate-200 rounded"></div>
                  </td>
                  <td>
                    <div className="h-5 w-48 bg-slate-200 rounded"></div>
                  </td>
                  <td>
                    <div className="h-5 w-16 bg-slate-200 rounded"></div>
                  </td>
                  <td>
                    <div className="h-5 w-12 bg-slate-200 rounded"></div>
                  </td>
                  <td>
                    <div className="h-7 w-20 bg-slate-200 rounded-full"></div>
                  </td>
                </tr>
              ))
            ) : candidatesError ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-red-500 font-medium">
                  {candidatesError}.{" "}
                  <button
                    onClick={retryFetchCandidates}
                    className="underline hover:text-red-700 font-semibold"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            ) : candidates.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                  No candidates analyzed yet.
                </td>
              </tr>
            ) : (
              candidates.map((candidate) => (
                <tr key={candidate.matchId} className="border-b hover:bg-slate-50 transition duration-150">
                  <td className="py-4 font-semibold text-slate-800">
                    <Link href={`/candidates/${candidate.candidateId}`} className="hover:text-blue-600 hover:underline cursor-pointer">
                      {candidate.name}
                    </Link>
                  </td>
                  <td className="text-slate-600">
                    {candidate.currentTitle ? (
                      candidate.currentCompany ? (
                        <span>
                          {candidate.currentTitle} <span className="text-slate-400">@</span> {candidate.currentCompany}
                        </span>
                      ) : (
                        candidate.currentTitle
                      )
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="text-slate-600">
                    {candidate.yearsOfExperience} Year{candidate.yearsOfExperience === 1 ? "" : "s"}
                  </td>
                  <td className="font-bold text-blue-600">
                    {candidate.overallScore.toFixed(1)}%
                  </td>
                  <td>
                    {getStatusBadge(candidate.recruiterStatus)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}