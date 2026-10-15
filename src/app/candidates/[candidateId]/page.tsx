"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  ArrowLeft,
  Users,
  Sparkles,
  Award,
  Briefcase,
  BookOpen,
  Calendar,
  FileText,
  Save,
  Loader2,
  CheckCircle,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  BrainCircuit,
  ListTodo,
  TrendingUp,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Download,
  AlertTriangle,
  Compass,
  Zap,
  BookmarkCheck,
  UploadCloud
} from "lucide-react";

interface Skill {
  id: string;
  name: string;
  proficiency: string;
  durationMonths: number;
}

interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear: number | null;
  endYear: number | null;
  tier: string;
}

interface CareerHistory {
  id: string;
  company: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  durationMonths: number;
  isCurrent: boolean;
  description: string | null;
}

interface Job {
  id: string;
  title: string;
  company: string | null;
}

interface Match {
  id: string;
  jobId: string;
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
  recruiterNotes: string | null;
  recruiterStatus: string;
  job: Job;
}

interface Candidate {
  id: string;
  candidateId: string;
  name: string;
  headline: string | null;
  summary: string | null;
  rawResumeText: string;
  location: string | null;
  country: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  currentCompanySize: string | null;
  currentIndustry: string | null;
  yearsOfExperience: number;
  
  // Behavior Signals
  profileCompleteness: number;
  openToWork: boolean;
  noticePeriodDays: number;
  connectionCount: number;
  recruiterResponse: number;
  avgResponseTime: number;
  expectedSalaryMin: number;
  expectedSalaryMax: number;
  preferredWorkMode: string;
  willingToRelocate: boolean;
  githubActivityScore: number;
  verifiedEmail: boolean;
  verifiedPhone: boolean;
  linkedinConnected: boolean;

  // Timelines
  createdAt: string;
  updatedAt: string;
  lastActiveDate: string | null;

  skills: Skill[];
  education: Education[];
  careerHistory: CareerHistory[];
  matches: Match[];
}

export default function CandidateProfilePage() {
  const params = useParams();
  const candidateId = params.candidateId as string;
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "";

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Selected Job Match for AI evaluation details
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<string>("PENDING");
  const [updatingMatch, setUpdatingMatch] = useState<boolean>(false);
  const [updateSuccess, setUpdateSuccess] = useState<boolean>(false);

  useEffect(() => {
    async function fetchCandidate() {
      try {
        setLoading(true);
        const res = await fetch(`/api/candidates/${candidateId}`);
        if (!res.ok) {
          throw new Error("Candidate profile not found");
        }
        const data = await res.json();
        setCandidate(data);
        
        if (data.matches && data.matches.length > 0) {
          // Select the first match by default
          setSelectedMatchId(data.matches[0].id);
          setNotes(data.matches[0].recruiterNotes || "");
          setStatus(data.matches[0].recruiterStatus);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load candidate profile.");
      } finally {
        setLoading(false);
      }
    }

    if (candidateId) {
      fetchCandidate();
    }
  }, [candidateId]);

  // When selected match changes, update notes and status states
  const handleMatchChange = (matchId: string) => {
    setSelectedMatchId(matchId);
    const match = candidate?.matches.find((m) => m.id === matchId);
    if (match) {
      setNotes(match.recruiterNotes || "");
      setStatus(match.recruiterStatus);
      setUpdateSuccess(false);
    }
  };

  const handleUpdateMatch = async () => {
    if (!selectedMatchId) return;

    try {
      setUpdatingMatch(true);
      setUpdateSuccess(false);
      const res = await fetch(`/api/matches/${selectedMatchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          recruiterStatus: status, 
          recruiterNotes: notes 
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save evaluation updates");
      }

      // Update local candidate matches state
      if (candidate) {
        setCandidate({
          ...candidate,
          matches: candidate.matches.map((m) => 
            m.id === selectedMatchId ? { ...m, recruiterStatus: status, recruiterNotes: notes } : m
          )
        });
      }
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUpdatingMatch(false);
    }
  };

  // Helper to trigger txt file download of raw resume text
  const downloadResumeText = () => {
    if (!candidate) return;
    const element = document.createElement("a");
    const file = new Blob([candidate.rawResumeText], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${candidate.name.replace(/\s+/g, "_")}_extracted_resume.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const activeMatch = candidate?.matches.find((m) => m.id === selectedMatchId);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-100";
    if (score >= 60) return "text-amber-700 bg-amber-50 border-amber-100";
    return "text-rose-700 bg-rose-50 border-rose-100";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <DashboardLayout>
      {/* Back Button */}
      <div className="mb-6">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition font-semibold"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>

      {loading ? (
        /* Loader state */
        <div className="flex flex-col items-center justify-center p-16 text-slate-500 min-h-[500px]">
          <Loader2 size={36} className="animate-spin text-blue-600 mb-4" />
          <p className="font-semibold text-lg">Loading Candidate Profile...</p>
        </div>
      ) : userRole === "candidate" && (error || !candidate || !candidate.rawResumeText || candidate.rawResumeText.trim() === "") ? (
        /* Upload Resume CTA */
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center max-w-xl mx-auto my-12 text-slate-700 shadow-sm">
          <Sparkles size={48} className="mx-auto mb-4 text-blue-500 animate-pulse" />
          <h2 className="text-2xl font-bold text-slate-800">Complete Your Profile</h2>
          <p className="text-sm mt-3 text-slate-500 max-w-md mx-auto leading-relaxed">
            Welcome to HireWise AI! To browse jobs, get AI match scores, and apply for roles, please upload your resume first.
          </p>
          <Link href="/upload-resume" className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md hover:shadow-lg">
            <UploadCloud size={18} />
            Upload Resume
          </Link>
        </div>
      ) : error || !candidate ? (
        /* Error page */
        <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center max-w-xl mx-auto my-12 text-red-700">
          <AlertTriangle size={40} className="mx-auto mb-4" />
          <h2 className="text-lg font-bold">Profile Load Failed</h2>
          <p className="text-sm mt-2">{error || "The candidate profile details could not be loaded."}</p>
          <Link href="/dashboard" className="mt-6 inline-block px-5 py-2.5 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-900 transition">
            Return to Dashboard
          </Link>
        </div>
      ) : (
        /* Main Greenhouse/Lever style ATS dashboard layout */
        <div className="space-y-8 pb-12">
          {/* Header Card (Glassmorphism inspired layout) */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-2xl border border-blue-100 shrink-0">
                {candidate.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-slate-800 flex items-center gap-2.5">
                  {candidate.name}
                  <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider">{candidate.candidateId}</span>
                </h1>
                {candidate.headline && (
                  <p className="text-slate-500 text-lg font-semibold mt-1">{candidate.headline}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-slate-400 mt-3 font-medium">
                  {candidate.location && (
                    <span className="flex items-center gap-1"><MapPin size={12} /> {candidate.location}, {candidate.country}</span>
                  )}
                  {candidate.currentCompany && (
                    <span>💼 {candidate.currentTitle} @ {candidate.currentCompany}</span>
                  )}
                  <span>⏱️ {candidate.yearsOfExperience} Year{candidate.yearsOfExperience === 1 ? "" : "s"} Exp</span>
                </div>
              </div>
            </div>

            {/* Application selector */}
            <div className="flex flex-col gap-3 shrink-0 md:items-end">
              {candidate.matches.length > 0 ? (
                <div className="flex flex-col gap-1.5 md:text-right">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active ATS Job Match</label>
                  <div className="bg-slate-50 px-3 py-2 border border-slate-100 rounded-xl">
                    <select
                      value={selectedMatchId}
                      onChange={(e) => handleMatchChange(e.target.value)}
                      className="text-sm font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                    >
                      {candidate.matches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.job.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 text-slate-500 px-4 py-2 rounded-xl text-xs font-semibold shrink-0">
                  No active job evaluation matches.
                </div>
              )}

              {userRole === "candidate" && (
                <Link 
                  href="/upload-resume" 
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm hover:shadow-md cursor-pointer"
                >
                  <UploadCloud size={14} />
                  Replace Resume
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: Profile Details & Behavior Signals */}
            <div className="col-span-1 lg:col-span-8 space-y-8">
              
              {/* Summary / Headline Card */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Executive Summary</h3>
                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                  {(!candidate.summary || candidate.summary.trim() === "" || candidate.summary.toLowerCase() === "null")
                    ? "No professional summary available."
                    : candidate.summary}
                </p>
              </div>

              {/* Professional details: Experience, Skills, Education */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-8">
                
                {/* Career History */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2 mb-4">
                    <Briefcase size={16} className="text-blue-500" />
                    Career Milestones
                  </h3>
                  {candidate.careerHistory.length > 0 ? (
                    <div className="space-y-6">
                      {candidate.careerHistory.map((history) => (
                        <div key={history.id} className="flex gap-4">
                          <div className="mt-1.5 flex flex-col items-center shrink-0">
                            <div className={`h-3 w-3 rounded-full border-2 ${history.isCurrent ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300"}`}></div>
                            <div className="w-0.5 bg-slate-100 flex-1 my-1"></div>
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                              {history.title}
                              {history.isCurrent && (
                                <span className="bg-green-100 text-green-700 text-[9px] font-bold px-1.5 py-0.5 rounded">Current</span>
                              )}
                            </h4>
                            <p className="text-xs text-slate-500 font-semibold">{history.company}</p>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                              {history.startDate ? new Date(history.startDate).toLocaleDateString(undefined, {month: "short", year: "numeric"}) : ""} - {history.isCurrent ? "Present" : history.endDate ? new Date(history.endDate).toLocaleDateString(undefined, {month: "short", year: "numeric"}) : ""}
                              &middot; {history.durationMonths} Months
                            </p>
                            {history.description && (
                              <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed whitespace-pre-line">{history.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No career history entries recorded.</p>
                  )}
                </div>

                {/* Skills Section */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2 mb-4">
                    <Award size={16} className="text-blue-500" />
                    Skills Matrix
                  </h3>
                  {candidate.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {candidate.skills.map((skill) => (
                        <div key={skill.id} className="bg-blue-50/50 text-blue-700 border border-blue-100/50 px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                          {skill.name}
                          <span className="bg-blue-100 text-blue-800 text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase">
                            {skill.proficiency}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No skills records found.</p>
                  )}
                </div>

                {/* Education Section */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2 mb-4">
                    <BookOpen size={16} className="text-blue-500" />
                    Academic Credentials
                  </h3>
                  {candidate.education.length > 0 ? (
                    <div className="space-y-4">
                      {candidate.education.map((edu) => (
                        <div key={edu.id} className="flex items-start gap-3">
                          <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-500 shrink-0">
                            <BookOpen size={16} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm">{edu.degree} in {edu.fieldOfStudy}</h4>
                            <p className="text-xs text-slate-500 font-semibold">{edu.institution}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                              Class of {edu.endYear || "N/A"} &middot; {edu.tier !== "unknown" ? edu.tier.toUpperCase() : "Standard Tier"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No academic credentials found.</p>
                  )}
                </div>
              </div>

              {/* Behavior Signals Panel */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Zap size={16} className="text-blue-500" />
                  Redrob Behavioral & Verification Signals
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Profile Completeness", value: `${candidate.profileCompleteness}%` },
                    { label: "Open To Work Status", value: candidate.openToWork ? "Yes" : "No" },
                    { label: "Recruiter Response", value: `${(candidate.recruiterResponse * 100).toFixed(0)}%` },
                    { label: "Notice Period", value: `${candidate.noticePeriodDays} Days` },
                    { label: "Preferred Mode", value: candidate.preferredWorkMode.toUpperCase() },
                    { label: "Willing to Relocate", value: candidate.willingToRelocate ? "Yes" : "No" },
                    { label: "Github Activity", value: candidate.githubActivityScore >= 0 ? candidate.githubActivityScore.toFixed(0) : "N/A" },
                    { label: "LinkedIn Connected", value: candidate.linkedinConnected ? "Verified" : "Unlinked" },
                    { label: "Email Status", value: candidate.verifiedEmail ? "Verified" : "Pending" },
                    { label: "Phone Status", value: candidate.verifiedPhone ? "Verified" : "Pending" }
                  ].map((signal, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-100/50 p-3.5 rounded-xl">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{signal.label}</div>
                      <div className="text-sm font-extrabold text-slate-700 mt-1">{signal.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resume Text Extraction Panel */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileText size={16} className="text-blue-500" />
                    Resume Extracted Text Preview
                  </h3>
                  <button 
                    onClick={downloadResumeText} 
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <Download size={12} />
                    Download Extracted Text
                  </button>
                </div>

                <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl max-h-[300px] overflow-y-auto font-mono text-[11px] text-slate-500 whitespace-pre-wrap leading-relaxed">
                  {candidate.rawResumeText}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: AI Matches, Actions & Timeline */}
            <div className="col-span-1 lg:col-span-4 space-y-8">
              
              {/* Match Scoring & Actions Panel */}
              {activeMatch ? (
                <div className="space-y-8">
                  {/* AI Match Matrix */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles size={16} className="text-blue-500" />
                        AI Evaluation Fit
                      </h3>
                      <span className={`px-2.5 py-1 rounded-lg border text-xs font-black ${getScoreColor(activeMatch.overallScore * 100)}`}>
                        {(activeMatch.overallScore * 100).toFixed(0)}% Match
                      </span>
                    </div>

                    {/* Breakdown metrics */}
                    <div className="space-y-3.5">
                      {[
                        { label: "Semantic Similarity", val: activeMatch.semanticSimilarity },
                        { label: "Skill Match", val: activeMatch.skillMatchScore },
                        { label: "Experience Match", val: activeMatch.experienceScore },
                        { label: "Education Credentials", val: activeMatch.educationScore },
                        { label: "Domain Expertise", val: activeMatch.domainScore },
                        { label: "Career Progression", val: activeMatch.careerProgressionScore },
                        { label: "Availability Status", val: activeMatch.availabilityScore }
                      ].map((dim, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-500">
                            <span>{dim.label}</span>
                            <span>{dim.val.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full ${getProgressColor(dim.val)}`} style={{ width: `${dim.val}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Explainability Insights */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
                      <BrainCircuit size={16} className="text-blue-500" />
                      AI Evaluation Insights
                    </h3>

                    {/* Strengths */}
                    {activeMatch.strengths.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">Core Highlights</h4>
                        <ul className="space-y-1">
                          {activeMatch.strengths.map((str, idx) => (
                            <li key={idx} className="text-xs text-slate-600 font-semibold leading-relaxed flex items-start gap-1">
                              <span className="text-emerald-500">•</span>
                              <span>{str}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Weaknesses */}
                    {activeMatch.weaknesses.length > 0 && (
                      <div className="pt-2">
                        <h4 className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1.5">Identified Risks</h4>
                        <ul className="space-y-1">
                          {activeMatch.weaknesses.map((weak, idx) => (
                            <li key={idx} className="text-xs text-slate-600 font-semibold leading-relaxed flex items-start gap-1">
                              <span className="text-rose-500">•</span>
                              <span>{weak}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    <div className="pt-2 border-t border-slate-50">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Hiring Advice</h4>
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {activeMatch.hiringRecommendation}
                      </p>
                    </div>
                  </div>

                  {/* Recruiter Actions Card */}
                  {(userRole === "recruiter" || userRole === "admin") && (
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
                        <BookmarkCheck size={16} className="text-blue-500" />
                        Recruiter Decision Panel
                      </h3>

                      {/* Status Dropdown */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500">Applicant ATS Status</label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 cursor-pointer outline-none"
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="SHORTLISTED">SHORTLISTED</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                      </div>

                      {/* Notes Box */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500">Evaluation Notes</label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Add evaluation comments, interview feedback, or review summary..."
                          rows={4}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 outline-none resize-none focus:bg-white focus:border-blue-400 transition"
                        ></textarea>
                      </div>

                      {/* Submit Actions */}
                      <button
                        onClick={handleUpdateMatch}
                        disabled={updatingMatch}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition shadow-md shadow-blue-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none cursor-pointer"
                      >
                        {updatingMatch ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={16} />
                            Save Decisions & Notes
                          </>
                        )}
                      </button>

                      {updateSuccess && (
                        <div className="text-center text-xs text-green-600 font-bold bg-green-50/50 py-1.5 rounded-lg border border-green-100/50 animate-in fade-in duration-200">
                          ✓ Updates successfully saved to DB.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* No matching evaluations placeholder */
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400">
                  <BrainCircuit size={32} className="mx-auto mb-2 text-slate-300" />
                  <h4 className="font-bold text-slate-700 text-xs">Awaiting Evaluation</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    This candidate profile has not been matches against a job description yet. Navigate to Jobs to begin evaluation.
                  </p>
                </div>
              )}

              {/* Timeline Card */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
                  <Calendar size={16} className="text-blue-500" />
                  Applicant Timeline
                </h3>

                <div className="space-y-3">
                  {[
                    { label: "Profile Created", date: candidate.createdAt },
                    { label: "Profile Updated", date: candidate.updatedAt },
                    { label: "Last Active", date: candidate.lastActiveDate || candidate.createdAt }
                  ].map((timeline, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-400">{timeline.label}</span>
                      <span className="font-semibold text-slate-600">
                        {new Date(timeline.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
