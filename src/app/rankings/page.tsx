"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  Trophy, 
  BriefcaseBusiness, 
  Users, 
  Sparkles,
  ChevronDown, 
  ChevronUp,
  Loader2, 
  CheckCircle2, 
  XCircle,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  ExternalLink,
  BookOpen
} from "lucide-react";

interface Job {
  id: string;
  title: string;
  company: string | null;
  department: string | null;
}

interface Skill {
  name: string;
}

interface Candidate {
  id: string;
  candidateId: string;
  name: string;
  headline: string | null;
  yearsOfExperience: number;
  location: string | null;
  skills?: Skill[];
}

interface Match {
  id: string;
  jobId: string;
  candidateId: string;
  overallScore: number;
  semanticSimilarity: number;
  skillMatchScore: number;
  experienceScore: number;
  educationScore: number;
  domainScore: number;
  careerProgressionScore: number;
  availabilityScore: number;
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  hiringRecommendation: string;
  improvementSuggestions: string[];
  recruiterStatus: string;
  candidate: Candidate;
}

export default function AIRankingsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [matches, setMatches] = useState<Match[]>([]);
  
  // Loading states
  const [jobsLoading, setJobsLoading] = useState<boolean>(true);
  const [matchesLoading, setMatchesLoading] = useState<boolean>(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  // Status updating state
  const [updatingMatchId, setUpdatingMatchId] = useState<string | null>(null);

  // Expanded match details list
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Fetch jobs list
  useEffect(() => {
    async function fetchJobs() {
      try {
        setJobsLoading(true);
        const res = await fetch("/api/jobs");
        if (!res.ok) {
          throw new Error("Failed to load jobs list");
        }
        const data = await res.json();
        setJobs(data);
        if (data.length > 0) {
          // Set first job as default
          setSelectedJobId(data[0].id);
        }
      } catch (err: any) {
        setJobsError(err.message || "Failed to load job descriptions.");
      } finally {
        setJobsLoading(false);
      }
    }
    fetchJobs();
  }, []);

  // Fetch matches when selectedJobId changes
  useEffect(() => {
    async function fetchMatches() {
      if (!selectedJobId) {
        setMatches([]);
        return;
      }

      try {
        setMatchesLoading(true);
        setMatchesError(null);
        const res = await fetch(`/api/matches?jobId=${selectedJobId}`);
        if (!res.ok) {
          throw new Error("Failed to load applicant rankings.");
        }
        const data = await res.json();
        setMatches(data);
      } catch (err: any) {
        setMatchesError(err.message || "Failed to retrieve matching list.");
      } finally {
        setMatchesLoading(false);
      }
    }
    fetchMatches();
  }, [selectedJobId]);

  const handleStatusChange = async (matchId: string, newStatus: string) => {
    try {
      setUpdatingMatchId(matchId);
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterStatus: newStatus }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      // Update local state
      setMatches((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, recruiterStatus: newStatus } : m))
      );
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUpdatingMatchId(null);
    }
  };

  const toggleExpand = (matchId: string) => {
    if (expandedMatchId === matchId) {
      setExpandedMatchId(null);
    } else {
      setExpandedMatchId(matchId);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-100";
    if (score >= 60) return "text-amber-700 bg-amber-50 border-amber-100";
    return "text-rose-700 bg-rose-50 border-rose-100";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SHORTLISTED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "REJECTED":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <DashboardLayout>
      {/* Header section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-800 flex items-center gap-3">
            <Trophy className="text-blue-600 h-10 w-10" />
            AI Applicant Rankings
          </h1>
          <p className="text-slate-500 mt-2">
             deterministically ranked by composite hybrid weights scoring models.
          </p>
        </div>

        {/* Job selector dropdown */}
        {!jobsLoading && jobs.length > 0 && (
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 border border-slate-100 rounded-xl shadow-sm min-w-[280px]">
            <BriefcaseBusiness className="text-slate-400 shrink-0 h-5 w-5" />
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full text-slate-700 font-semibold text-sm outline-none bg-transparent cursor-pointer"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.company})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {jobsLoading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-500 min-h-[400px]">
          <Loader2 size={36} className="animate-spin text-blue-600 mb-4" />
          <p className="font-semibold">Loading Target Job Metrics...</p>
        </div>
      ) : jobsError ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center max-w-xl mx-auto my-12 text-red-700">
          <AlertTriangle size={36} className="mx-auto mb-4" />
          <h3 className="font-bold text-lg">System Error</h3>
          <p className="text-sm mt-1">{jobsError}</p>
        </div>
      ) : jobs.length === 0 ? (
        /* Empty jobs state */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center max-w-md mx-auto my-12">
          <BriefcaseBusiness size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800">No Job Descriptions</h3>
          <p className="text-slate-400 text-sm mt-2">
            You must first create a job profile before you can rank candidate applications.
          </p>
          <Link 
            href="/jobs" 
            className="mt-6 inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
          >
            Create Job Profile
          </Link>
        </div>
      ) : (
        /* Matches Board content */
        <div className="space-y-6">
          {matchesLoading ? (
            <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-100 shadow-sm min-h-[400px] text-slate-500">
              <Loader2 size={36} className="animate-spin text-blue-600 mb-4" />
              <p className="font-semibold">Calculating Applicant Rankings...</p>
            </div>
          ) : matchesError ? (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center max-w-xl mx-auto text-red-700">
              <AlertTriangle size={36} className="mx-auto mb-4" />
              <h3 className="font-bold text-lg">Failed to Retrieve Rankings</h3>
              <p className="text-sm mt-1">{matchesError}</p>
            </div>
          ) : matches.length === 0 ? (
            /* No evaluated candidates yet */
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center max-w-lg mx-auto">
              <Users size={48} className="text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-800">No Evaluated Applicants</h3>
              <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
                No candidate profiles have been matched against this job description yet.
              </p>
              <Link 
                href={`/jobs/${selectedJobId}/evaluate`} 
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition shadow-md shadow-blue-100"
              >
                <Sparkles size={16} />
                Evaluate Candidate
              </Link>
            </div>
          ) : (
            /* Rankings List Render */
            <div className="space-y-4">
              {matches.map((match, index) => {
                const rank = index + 1;
                const isExpanded = expandedMatchId === match.id;

                return (
                  <div 
                    key={match.id}
                    className={`bg-white rounded-2xl border transition-all duration-300 ${isExpanded ? "border-blue-200 shadow-md" : "border-slate-100 shadow-sm hover:border-slate-200"}`}
                  >
                    {/* Row header summary */}
                    <div 
                      onClick={() => toggleExpand(match.id)}
                      className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-4">
                        {/* Rank Badge */}
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm ${rank === 1 ? "bg-amber-100 text-amber-800" : rank === 2 ? "bg-slate-200 text-slate-800" : rank === 3 ? "bg-orange-100 text-orange-800" : "bg-slate-50 text-slate-500"}`}>
                          #{rank}
                        </div>

                        <div>
                          <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2.5">
                            {match.candidate.name}
                            <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-md font-bold">{match.candidate.candidateId}</span>
                          </h3>
                          <div className="flex items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1 font-medium">
                            <span>💼 {match.candidate.yearsOfExperience} YOE</span>
                            {match.candidate.location && (
                              <span>📍 {match.candidate.location}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right-aligned scores / actions block */}
                      <div className="flex items-center gap-4 justify-between md:justify-end shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Overall Match score */}
                        <div className={`px-3.5 py-1.5 rounded-xl border text-center font-extrabold text-sm ${getScoreColor(match.overallScore * 100)}`}>
                          {(match.overallScore * 100).toFixed(0)}% Match
                        </div>

                        {/* Recruiter Status Select */}
                        <div className="relative">
                          {updatingMatchId === match.id ? (
                            <div className="px-3.5 py-1.5 border border-slate-100 rounded-xl text-xs font-semibold text-slate-400 flex items-center gap-2">
                              <Loader2 size={12} className="animate-spin text-slate-400" />
                              Updating...
                            </div>
                          ) : (
                            <select
                              value={match.recruiterStatus}
                              onChange={(e) => handleStatusChange(match.id, e.target.value)}
                              className={`px-3.5 py-1.5 border rounded-xl text-xs font-extrabold cursor-pointer outline-none transition uppercase tracking-wider ${getStatusColor(match.recruiterStatus)}`}
                            >
                              <option value="PENDING">Pending</option>
                              <option value="SHORTLISTED">Shortlisted</option>
                              <option value="REJECTED">Rejected</option>
                            </select>
                          )}
                        </div>

                        {/* Expand Trigger Icon */}
                        <button 
                          onClick={() => toggleExpand(match.id)}
                          className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable detailed scorecard body */}
                    {isExpanded && (
                      <div className="px-5 pb-6 border-t border-slate-50 pt-5 space-y-6 bg-slate-50/10 rounded-b-2xl animate-in fade-in duration-200">
                        {/* Scoring dimensions grids */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Evaluations Dimensions Matrix</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                            {[
                              { name: "Semantic", val: match.semanticSimilarity },
                              { name: "Skills", val: match.skillMatchScore },
                              { name: "Experience", val: match.experienceScore },
                              { name: "Education", val: match.educationScore },
                              { name: "Domain", val: match.domainScore },
                              { name: "Progression", val: match.careerProgressionScore },
                              { name: "Availability", val: match.availabilityScore }
                            ].map((dim, idx) => (
                              <div key={idx} className="bg-white border border-slate-100 rounded-xl p-3 text-center">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{dim.name}</div>
                                <div className="text-lg font-black text-slate-800 mt-1">{dim.val.toFixed(0)}%</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Strengths & Weaknesses */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="bg-white border border-slate-100 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                              <ThumbsUp size={14} />
                              Highlight Strengths
                            </h4>
                            <ul className="space-y-1.5">
                              {match.strengths.map((str, idx) => (
                                <li key={idx} className="text-xs text-slate-600 font-semibold flex items-start gap-1.5">
                                  <span className="text-emerald-500 mt-0.5">•</span>
                                  <span>{str}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="bg-white border border-slate-100 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                              <ThumbsDown size={14} />
                              Gaps & Risks
                            </h4>
                            <ul className="space-y-1.5">
                              {match.weaknesses.map((weak, idx) => (
                                <li key={idx} className="text-xs text-slate-600 font-semibold flex items-start gap-1.5">
                                  <span className="text-rose-500 mt-0.5">•</span>
                                  <span>{weak}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Recommendation */}
                        <div className="bg-white border border-slate-100 rounded-xl p-4">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Sparkles size={14} className="text-blue-500" />
                            AI Hiring Recommendation
                          </h4>
                          <p className="text-xs text-slate-600 font-medium leading-relaxed">
                            {match.hiringRecommendation}
                          </p>
                        </div>

                        {/* Skills & CTA */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
                          <div className="flex flex-wrap gap-1.5 max-w-xl">
                            {match.candidate.skills && match.candidate.skills.slice(0, 5).map((s, idx) => (
                              <span key={idx} className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-100">
                                {s.name}
                              </span>
                            ))}
                            {match.candidate.skills && match.candidate.skills.length > 5 && (
                              <span className="text-[10px] text-slate-400 font-bold self-center">
                                +{match.candidate.skills.length - 5} more
                              </span>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Link
                              href={`/candidates/${match.candidate.id}`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                              <Users size={12} />
                              Candidate Profile
                            </Link>
                            <a
                              href={`/jobs/${selectedJobId}/evaluate`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-100 cursor-pointer"
                            >
                              Evaluate New
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
