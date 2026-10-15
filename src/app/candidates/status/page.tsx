"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  LayoutDashboard, 
  BriefcaseBusiness, 
  Loader2, 
  AlertTriangle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  CalendarDays
} from "lucide-react";

interface Job {
  id: string;
  title: string;
  company: string | null;
  department: string | null;
}

interface Match {
  id: string;
  jobId: string;
  overallScore: number;
  recruiterStatus: string;
  createdAt: string;
  job: Job;
}

export default function ApplicationStatusPage() {
  const { data: session } = useSession();
  const isCandidate = (session?.user as any)?.role === "candidate";

  const [applications, setApplications] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Profile status to check if resume uploaded
  const [candidateProfile, setCandidateProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);

  useEffect(() => {
    if (session?.user?.id && isCandidate) {
      fetchCandidateProfile();
      fetchApplications();
    } else if (session) {
      setLoading(false);
      setProfileLoading(false);
    }
  }, [session, isCandidate]);

  const fetchCandidateProfile = async () => {
    try {
      const res = await fetch(`/api/candidates/${session?.user?.id}`);
      if (res.ok) {
        const data = await res.json();
        setCandidateProfile(data);
      }
    } catch (err) {
      console.error("Failed to fetch candidate profile:", err);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/matches");
      if (!res.ok) {
        throw new Error("Failed to fetch matches");
      }
      const data = await res.json();
      setApplications(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const hasResume = !!(candidateProfile && candidateProfile.rawResumeText && candidateProfile.rawResumeText.trim() !== "");

  // Stages in pipeline
  const pipelineStages = [
    { label: "Applied", description: "Application received" },
    { label: "Under Review", description: "AI screening in progress" },
    { label: "Shortlisted", description: "Selected for review" },
    { label: "Interview", description: "Interviews scheduled" },
    { label: "Decision", description: "Final hiring decision" }
  ];

  const getStageStatus = (status: string, index: number) => {
    const statusUpper = status.toUpperCase();
    
    // Rejected flow
    if (statusUpper === "REJECTED") {
      if (index < 2) return "completed";
      if (index === 4) return "failed";
      return "skipped";
    }

    // Pending/Applied flow
    if (statusUpper === "PENDING") {
      if (index === 0) return "completed";
      if (index === 1) return "current";
      return "upcoming";
    }

    // Shortlisted flow
    if (statusUpper === "SHORTLISTED") {
      if (index < 3) return "completed";
      if (index === 3) return "current";
      return "upcoming";
    }

    // Selected/Hired flow
    if (statusUpper === "SELECTED" || statusUpper === "HIRED") {
      return "completed";
    }

    return "upcoming";
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-800 flex items-center gap-3">
          <LayoutDashboard className="text-blue-600 h-10 w-10" />
          Application Status
        </h1>
        <p className="text-slate-500 mt-2">
          Visualize where your applications stand in our recruiter and AI pipeline.
        </p>
      </div>

      {loading || profileLoading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-500 min-h-[400px]">
          <Loader2 size={36} className="animate-spin text-blue-600 mb-4" />
          <p className="font-semibold text-lg">Loading Status Boards...</p>
        </div>
      ) : !isCandidate ? (
        <div className="bg-amber-50 border border-amber-250 rounded-2xl p-6 text-center max-w-xl mx-auto my-12 text-amber-800">
          <AlertTriangle size={40} className="mx-auto mb-4" />
          <h2 className="text-lg font-bold">Access Restricted</h2>
          <p className="text-sm mt-2">This portal area is dedicated to candidate application status tracking only.</p>
        </div>
      ) : !hasResume ? (
        /* Prompt upload resume */
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center max-w-xl mx-auto my-12 text-slate-700 shadow-sm">
          <Sparkles size={48} className="mx-auto mb-4 text-blue-500 animate-pulse" />
          <h2 className="text-2xl font-bold text-slate-800">Complete Your Profile First</h2>
          <p className="text-sm mt-3 text-slate-500 max-w-md mx-auto leading-relaxed">
            Please upload your resume to generate your profile, extract key skills, and unlock the application tracking dashboard.
          </p>
          <Link href="/upload-resume" className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md hover:shadow-lg">
            Upload Resume
          </Link>
        </div>
      ) : applications.length === 0 ? (
        /* No applications yet */
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center max-w-xl mx-auto my-12 text-slate-700 shadow-sm">
          <BriefcaseBusiness size={48} className="mx-auto mb-4 text-slate-400" />
          <h2 className="text-xl font-bold text-slate-800">No Applications Yet</h2>
          <p className="text-sm mt-3 text-slate-500 max-w-md mx-auto leading-relaxed">
            You don't have any application pipelines running. Apply to job listings to trigger the AI-driven evaluation.
          </p>
          <Link href="/jobs" className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md hover:shadow-lg">
            Browse Available Jobs
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        /* Status cards listing */
        <div className="space-y-6">
          {applications.map((app) => (
            <div key={app.id} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
              {/* Job Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-800">{app.job.title}</h3>
                  <div className="text-xs text-slate-400 font-semibold mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>💼 {app.job.company || "HireWise AI Client"}</span>
                    <span>&middot;</span>
                    <span>{app.job.department || "General"}</span>
                    <span>&middot;</span>
                    <span className="flex items-center gap-1 font-medium"><CalendarDays size={12} /> Applied {new Date(app.createdAt).toLocaleDateString(undefined, {month: "short", day: "numeric", year: "numeric"})}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">AI Screen score:</span>
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-black">
                    {(app.overallScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Stepper Pipeline */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
                {pipelineStages.map((stage, idx) => {
                  const stageStatus = getStageStatus(app.recruiterStatus, idx);
                  
                  return (
                    <div key={idx} className="flex flex-row md:flex-col items-start gap-4 md:gap-2 relative z-10">
                      {/* Circle indicator */}
                      <div className="flex items-center shrink-0">
                        {stageStatus === "completed" && (
                          <div className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-250 flex items-center justify-center font-bold">
                            <CheckCircle2 size={18} />
                          </div>
                        )}
                        {stageStatus === "current" && (
                          <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 border border-blue-300 flex items-center justify-center font-bold animate-pulse">
                            <Clock size={18} />
                          </div>
                        )}
                        {stageStatus === "failed" && (
                          <div className="h-9 w-9 rounded-full bg-rose-50 text-rose-600 border border-rose-250 flex items-center justify-center font-bold">
                            <XCircle size={18} />
                          </div>
                        )}
                        {stageStatus === "skipped" && (
                          <div className="h-9 w-9 rounded-full bg-slate-50 text-slate-350 border border-slate-200 flex items-center justify-center font-bold">
                            &middot;
                          </div>
                        )}
                        {stageStatus === "upcoming" && (
                          <div className="h-9 w-9 rounded-full bg-slate-50 text-slate-400 border border-slate-200 flex items-center justify-center font-semibold text-sm">
                            {idx + 1}
                          </div>
                        )}
                        
                        {/* Horizontal connecting line (only on MD and up) */}
                        {idx < 4 && (
                          <div className="hidden md:block absolute top-4 left-9 right-0 h-0.5 bg-slate-100 -z-10">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                stageStatus === "completed" ? "bg-emerald-500 w-full" : "bg-transparent w-0"
                              }`}
                            />
                          </div>
                        )}
                      </div>

                      {/* Text content */}
                      <div className="flex flex-col md:text-left">
                        <span className={`text-sm font-extrabold ${
                          stageStatus === "completed" ? "text-slate-800" :
                          stageStatus === "current" ? "text-blue-600" :
                          stageStatus === "failed" ? "text-rose-600" : "text-slate-400"
                        }`}>
                          {idx === 4 && app.recruiterStatus.toUpperCase() === "SELECTED" ? "Selected" :
                           idx === 4 && app.recruiterStatus.toUpperCase() === "REJECTED" ? "Rejected" : stage.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{stage.description}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
