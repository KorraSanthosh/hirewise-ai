"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  Trophy, 
  BriefcaseBusiness, 
  Calendar, 
  ArrowRight,
  Loader2, 
  AlertTriangle,
  Sparkles,
  FileText,
  CheckCircle,
  ExternalLink
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

export default function MyApplicationsPage() {
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
        throw new Error("Failed to fetch applications");
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

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "SELECTED":
      case "SHORTLISTED":
        return "text-emerald-700 bg-emerald-50 border-emerald-250";
      case "REJECTED":
        return "text-rose-700 bg-rose-50 border-rose-250";
      case "PENDING":
      default:
        return "text-blue-700 bg-blue-50 border-blue-250";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-100";
    if (score >= 60) return "text-amber-700 bg-amber-50 border-amber-100";
    return "text-rose-700 bg-rose-50 border-rose-100";
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-800 flex items-center gap-3">
          <Trophy className="text-blue-600 h-10 w-10" />
          My Applications
        </h1>
        <p className="text-slate-500 mt-2">
          Track and manage your submitted applications and real-time AI match scores.
        </p>
      </div>

      {loading || profileLoading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-500 min-h-[400px]">
          <Loader2 size={36} className="animate-spin text-blue-600 mb-4" />
          <p className="font-semibold text-lg">Loading Applications...</p>
        </div>
      ) : !isCandidate ? (
        <div className="bg-amber-50 border border-amber-250 rounded-2xl p-6 text-center max-w-xl mx-auto my-12 text-amber-800">
          <AlertTriangle size={40} className="mx-auto mb-4" />
          <h2 className="text-lg font-bold">Access Restricted</h2>
          <p className="text-sm mt-2">This portal area is dedicated to candidate application tracking only.</p>
        </div>
      ) : !hasResume ? (
        /* Prompt upload resume */
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center max-w-xl mx-auto my-12 text-slate-700 shadow-sm">
          <Sparkles size={48} className="mx-auto mb-4 text-blue-500 animate-pulse" />
          <h2 className="text-2xl font-bold text-slate-800">Complete Your Profile First</h2>
          <p className="text-sm mt-3 text-slate-500 max-w-md mx-auto leading-relaxed">
            Please upload your resume to generate your profile, extract key skills, and unlock the job application workflow.
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
            You have not applied to any job listings yet. View available jobs matching your skillset and start applying today!
          </p>
          <Link href="/jobs" className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md hover:shadow-lg">
            Browse Available Jobs
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        /* Applications list */
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">
                  <th className="py-4 px-6">Role Details</th>
                  <th className="py-4 px-6 text-center">AI Fit Score</th>
                  <th className="py-4 px-6">Applied Date</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-center">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-5 px-6">
                      <div className="font-extrabold text-slate-800 text-base">{app.job.title}</div>
                      <div className="text-xs text-slate-400 font-semibold mt-1 flex items-center gap-2">
                        <span>💼 {app.job.company || "HireWise AI Client"}</span>
                        <span>&middot;</span>
                        <span>{app.job.department || "General"}</span>
                      </div>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <span className={`inline-block px-3 py-1.5 rounded-lg border text-xs font-black tracking-wider ${getScoreColor(app.overallScore * 100)}`}>
                        {(app.overallScore * 100).toFixed(0)}% Match
                      </span>
                    </td>
                    <td className="py-5 px-6 text-slate-500 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        {new Date(app.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <span className={`inline-block px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${getStatusBadge(app.recruiterStatus)}`}>
                        {app.recruiterStatus}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <Link
                        href={`/candidates/${session?.user?.id}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-extrabold uppercase tracking-wider"
                      >
                        Profile
                        <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
