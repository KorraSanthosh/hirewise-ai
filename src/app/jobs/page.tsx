"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { 
  BriefcaseBusiness, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2, 
  AlertTriangle,
  FolderOpen,
  UserCheck,
  Eye,
  CheckCircle2
} from "lucide-react";

interface Job {
  id: string;
  title: string;
  company: string | null;
  department: string | null;
  rawDescription: string;
  experienceYears: number;
  educationLevel: string;
  seniority: string;
  domain: string;
  createdAt: string;
}

function JobsPageContent() {
  const { data: session } = useSession();
  const isCandidate = (session?.user as any)?.role === "candidate";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("search") || "";

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());

  // Candidate status
  const [candidateProfile, setCandidateProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);

  const hasResume = isCandidate
    ? !!(candidateProfile && candidateProfile.rawResumeText && candidateProfile.rawResumeText.trim() !== "")
    : false;

  // Form fields
  const [formTitle, setFormTitle] = useState<string>("");
  const [formCompany, setFormCompany] = useState<string>("");
  const [formDepartment, setFormDepartment] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formExperience, setFormExperience] = useState<number>(0);
  const [formEducation, setFormEducation] = useState<string>("Bachelor's");
  const [formSeniority, setFormSeniority] = useState<string>("Mid");
  const [formDomain, setFormDomain] = useState<string>("Engineering");

  useEffect(() => {
    fetchJobs();
    if (isCandidate) {
      fetchMatches();
      fetchCandidateProfile();
    } else {
      setProfileLoading(false);
    }
  }, [session, isCandidate]);

  const fetchCandidateProfile = async () => {
    if (!session?.user?.id) return;
    try {
      setProfileLoading(true);
      const res = await fetch(`/api/candidates/${session.user.id}`);
      if (res.ok) {
        const data = await res.json();
        setCandidateProfile(data);
      } else {
        setCandidateProfile(null);
      }
    } catch (err) {
      console.error("Failed to fetch candidate profile:", err);
      setCandidateProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchMatches = async () => {
    try {
      const res = await fetch("/api/matches");
      if (res.ok) {
        const data = await res.json();
        const applied = new Set<string>(data.map((m: any) => m.jobId));
        setAppliedJobIds(applied);
      }
    } catch (err) {
      console.error("Failed to fetch matches:", err);
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) {
        throw new Error("Failed to fetch jobs");
      }
      const data = await res.json();
      setJobs(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setSelectedJob(null);
    setFormTitle("");
    setFormCompany("");
    setFormDepartment("");
    setFormDescription("");
    setFormExperience(0);
    setFormEducation("Bachelor's");
    setFormSeniority("Mid");
    setFormDomain("Engineering");
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (job: Job) => {
    setSelectedJob(job);
    setFormTitle(job.title || "");
    setFormCompany(job.company || "");
    setFormDepartment(job.department || "");
    setFormDescription(job.rawDescription || "");
    setFormExperience(job.experienceYears || 0);
    setFormEducation(job.educationLevel || "Bachelor's");
    setFormSeniority(job.seniority || "Mid");
    setFormDomain(job.domain || "Engineering");
    setIsFormModalOpen(true);
  };

  const handleOpenDeleteModal = (job: Job) => {
    setSelectedJob(job);
    setIsDeleteModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescription || formDescription.length < 20) {
      alert("Job description must be at least 20 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = selectedJob ? `/api/jobs/${selectedJob.id}` : "/api/jobs";
      const method = selectedJob ? "PUT" : "POST";
      const payload = {
        title: formTitle,
        company: formCompany,
        department: formDepartment,
        rawDescription: formDescription,
        experienceYears: Number(formExperience),
        educationLevel: formEducation,
        seniority: formSeniority,
        domain: formDomain,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Operation failed");
      }

      await fetchJobs();
      setIsFormModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApply = async (jobId: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to apply");
      }

      setAppliedJobIds((prev) => {
        const updated = new Set(prev);
        updated.add(jobId);
        return updated;
      });
      alert("Applied successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to apply for job.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetailsModal = (job: Job) => {
    setSelectedJob(job);
    setIsDetailsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedJob) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${selectedJob.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete job");
      }
      await fetchJobs();
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to delete job.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredJobs = jobs.filter(
    (job) =>
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.company && job.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DashboardLayout>
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-800 flex items-center gap-3">
            <BriefcaseBusiness className="text-blue-600 h-10 w-10" />
            {isCandidate ? "Available Jobs" : "Job Management"}
          </h1>
          <p className="text-slate-500 mt-2">
            {isCandidate 
              ? "Browse jobs, search & filter active listings, and apply with your profile."
              : "View, upload, edit, and manage active job listings."}
          </p>
        </div>
        {!isCandidate && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition duration-150 shadow-md shadow-blue-100 cursor-pointer"
          >
            <Plus size={20} />
            Create New Job
          </button>
        )}
      </div>

      {isCandidate && !hasResume && !profileLoading && (
        <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-600 shrink-0" size={24} />
            <div>
              <h4 className="font-extrabold text-amber-900">Resume Upload Required</h4>
              <p className="text-xs text-amber-700 mt-1 font-medium">Please upload your resume to activate AI skill extraction, semantic matching, and to apply for active job listings.</p>
            </div>
          </div>
          <Link href="/upload-resume" className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition shrink-0 shadow-sm">
            Upload Now
          </Link>
        </div>
      )}

      {/* Search experience is handled via Global Navbar Search */}

      {/* Main Jobs Content */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
        {loading ? (
          /* Table Skeleton Loader */
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-slate-100 rounded w-1/4 mb-6"></div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4 py-4 border-b border-slate-100">
                  <div className="h-5 bg-slate-100 rounded w-1/4"></div>
                  <div className="h-5 bg-slate-100 rounded w-1/6"></div>
                  <div className="h-5 bg-slate-100 rounded w-1/6"></div>
                  <div className="h-5 bg-slate-100 rounded w-1/12"></div>
                  <div className="h-5 bg-slate-100 rounded w-1/12"></div>
                  <div className="h-5 bg-slate-100 rounded w-1/6 ml-auto"></div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          /* Error State */
          <div className="p-8 text-center text-red-500 font-medium flex flex-col items-center justify-center gap-2">
            <AlertTriangle className="h-10 w-10 text-red-500 mb-2" />
            <p>{error}</p>
            <button
              onClick={fetchJobs}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm transition"
            >
              Retry
            </button>
          </div>
        ) : filteredJobs.length === 0 ? (
          /* Empty State */
          <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center">
            <div className="p-4 bg-slate-50 rounded-full text-slate-400 mb-4 border border-slate-100">
              <FolderOpen size={48} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">No jobs found</h3>
            <p className="text-sm text-slate-400 max-w-sm mt-2">
              {searchQuery 
                ? "No jobs match your search queries. Try adjusting your keyword filter."
                : (isCandidate ? "There are currently no active job listings available." : "Get started by creating your very first job description parsing pipeline.")}
            </p>
            {!searchQuery && !isCandidate && (
              <button
                onClick={handleOpenCreateModal}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
              >
                <Plus size={18} />
                Create New Job
              </button>
            )}
          </div>
        ) : (
          /* Table Render */
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left border-b border-slate-100 text-slate-500 text-sm font-semibold">
                  <th className="py-4 px-6">Job Title</th>
                  <th className="py-4 px-6">Company</th>
                  <th className="py-4 px-6">Department</th>
                  <th className="py-4 px-6">Experience</th>
                  <th className="py-4 px-6">Education</th>
                  <th className="py-4 px-6">Created Date</th>
                  <th className="py-4 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50 transition duration-150">
                    <td className="py-4 px-6 font-semibold text-slate-800">{job.title}</td>
                    <td className="py-4 px-6 text-slate-600">{job.company || <span className="text-slate-400">-</span>}</td>
                    <td className="py-4 px-6 text-slate-600">{job.department || <span className="text-slate-400">-</span>}</td>
                    <td className="py-4 px-6 text-slate-600">{job.experienceYears} Year{job.experienceYears === 1 ? "" : "s"}</td>
                    <td className="py-4 px-6 text-slate-600">{job.educationLevel}</td>
                    <td className="py-4 px-6 text-slate-500 text-sm">
                      {new Date(job.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {isCandidate ? (
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleOpenDetailsModal(job)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition duration-150 text-xs font-bold uppercase tracking-wider cursor-pointer"
                            title="View Details"
                          >
                            <Eye size={14} />
                            Details
                          </button>
                          {appliedJobIds.has(job.id) ? (
                            <span className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200/50 rounded-lg text-xs font-bold uppercase tracking-wider">
                              <CheckCircle2 size={14} />
                              Applied
                            </span>
                          ) : (
                            <button
                              onClick={() => handleApply(job.id)}
                              disabled={isSubmitting || profileLoading || !hasResume}
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-lg transition duration-150 text-xs font-bold uppercase tracking-wider cursor-pointer"
                              title={hasResume ? "Apply to Job" : "Please upload your resume to apply"}
                            >
                              Apply
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-3">
                          <Link
                            href={`/jobs/${job.id}/evaluate`}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 rounded-lg transition duration-150 text-xs font-bold uppercase tracking-wider cursor-pointer"
                            title="Evaluate Candidates"
                          >
                            <UserCheck size={14} />
                            Evaluate
                          </Link>
                          <button
                            onClick={() => handleOpenEditModal(job)}
                            className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition duration-150 cursor-pointer"
                            title="Edit Job"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(job)}
                            className="p-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition duration-150 cursor-pointer"
                            title="Delete Job"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE/EDIT JOB MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800">
                {selectedJob ? "Edit Job Description" : "Create New Job Description"}
              </h2>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Job Title</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Company</label>
                  <input
                    type="text"
                    required
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    placeholder="e.g. Acme Corporation"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Department</label>
                  <input
                    type="text"
                    required
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder="e.g. Engineering"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Domain</label>
                  <input
                    type="text"
                    required
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value)}
                    placeholder="e.g. Software Development"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Job Description</label>
                <textarea
                  required
                  rows={6}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Paste the full job description here (minimum 20 characters)..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 text-sm font-medium leading-relaxed"
                ></textarea>
                <p className="text-xs text-slate-400 mt-1.5">
                  AI will parse this description to extract required skills, preferred qualifications, and generate semantic embeddings.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Experience Required (Years)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formExperience}
                    onChange={(e) => setFormExperience(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Education Level</label>
                  <select
                    value={formEducation}
                    onChange={(e) => setFormEducation(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 text-sm font-medium bg-white"
                  >
                    <option value="Any">Any</option>
                    <option value="Bachelor's">Bachelor's Degree</option>
                    <option value="Master's">Master's Degree</option>
                    <option value="PhD">PhD / Doctorate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Seniority</label>
                  <select
                    value={formSeniority}
                    onChange={(e) => setFormSeniority(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 text-sm font-medium bg-white"
                  >
                    <option value="Any">Any</option>
                    <option value="Entry">Entry Level</option>
                    <option value="Mid">Mid Level</option>
                    <option value="Senior">Senior Level</option>
                    <option value="Lead">Lead / Staff</option>
                    <option value="Executive">Executive / Director</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition cursor-pointer shadow-md shadow-blue-100"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {selectedJob 
                    ? (isSubmitting ? "Updating..." : "Update Job") 
                    : (isSubmitting ? "Analyzing & Creating..." : "Analyze & Create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-2 bg-red-50 rounded-full border border-red-100">
                <AlertTriangle size={24} />
              </div>
              <h2 className="text-xl font-bold">Delete Job Description?</h2>
            </div>
            
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Are you sure you want to delete <span className="font-semibold text-slate-800">"{selectedJob?.title}"</span>? 
              This action will remove the job description and all candidate match records associated with this job. This cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold rounded-xl transition cursor-pointer"
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isSubmitting ? "Deleting..." : "Delete Job"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JOB DETAILS MODAL */}
      {isDetailsModalOpen && selectedJob && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="bg-blue-100 text-blue-700 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider">
                  {selectedJob.company || "Unknown Company"}
                </span>
                <h2 className="text-2xl font-bold text-slate-800 mt-2">
                  {selectedJob.title}
                </h2>
              </div>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Structured Metadata Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Department</span>
                  <span className="text-sm font-bold text-slate-700 mt-1 block">{selectedJob.department || "-"}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Domain</span>
                  <span className="text-sm font-bold text-slate-700 mt-1 block">{selectedJob.domain || "-"}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Experience</span>
                  <span className="text-sm font-bold text-slate-700 mt-1 block">
                    {selectedJob.experienceYears} Year{selectedJob.experienceYears === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Education</span>
                  <span className="text-sm font-bold text-slate-700 mt-1 block">{selectedJob.educationLevel}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Seniority</span>
                  <span className="text-sm font-bold text-slate-700 mt-1 block">{selectedJob.seniority}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Posted On</span>
                  <span className="text-sm font-bold text-slate-700 mt-1 block">
                    {new Date(selectedJob.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>

              {/* Job Description */}
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Job Description</h3>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 text-sm leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto">
                  {selectedJob.rawDescription}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition cursor-pointer"
              >
                Close
              </button>
              {appliedJobIds.has(selectedJob.id) ? (
                <span className="flex items-center gap-1.5 px-6 py-2.5 bg-green-50 text-green-700 border border-green-200/50 rounded-xl text-sm font-bold uppercase tracking-wider">
                  <CheckCircle2 size={16} />
                  Applied
                </span>
              ) : (
                <button
                  onClick={() => {
                    handleApply(selectedJob.id);
                    setIsDetailsModalOpen(false);
                  }}
                  disabled={isSubmitting || profileLoading || !hasResume}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition cursor-pointer shadow-md"
                  title={hasResume ? "Apply Now" : "Please upload your resume to apply"}
                >
                  Apply Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center p-16 text-slate-500 min-h-[500px]">
        <Loader2 size={36} className="animate-spin text-blue-600 mb-4" />
        <p className="font-semibold text-lg">Loading Jobs...</p>
      </div>
    }>
      <JobsPageContent />
    </Suspense>
  );
}
