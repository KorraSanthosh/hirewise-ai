export interface ParsedSkill {
  name: string;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  endorsements: number;
  durationMonths: number;
}

export interface ParsedCareerHistory {
  company: string;
  title: string;
  startDate?: string | null;
  endDate?: string | null;
  durationMonths: number;
  isCurrent: boolean;
  industry?: string | null;
  companySize?: string | null;
  description?: string | null;
}

export interface ParsedEducation {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear?: number | null;
  endYear?: number | null;
  grade?: string | null;
  tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | 'unknown';
}

export interface ParsedCandidateProfile {
  anonymizedName: string;
  headline?: string | null;
  summary?: string | null;
  location?: string | null;
  country?: string | null;
  yearsOfExperience: number;
  currentTitle?: string | null;
  currentCompany?: string | null;
  currentCompanySize?: string | null;
  currentIndustry?: string | null;
}

export interface ParsedCandidate {
  profile: ParsedCandidateProfile;
  careerHistory: ParsedCareerHistory[];
  education: ParsedEducation[];
  skills: ParsedSkill[];
}

export interface ParsedJob {
  title: string;
  company?: string | null;
  department?: string | null;
  rawDescription: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  experienceYears: number;
  educationLevel: string;
  seniority: string;
  domain: string;
  softSkills: string[];
  preferProductCompany: boolean;
  preferredDegrees: string[];
  preferredUniversities: string[];
}
