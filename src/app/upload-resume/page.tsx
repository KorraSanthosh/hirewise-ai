"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  UploadCloud, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Sparkles,
  ArrowRight,
  ChevronRight,
  Award,
  BookOpen,
  Briefcase
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
}

interface CareerHistory {
  id: string;
  company: string;
  title: string;
  durationMonths: number;
  isCurrent: boolean;
}

interface ParsedCandidate {
  id: string;
  candidateId: string;
  name: string;
  headline: string | null;
  location: string | null;
  yearsOfExperience: number;
  skills?: Skill[];
  education?: Education[];
  careerHistory?: CareerHistory[];
}

export default function UploadResumePage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "recruiter";
  const isCandidate = role === "candidate";

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  
  // Status states
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "parsing" | "success" | "error">("idle");
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [candidateData, setCandidateData] = useState<ParsedCandidate | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setErrorMessage(null);
    setCandidateData(null);
    setUploadStatus("idle");

    if (selectedFile.type !== "application/pdf" && !selectedFile.name.endsWith(".pdf")) {
      setErrorMessage("Only PDF files are supported. Please select a valid PDF resume.");
      setFile(null);
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      setErrorMessage("File size exceeds 10MB. Please upload a smaller resume.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploadStatus("uploading");
    setProgress(15);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Simulate network upload progress to 80%
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 80) {
            clearInterval(progressInterval);
            setUploadStatus("parsing"); // transition state
            return 80;
          }
          return prev + 15;
        });
      }, 300);

      const res = await fetch("/api/candidates/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to process resume");
      }

      const uploadResult = await res.json();
      setProgress(100);

      // Fetch the full candidate details (with skills, career, education)
      const detailsRes = await fetch(`/api/candidates/${uploadResult.data.id}`);
      if (!detailsRes.ok) {
        throw new Error("Resume parsed successfully, but failed to load profile details.");
      }
      
      const fullCandidate = await detailsRes.json();
      setCandidateData(fullCandidate);
      setUploadStatus("success");
    } catch (err: unknown) {
      const errorObj = err as Error | null | undefined;
      setErrorMessage(errorObj?.message || "An unexpected error occurred during processing.");
      setUploadStatus("error");
    }
  };

  const handleReset = () => {
    setFile(null);
    setUploadStatus("idle");
    setProgress(0);
    setErrorMessage(null);
    setCandidateData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <DashboardLayout>
      {/* Header section */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-800 flex items-center gap-3">
          <UploadCloud className="text-blue-600 h-10 w-10" />
          {isCandidate ? "Upload Resume" : "Import Candidate Resume"}
        </h1>
        <p className="text-slate-500 mt-2">
          {isCandidate 
            ? "Upload your resume in PDF format to build your AI profile and get matched with available jobs."
            : "Import candidate resumes collected from external sources for AI evaluation."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Upload column */}
        <div className={`col-span-1 lg:col-span-5 bg-white rounded-2xl p-6 border shadow-sm transition-all duration-300 ${dragActive ? "border-blue-500 bg-blue-50/20" : "border-slate-100"}`}>
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            {isCandidate ? "Resume Upload Pipeline" : "Candidate Import Pipeline"}
          </h2>

          {/* Drag & Drop Zone */}
          {uploadStatus !== "success" && (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition duration-150 min-h-[250px]
              ${dragActive ? "border-blue-500 bg-blue-50/40" : "border-slate-200 hover:border-blue-400 hover:bg-slate-50/50"}`}
              onClick={uploadStatus === "idle" ? handleBrowseClick : undefined}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploadStatus !== "idle"}
              />

              <UploadCloud size={48} className={`mb-4 transition duration-150 ${dragActive ? "text-blue-600 animate-bounce" : "text-slate-400"}`} />

              <p className="font-semibold text-slate-800 text-sm">
                {isCandidate ? "Drag & drop your resume here, or " : "Drag & drop candidate resume here, or "}<span className="text-blue-600 hover:underline">{isCandidate ? "select your resume" : "select candidate resume"}</span>
              </p>
              <p className="text-xs text-slate-400 mt-2">PDF files only (Max 10MB)</p>
            </div>
          )}

          {/* Selected File Display */}
          {file && uploadStatus !== "success" && (
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
              {uploadStatus === "idle" && (
                <button
                  onClick={handleReset}
                  className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-4 p-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl flex items-start gap-2.5">
              <XCircle className="h-5 w-5 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Actions / Progress */}
          {uploadStatus === "idle" && file && (
            <button
              onClick={handleUpload}
              className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-md shadow-blue-100 cursor-pointer"
            >
              {isCandidate ? "Process & Analyze Resume" : "Process & Analyze Candidate"}
            </button>
          )}

          {(uploadStatus === "uploading" || uploadStatus === "parsing") && (
            <div className="mt-6 space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-blue-600" />
                  {uploadStatus === "uploading" ? (isCandidate ? "Uploading PDF..." : "Importing PDF...") : "AI Parsing & Extracting Details..."}
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

          {/* Success Screen */}
          {uploadStatus === "success" && (
            <div className="mt-4 text-center p-6 border border-green-100 bg-green-50/10 rounded-2xl flex flex-col items-center">
              <CheckCircle size={48} className="text-green-600 mb-3" />
              <h3 className="text-lg font-bold text-slate-800">{isCandidate ? "Resume Uploaded Successfully" : "Import Complete!"}</h3>
              <p className="text-sm text-slate-500 mt-1.5">
                {isCandidate 
                  ? "Your resume was uploaded and successfully parsed by Gemini." 
                  : "Candidate was imported and successfully parsed by Gemini."}
              </p>
              
              <div className="flex gap-3 w-full mt-6">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl text-sm transition cursor-pointer"
                >
                  {isCandidate ? "Replace Resume" : "Import Another Candidate"}
                </button>
                <Link
                  href={`/candidates/${candidateData?.id || ''}`}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-md shadow-blue-100 cursor-pointer"
                >
                  Open My Profile
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Results column */}
        <div className="col-span-1 lg:col-span-7">
          {candidateData ? (
            /* Parsed Profile Display */
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest mb-1.5">
                  <Sparkles size={14} />
                  AI Generated Profile
                </div>
                <h2 className="text-3xl font-extrabold text-slate-800">{candidateData.name}</h2>
                {candidateData.headline && (
                  <p className="text-slate-500 text-lg font-medium mt-1">{candidateData.headline}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm text-slate-400 mt-3 font-medium">
                  {candidateData.location && (
                    <span>📍 {candidateData.location}</span>
                  )}
                  <span>💼 {candidateData.yearsOfExperience} Year{candidateData.yearsOfExperience === 1 ? "" : "s"} Experience</span>
                  <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider">{candidateData.candidateId}</span>
                </div>
              </div>

              {/* Skills Badge List */}
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Award size={16} className="text-blue-500" />
                  Skills Detected
                </h3>
                {candidateData.skills && candidateData.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {candidateData.skills.map((skill) => (
                      <div 
                        key={skill.id} 
                        className="bg-blue-50 text-blue-700 border border-blue-100/50 px-3 py-1 rounded-xl text-sm font-medium flex items-center gap-1.5"
                      >
                        {skill.name}
                        <span className="bg-blue-100/80 text-blue-800 text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md">
                          {skill.proficiency}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">No specific skills listed.</p>
                )}
              </div>

              {/* Career History List */}
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Briefcase size={16} className="text-blue-500" />
                  Experience Timeline
                </h3>
                {candidateData.careerHistory && candidateData.careerHistory.length > 0 ? (
                  <div className="space-y-4">
                    {candidateData.careerHistory.map((job) => (
                      <div key={job.id} className="flex gap-3">
                        <div className="mt-1 flex flex-col items-center">
                          <div className={`h-4 w-4 rounded-full border-2 ${job.isCurrent ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300"}`}></div>
                          <div className="w-0.5 bg-slate-100 flex-1 my-1"></div>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            {job.title}
                            {job.isCurrent && (
                              <span className="bg-green-100 text-green-700 text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md">Current</span>
                            )}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium">{job.company}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {job.durationMonths >= 12 
                              ? `${Math.floor(job.durationMonths / 12)} Yr${Math.floor(job.durationMonths / 12) === 1 ? "" : "s"} ${job.durationMonths % 12 > 0 ? `${job.durationMonths % 12} Mos` : ""}`
                              : `${job.durationMonths} Mos`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">No career history records detected.</p>
                )}
              </div>

              {/* Education Timeline */}
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <BookOpen size={16} className="text-blue-500" />
                  Education Credentials
                </h3>
                {candidateData.education && candidateData.education.length > 0 ? (
                  <div className="space-y-4">
                    {candidateData.education.map((edu) => (
                      <div key={edu.id} className="flex items-start gap-3">
                        <ChevronRight className="text-blue-500 h-5 w-5 shrink-0" />
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">
                            {edu.degree} in {edu.fieldOfStudy}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium">{edu.institution}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">No education records detected.</p>
                )}
              </div>
            </div>
          ) : (
            /* Placeholder Panel */
            <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <Sparkles size={36} className="mb-3 text-slate-300" />
              <h3 className="font-bold text-slate-700 text-sm">Waiting for Analysis</h3>
              <p className="text-xs text-slate-400 max-w-xs mt-1.5">
                {isCandidate 
                  ? "Once your resume PDF is uploaded, Gemini's AI pipeline will dissect it and display the structured profile metadata here."
                  : "Once a candidate resume PDF is imported, Gemini's AI pipeline will dissect it and display the structured profile metadata here."}
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
