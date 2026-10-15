"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  ArrowLeft, 
  UploadCloud, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Sparkles,
  Award,
  ChevronRight,
  TrendingUp,
  BrainCircuit,
  ListTodo,
  AlertCircle
} from "lucide-react";

interface Job {
  id: string;
  title: string;
  company: string | null;
  department: string | null;
  domain: string | null;
  experienceYears: number;
  educationLevel: string;
  requiredSkills: string[];
  preferredSkills: string[];
}

interface Candidate {
  id: string;
  candidateId: string;
  name: string;
  headline: string | null;
  yearsOfExperience: number;
  location: string | null;
}

interface MatchResult {
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
  candidate: Candidate;
}

export default function JobEvaluatePage() {
  const params = useParams();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<Job | null>(null);
  const [jobLoading, setJobLoading] = useState<boolean>(true);
  const [jobError, setJobError] = useState<string | null>(null);

  // Upload/Evaluation States
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "matching" | "success" | "error">("idle");
  const [progress, setProgress] = useState<number>(0);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch job details on load
  useEffect(() => {
    async function fetchJob() {
      try {
        setJobLoading(true);
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) {
          throw new Error("Job not found");
        }
        const data = await res.json();
        setJob(data);
      } catch (err: any) {
        setJobError(err.message || "Failed to load job details.");
      } finally {
        setJobLoading(false);
      }
    }
    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setEvaluationError(null);
    setMatchResult(null);
    setStatus("idle");

    if (selectedFile.type !== "application/pdf" && !selectedFile.name.endsWith(".pdf")) {
      setEvaluationError("Only PDF resumes are supported.");
      setFile(null);
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setEvaluationError("File size exceeds 10MB limit.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleEvaluate = async () => {
    if (!file) return;

    setStatus("uploading");
    setProgress(20);
    setEvaluationError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 80) {
            clearInterval(progressInterval);
            setStatus("matching");
            return 80;
          }
          return prev + 15;
        });
      }, 400);

      const res = await fetch(`/api/jobs/${jobId}/evaluate`, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Evaluation failed");
      }

      const result = await res.json();
      setProgress(100);
      setMatchResult(result.data);
      setStatus("success");
    } catch (err: any) {
      setEvaluationError(err.message || "An unexpected error occurred during resume evaluation.");
      setStatus("error");
    }
  };

  const handleReset = () => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setEvaluationError(null);
    setMatchResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-100";
    if (score >= 60) return "text-amber-600 bg-amber-50 border-amber-100";
    return "text-rose-600 bg-rose-50 border-rose-100";
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
          href="/jobs" 
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition font-semibold"
        >
          <ArrowLeft size={16} />
          Back to Jobs
        </Link>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 mb-6 text-sm text-blue-700 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="font-semibold leading-relaxed">
          This workflow is intended for recruiters importing candidate resumes from external sources such as LinkedIn, Naukri, referrals, or email applications.
        </p>
      </div>

      {jobLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-500 min-h-[400px]">
          <Loader2 size={36} className="animate-spin text-blue-600 mb-4" />
          <p className="font-medium">Loading Job Description Profile...</p>
        </div>
      ) : jobError || !job ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center max-w-xl mx-auto my-12">
          <XCircle size={40} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-800">Job Not Found</h2>
          <p className="text-sm text-slate-500 mt-2">{jobError || "The specified job profile could not be loaded."}</p>
          <Link href="/jobs" className="mt-6 inline-block px-5 py-2.5 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-900 transition">
            Return to Job List
          </Link>
        </div>
      ) : (
        <>
          {/* Header & Job Details Card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1.5">
                Target Evaluation Role
              </div>
              <h1 className="text-3xl font-extrabold text-slate-800">{job.title}</h1>
              <p className="text-slate-500 font-medium mt-1">
                {job.company} &middot; {job.department}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs font-medium text-slate-400">
                <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">💻 {job.domain || "General"}</span>
                <span>🎓 {job.educationLevel}</span>
                <span>💼 {job.experienceYears} Year{job.experienceYears === 1 ? "" : "s"} Exp</span>
              </div>
            </div>

            {/* Required Skills Badges */}
            <div className="max-w-md">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Required Skills</h4>
              <div className="flex flex-wrap gap-1.5">
                {job.requiredSkills.map((s, idx) => (
                  <span key={idx} className="bg-slate-50 text-slate-700 border border-slate-100 px-2.5 py-1 rounded-lg text-xs font-semibold">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Upload Area Column */}
            <div className={`col-span-1 lg:col-span-5 bg-white rounded-2xl p-6 border shadow-sm transition-all duration-300 ${dragActive ? "border-blue-500 bg-blue-50/20" : "border-slate-100"}`}>
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                Evaluate Candidate
              </h2>

              {status !== "success" && (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition duration-150 min-h-[250px]
                  ${dragActive ? "border-blue-500 bg-blue-50/40" : "border-slate-200 hover:border-blue-400 hover:bg-slate-50/50"}`}
                  onClick={status === "idle" ? handleBrowseClick : undefined}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={status !== "idle"}
                  />

                  <UploadCloud size={48} className={`mb-4 transition duration-150 ${dragActive ? "text-blue-600 animate-bounce" : "text-slate-400"}`} />

                  <p className="font-semibold text-slate-800 text-sm">
                    Drag & drop resume here, or <span className="text-blue-600 hover:underline">select candidate resume</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-2">PDF files only (Max 10MB)</p>
                </div>
              )}

              {/* Selected File Details */}
              {file && status !== "success" && (
                <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="text-blue-600 h-8 w-8 shrink-0" />
                    <div className="overflow-hidden">
                      <p className="font-semibold text-slate-800 text-sm truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  {status === "idle" && (
                    <button onClick={handleReset} className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer">
                      Clear
                    </button>
                  )}
                </div>
              )}

              {/* Error messages */}
              {evaluationError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl flex items-start gap-2.5">
                  <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                  <span>{evaluationError}</span>
                </div>
              )}

              {/* Trigger Button */}
              {status === "idle" && file && (
                <button
                  onClick={handleEvaluate}
                  className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-md shadow-blue-100 cursor-pointer"
                >
                  Run AI Candidate Assessment
                </button>
              )}

              {/* Loading progress bars */}
              {(status === "uploading" || status === "matching") && (
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-blue-600" />
                      {status === "uploading" ? "Importing Candidate..." : "Running Scoring Algorithms..."}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Reset on Success */}
              {status === "success" && (
                <div className="mt-4 text-center p-6 border border-green-100 bg-green-50/10 rounded-2xl flex flex-col items-center">
                  <CheckCircle size={48} className="text-green-600 mb-3" />
                  <h3 className="text-lg font-bold text-slate-800">Evaluation Complete!</h3>
                  <p className="text-sm text-slate-500 mt-1.5">
                    Candidate match record and composite weights successfully saved.
                  </p>
                  
                  <div className="flex gap-3 w-full mt-6">
                    <button
                      onClick={handleReset}
                      className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl text-sm transition cursor-pointer"
                    >
                      Evaluate Another Candidate
                    </button>
                    <a
                      href="/dashboard"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-md shadow-blue-100 cursor-pointer"
                    >
                      Open Candidate Profile
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Results Column */}
            <div className="col-span-1 lg:col-span-7">
              {matchResult ? (
                /* Complete AI Evaluation Breakdown Display */
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {/* Top overall score panel */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-50">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest mb-1.5">
                          <Sparkles size={14} />
                          AI Scorecard
                        </div>
                        <h2 className="text-2xl font-extrabold text-slate-800">
                          {matchResult.candidate.name}
                        </h2>
                        {matchResult.candidate.headline && (
                          <p className="text-slate-500 text-sm font-medium mt-0.5">{matchResult.candidate.headline}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-2 font-medium">
                          📍 {matchResult.candidate.location || "Location N/A"} &middot; {matchResult.candidate.yearsOfExperience} Years Exp
                        </p>
                      </div>

                      {/* Giant score badge */}
                      <div className={`p-4 rounded-2xl border text-center min-w-[120px] ${getScoreColor(matchResult.overallScore * 100)}`}>
                        <div className="text-4xl font-extrabold">{(matchResult.overallScore * 100).toFixed(0)}%</div>
                        <div className="text-[10px] font-extrabold uppercase mt-1 tracking-wider">Overall Fit</div>
                      </div>
                    </div>

                    {/* Horizontal score category list */}
                    <div className="mt-6 space-y-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-blue-500" />
                        Scoring Dimension Breakdown
                      </h3>

                      {[
                        { label: "Semantic Similarity", value: matchResult.semanticSimilarity },
                        { label: "Skill Match", value: matchResult.skillMatchScore },
                        { label: "Experience Match", value: matchResult.experienceScore },
                        { label: "Education Credentials", value: matchResult.educationScore },
                        { label: "Domain Expertise", value: matchResult.domainScore },
                        { label: "Career Progression", value: matchResult.careerProgressionScore },
                        { label: "Availability Status", value: matchResult.availabilityScore }
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold text-slate-600">
                            <span>{item.label}</span>
                            <span>{item.value.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden border border-slate-100/50">
                            <div 
                              className={`h-full transition-all duration-300 ${getProgressColor(item.value)}`}
                              style={{ width: `${item.value}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Strengths & Weaknesses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Strengths */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 text-emerald-600">
                        <CheckCircle size={16} />
                        Core Strengths
                      </h3>
                      {matchResult.strengths.length > 0 ? (
                        <ul className="space-y-3">
                          {matchResult.strengths.map((str, idx) => (
                            <li key={idx} className="text-xs text-slate-600 font-medium flex items-start gap-2">
                              <ChevronRight className="text-emerald-500 h-4 w-4 shrink-0 mt-0.5" />
                              <span>{str}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">No significant highlights detected.</p>
                      )}
                    </div>

                    {/* Weaknesses */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 text-rose-600">
                        <AlertCircle size={16} />
                        Identified Gaps
                      </h3>
                      {matchResult.weaknesses.length > 0 ? (
                        <ul className="space-y-3">
                          {matchResult.weaknesses.map((weak, idx) => (
                            <li key={idx} className="text-xs text-slate-600 font-medium flex items-start gap-2">
                              <ChevronRight className="text-rose-500 h-4 w-4 shrink-0 mt-0.5" />
                              <span>{weak}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">No significant weaknesses flagged.</p>
                      )}
                    </div>
                  </div>

                  {/* Missing Skills Badge Panel */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 text-slate-700">
                      <Award size={16} className="text-amber-500" />
                      Missing Core Skills
                    </h3>
                    {matchResult.missingSkills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {matchResult.missingSkills.map((skill, idx) => (
                          <span key={idx} className="bg-amber-50 text-amber-800 border border-amber-100 px-3 py-1 rounded-xl text-xs font-semibold">
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-green-600 font-semibold">Candidate possesses all key skills listed in the job description!</p>
                    )}
                  </div>

                  {/* Recommendations & Suggestions */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
                    {/* Recommendation */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 mb-2.5 flex items-center gap-2">
                        <BrainCircuit size={16} className="text-blue-500" />
                        AI Hiring Recommendation
                      </h3>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 border border-slate-100 p-4 rounded-xl">
                        {matchResult.hiringRecommendation}
                      </p>
                    </div>

                    {/* Improvement Suggestions */}
                    {matchResult.improvementSuggestions.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <ListTodo size={16} className="text-blue-500" />
                          Improvement Suggestions
                        </h3>
                        <ul className="space-y-3.5">
                          {matchResult.improvementSuggestions.map((sug, idx) => (
                            <li key={idx} className="text-xs text-slate-600 font-medium flex items-start gap-2.5">
                              <div className="bg-blue-50 text-blue-700 h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                {idx + 1}
                              </div>
                              <span>{sug}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Empty state wait placeholder */
                <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <BrainCircuit size={36} className="mb-3 text-slate-300" />
                  <h3 className="font-bold text-slate-700 text-sm">Awaiting AI Evaluation</h3>
                  <p className="text-xs text-slate-400 max-w-xs mt-1.5">
                    Select a candidate resume PDF and run the assessment model to generate candidate scoring breakdown, gaps analysis, and fit prediction.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
