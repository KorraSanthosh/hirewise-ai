import * as fs from 'fs';
import * as path from 'path';
import { AnomalyService } from './anomaly.service';

export interface ScorerConfig {
  weights: {
    semantic: number;
    skills: number;
    experience: number;
    education: number;
    career_progression: number;
    availability: number;
  };
  anomaly_penalties: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    CLEAN: number;
  };
  consulting_filter: {
    companies: string[];
    penalty_multiplier: number;
  };
  experience_bands: {
    target_min: number;
    target_max: number;
    under_qualified_penalty_per_year: number;
    over_qualified_penalty_per_year: number;
  };
  education_scoring: {
    tier_1: number;
    tier_2: number;
    tier_3: number;
    tier_4: number;
    unknown: number;
    cs_major_boost: number;
    cs_majors: string[];
  };
  availability_rules: {
    notice_period_days: { limit: number; multiplier: number }[];
    last_active_days: { limit: number; multiplier: number }[];
    response_rates: { limit: number; multiplier: number }[];
  };
}

export interface CandidateScoringInput {
  yearsOfExperience: number;
  skills: { name: string; proficiency: string; durationMonths: number }[];
  careerHistory: {
    company: string;
    title: string;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    durationMonths: number;
    isCurrent: boolean;
  }[];
  education: {
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startYear?: number | null;
    endYear?: number | null;
    tier: string;
  }[];
  noticePeriodDays: number;
  openToWork: boolean;
  lastActiveDate?: string | Date | null;
  profileCompleteness: number;
  connectionCount: number;
  recruiterResponseRate: number; // 0.0 to 1.0
  embedding?: number[] | null;
}

export interface JobScoringInput {
  experienceYears: number;
  requiredSkills: string[];
  preferredSkills: string[];
  preferProductCompany: boolean;
  embedding?: number[] | null;
}

export interface ScoreBreakdown {
  overallScore: number;
  semanticSimilarity: number;
  skillMatchScore: number;
  experienceScore: number;
  educationScore: number;
  domainScore: number;
  careerProgressionScore: number;
  availabilityScore: number;
}

export class RankingService {
  private static defaultConfig: ScorerConfig = {
    weights: {
      semantic: 0.20,
      skills: 0.25,
      experience: 0.20,
      education: 0.10,
      career_progression: 0.15,
      availability: 0.10
    },
    anomaly_penalties: {
      HIGH: 0.0,
      MEDIUM: 0.70,
      LOW: 0.95,
      CLEAN: 1.0
    },
    consulting_filter: {
      companies: [
        'tcs', 'infosys', 'wipro', 'accenture', 'cognizant', 'capgemini',
        'tata consultancy services', 'mindtree', 'tech mahindra'
      ],
      penalty_multiplier: 0.50
    },
    experience_bands: {
      target_min: 5.0,
      target_max: 9.0,
      under_qualified_penalty_per_year: 15.0,
      over_qualified_penalty_per_year: 5.0
    },
    education_scoring: {
      tier_1: 100.0,
      tier_2: 80.0,
      tier_3: 60.0,
      tier_4: 40.0,
      unknown: 40.0,
      cs_major_boost: 20.0,
      cs_majors: [
        'computer science', 'data science', 'machine learning',
        'artificial intelligence', 'mathematics', 'statistics', 'information technology'
      ]
    },
    availability_rules: {
      notice_period_days: [
        { limit: 30, multiplier: 1.0 },
        { limit: 60, multiplier: 0.90 },
        { limit: 90, multiplier: 0.80 },
        { limit: 180, multiplier: 0.50 }
      ],
      last_active_days: [
        { limit: 30, multiplier: 1.0 },
        { limit: 90, multiplier: 0.90 },
        { limit: 180, multiplier: 0.75 },
        { limit: 9999, multiplier: 0.50 }
      ],
      response_rates: [
        { limit: 0.70, multiplier: 1.0 },
        { limit: 0.30, multiplier: 0.85 },
        { limit: 0.00, multiplier: 0.60 }
      ]
    }
  };

  /**
   * Loads configurations dynamically from scripts/config.json. Falls back to static defaults.
   */
  public static loadConfig(): ScorerConfig {
    try {
      const configPath = path.resolve(process.cwd(), 'scripts/config.json');
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(fileContent) as ScorerConfig;
      }
    } catch (e) {
      console.warn('Could not read scripts/config.json, using default weights config:', e);
    }
    return this.defaultConfig;
  }

  /**
   * Evaluates and computes the complete scoring breakdown for a candidate against a job description.
   */
  public static scoreCandidate(
    candidate: CandidateScoringInput,
    job: JobScoringInput,
    customWeights?: Partial<ScorerConfig['weights']>
  ): ScoreBreakdown {
    const config = this.loadConfig();
    const weights = { ...config.weights, ...customWeights };

    // 1. Semantic Similarity
    const semanticSimilarity = this.computeSemanticScore(candidate.embedding, job.embedding);

    // 2. Skill Match
    const skillMatchScore = this.computeSkillScore(candidate.skills, job.requiredSkills, job.preferredSkills);

    // 3. Experience & Seniority Band Fit
    const experienceScore = this.computeExperienceScore(candidate, job, config);

    // 4. Education Ranking
    const educationScore = this.computeEducationScore(candidate.education, config);

    // 5. Domain Alignment Score (Approx. industry/title keyword match)
    const domainScore = this.computeDomainScore(candidate, job);

    // 6. Career Progression & Stability
    const careerProgressionScore = this.computeCareerProgressionScore(candidate.careerHistory);

    // 7. Availability & Engagement Signals
    const availabilityScore = this.computeAvailabilityScore(candidate, config);

    // Calculate composite base score
    const baseScore =
      semanticSimilarity * weights.semantic +
      skillMatchScore * weights.skills +
      experienceScore * weights.experience +
      educationScore * weights.education +
      careerProgressionScore * weights.career_progression +
      availabilityScore * weights.availability;

    // To prevent false-positive anomalies for candidates (like students/freshers) who have internships/mentorships 
    // but are marked as 0 YOE, we derive a realistic minimum YOE from their professional career history.
    const professionalMonths = candidate.careerHistory
      .filter((j) => AnomalyService.isProfessionalExperience(j))
      .reduce((acc, j) => acc + j.durationMonths, 0);
    const adjustedYOE = Math.max(candidate.yearsOfExperience, professionalMonths / 12);

    // Apply anomaly engine penalty
    const anomalyResult = AnomalyService.checkCandidate({
      ...candidate,
      yearsOfExperience: adjustedYOE
    });
    const penalty = config.anomaly_penalties[anomalyResult.status] ?? 1.0;
    const overallScore = Math.min(1.0, Math.max(0.0, (baseScore * penalty) / 100.0));

    return {
      overallScore,
      semanticSimilarity,
      skillMatchScore,
      experienceScore,
      educationScore,
      domainScore,
      careerProgressionScore,
      availabilityScore,
    };
  }

  // --- Sub-scorer mathematical implementations ---

  private static computeSemanticScore(u?: number[] | null, v?: number[] | null): number {
    if (!u || !v || u.length === 0 || v.length === 0) return 0.0;

    let dot = 0.0;
    let normU = 0.0;
    let normV = 0.0;

    for (let i = 0; i < u.length; i++) {
      dot += u[i] * v[i];
      normU += u[i] * u[i];
      normV += v[i] * v[i];
    }

    if (normU === 0 || normV === 0) return 0.0;
    const similarity = dot / (Math.sqrt(normU) * Math.sqrt(normV));
    return Math.min(100.0, Math.max(0.0, similarity * 100.0));
  }

  private static computeSkillScore(
    candidateSkills: { name: string }[],
    requiredSkills: string[],
    preferredSkills: string[]
  ): number {
    const candSkillSet = new Set(candidateSkills.map((s) => s.name.toLowerCase().trim()));
    const reqList = requiredSkills.map((s) => s.toLowerCase().trim()).filter(Boolean);
    const prefList = preferredSkills.map((s) => s.toLowerCase().trim()).filter(Boolean);

    if (reqList.length === 0 && prefList.length === 0) return 100.0;

    let reqScore = 1.0;
    if (reqList.length > 0) {
      const matches = reqList.filter((s) => candSkillSet.has(s)).length;
      reqScore = matches / reqList.length;
    }

    let prefScore = 1.0;
    if (prefList.length > 0) {
      const matches = prefList.filter((s) => candSkillSet.has(s)).length;
      prefScore = matches / prefList.length;
    }

    // Blend: 80% required skills, 20% preferred skills
    return (reqScore * 0.80 + prefScore * 0.20) * 100.0;
  }

  private static computeExperienceScore(
    candidate: CandidateScoringInput,
    job: JobScoringInput,
    config: ScorerConfig
  ): number {
    const yoe = candidate.yearsOfExperience;
    let targetMin = config.experience_bands.target_min;
    let targetMax = config.experience_bands.target_max;

    if (job.experienceYears > 0) {
      targetMin = job.experienceYears;
      targetMax = targetMin + (config.experience_bands.target_max - config.experience_bands.target_min);
    }

    let score = 100.0;
    if (yoe < targetMin) {
      score -= (targetMin - yoe) * config.experience_bands.under_qualified_penalty_per_year;
    } else if (yoe > targetMax) {
      score -= (yoe - targetMax) * config.experience_bands.over_qualified_penalty_per_year;
    }

    score = Math.max(0.0, score);

    // Apply product company preference penalty for consulting-only backgrounds
    if (job.preferProductCompany) {
      const consultingFirms = config.consulting_filter.companies.map((c) => c.toLowerCase().trim());
      let hasConsulting = false;
      let hasProduct = false;

      for (const role of candidate.careerHistory) {
        const comp = role.company.toLowerCase().trim();
        const isConsulting = consultingFirms.some((firm) => comp.includes(firm));
        if (isConsulting) {
          hasConsulting = true;
        } else {
          hasProduct = true;
        }
      }

      if (hasConsulting && !hasProduct) {
        score *= config.consulting_filter.penalty_multiplier;
      }
    }

    return score;
  }

  private static computeEducationScore(
    education: CandidateScoringInput['education'],
    config: ScorerConfig
  ): number {
    if (!education || education.length === 0) return 40.0;

    const tierScores: Record<string, number> = {
      tier_1: config.education_scoring.tier_1,
      tier_2: config.education_scoring.tier_2,
      tier_3: config.education_scoring.tier_3,
      tier_4: config.education_scoring.tier_4,
      unknown: config.education_scoring.unknown,
    };

    const csMajors = config.education_scoring.cs_majors.map((m) => m.toLowerCase().trim());
    let bestScore = 0.0;

    for (const school of education) {
      const tier = school.tier.toLowerCase().trim();
      const baseScore = tierScores[tier] ?? tierScores.unknown;

      // Check field of study boost
      const field = school.fieldOfStudy.toLowerCase().trim();
      const hasBoost = csMajors.some((major) => field.includes(major));

      let schoolScore = baseScore;
      if (hasBoost) {
        schoolScore += config.education_scoring.cs_major_boost;
      }

      if (schoolScore > bestScore) {
        bestScore = schoolScore;
      }
    }

    return Math.min(100.0, bestScore);
  }

  private static computeDomainScore(candidate: CandidateScoringInput, job: JobScoringInput): number {
    // Simply check for keyword overlaps between candidate profile and Job Description fields (e.g. titles, domain matches)
    const matches: string[] = [];
    const searchTerms = [
      'ai', 'ml', 'nlp', 'data', 'cloud', 'search', 'vector', 'vision',
      'deep learning', 'found founding', 'product', 'saas'
    ];

    const descriptionLower = job.requiredSkills.join(' ').toLowerCase() + ' ' + job.preferredSkills.join(' ').toLowerCase();
    const historyText = candidate.careerHistory.map((j) => `${j.title} ${j.company}`).join(' ').toLowerCase();

    let score = 50.0; // Baseline domain alignment
    let matchesCount = 0;

    for (const term of searchTerms) {
      if (descriptionLower.includes(term) && historyText.includes(term)) {
        matchesCount++;
      }
    }

    score += matchesCount * 5.0;
    return Math.min(100.0, Math.max(0.0, score));
  }

  private static computeCareerProgressionScore(careerHistory: CandidateScoringInput['careerHistory']): number {
    if (!careerHistory || careerHistory.length === 0) return 50.0;

    // 1. Average Tenure Score (60% weight)
    const totalMonths = careerHistory.reduce((sum, job) => sum + job.durationMonths, 0);
    const avgTenure = totalMonths / careerHistory.length;

    let tenureScore = 100.0;
    if (avgTenure < 12.0) {
      tenureScore = 40.0;
    } else if (avgTenure < 24.0) {
      tenureScore = 70.0;
    } else if (avgTenure < 36.0) {
      tenureScore = 90.0;
    }

    // 2. Title Progression Score (40% weight)
    // Sort career history chronologically
    const sorted = [...careerHistory].sort((a, b) => {
      const aDate = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bDate = b.startDate ? new Date(b.startDate).getTime() : 0;
      return aDate - bDate;
    });

    const seniorityKeywords = ['lead', 'senior', 'head', 'architect', 'principal', 'manager', 'director'];
    let progressionCount = 0;
    let previousLevel = -1;

    for (const job of sorted) {
      const title = job.title.toLowerCase();
      let currentLevel = 0;

      for (let i = 0; i < seniorityKeywords.length; i++) {
        if (title.includes(seniorityKeywords[i])) {
          currentLevel = i + 1;
          break;
        }
      }

      if (currentLevel > previousLevel && previousLevel !== -1) {
        progressionCount++;
      }
      previousLevel = Math.max(previousLevel, currentLevel);
    }

    const progressionScore = Math.min(100.0, 50.0 + progressionCount * 25.0);

    return tenureScore * 0.60 + progressionScore * 0.40;
  }

  private static computeAvailabilityScore(candidate: CandidateScoringInput, config: ScorerConfig): number {
    const rules = config.availability_rules;

    // 1. Notice Period Decay
    const notice = candidate.noticePeriodDays;
    let noticeMult = 0.50;
    for (const rule of rules.notice_period_days) {
      if (notice <= rule.limit) {
        noticeMult = rule.multiplier;
        break;
      }
    }

    // 2. Last Active Decay
    let daysInactive = 365;
    if (candidate.lastActiveDate) {
      const lastActive = new Date(candidate.lastActiveDate);
      const diffTime = Math.abs(new Date().getTime() - lastActive.getTime());
      daysInactive = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else if (candidate.openToWork) {
      daysInactive = 15; // Assume active if open to work is set but date is missing
    }

    let activeMult = 0.50;
    for (const rule of rules.last_active_days) {
      if (daysInactive <= rule.limit) {
        activeMult = rule.multiplier;
        break;
      }
    }

    // 3. Response Rate Decay
    const responseRate = candidate.recruiterResponseRate;
    let responseMult = 0.60;
    for (const rule of rules.response_rates) {
      if (responseRate >= rule.limit) {
        responseMult = rule.multiplier;
        break;
      }
    }

    return noticeMult * activeMult * responseMult * 100.0;
  }
}
