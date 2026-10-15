export interface AnomalyResult {
  status: 'CLEAN' | 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
}

export class AnomalyService {
  /**
   * Classifies experience into professional vs non-professional.
   * Only professional experience should participate in anomaly calculations.
   */
  public static isProfessionalExperience(job: { company: string; title: string }): boolean {
    const titleLower = job.title.toLowerCase();
    const companyLower = job.company.toLowerCase();

    const nonProfessionalKeywords = [
      // Volunteer Work
      'volunteer', 'volunteering', 'ngo', 'foundation', 'charity', 'nonprofit', 'non-profit', 'social work',
      // Student Organization & Club & Campus Activity
      'student organization', 'student activities', 'student activity', 'campus activity', 'campus activities',
      'student club', 'club', 'society', 'campus ambassador', 'student lead', 'student representative',
      'campus leader', 'extracurricular', 'chapter lead', 'student chapter', 'university chapter',
      // Open Source
      'open source', 'open-source', 'summer of code', 'contributor',
      // Community Organizations
      'community organization', 'community service'
    ];

    // Check if title or company contains any non-professional indicators
    const isNonProfessional = nonProfessionalKeywords.some(keyword =>
      titleLower.includes(keyword) || companyLower.includes(keyword)
    );

    return !isNonProfessional;
  }

  /**
   * Deterministically validates a candidate profile for traps/honeypots.
   * Generates confidence levels based on chronological or mathematical impossibilities.
   */
  public static checkCandidate(candidate: {
    yearsOfExperience: number;
    skills: { name: string; proficiency: string; durationMonths: number }[];
    careerHistory: {
      company: string;
      title: string;
      startDate?: string | Date | null;
      endDate?: string | Date | null;
      durationMonths: number;
    }[];
    education: {
      institution: string;
      degree: string;
      startYear?: number | null;
      endYear?: number | null;
    }[];
    noticePeriodDays?: number;
    openToWork?: boolean;
    lastActiveDate?: string | Date | null;
    profileCompleteness?: number;
    connectionCount?: number;
  }): AnomalyResult {
    const reasons: string[] = [];
    let status: 'CLEAN' | 'LOW' | 'MEDIUM' | 'HIGH' = 'CLEAN';

    const yoeMonths = candidate.yearsOfExperience * 12;
    const now = new Date();

    // -------------------------------------------------------------
    // HIGH CONFIDENCE ANOMALIES (Mathematically/Chronologically Impossible)
    // -------------------------------------------------------------

    // 1. Single job duration exceeds total stated years of experience (Only Professional)
    for (let i = 0; i < candidate.careerHistory.length; i++) {
      const job = candidate.careerHistory[i];
      
      if (!AnomalyService.isProfessionalExperience(job)) {
        continue;
      }

      if (job.durationMonths > yoeMonths + 2) {
        status = 'HIGH';
        reasons.push(
          `Stated job duration at '${job.company}' (${job.durationMonths}m) exceeds total years of experience (${candidate.yearsOfExperience}y)`
        );
      }

      // 2. Job start date is after end date
      if (job.startDate && job.endDate) {
        const start = new Date(job.startDate);
        const end = new Date(job.endDate);
        if (start > end) {
          status = 'HIGH';
          reasons.push(
            `Logical Date Mismatch: Job at '${job.company}' start date (${start.toISOString().split('T')[0]}) occurs after end date (${end.toISOString().split('T')[0]})`
          );
        }
      }

      // 3. Job start date is in the future
      if (job.startDate) {
        const start = new Date(job.startDate);
        if (start > now) {
          status = 'HIGH';
          reasons.push(
            `Future Work History: Job at '${job.company}' start date is in the future (${start.toISOString().split('T')[0]})`
          );
        }
      }
    }

    // 4. Education start year is after end year
    for (let i = 0; i < candidate.education.length; i++) {
      const edu = candidate.education[i];
      if (edu.startYear && edu.endYear && edu.startYear > edu.endYear) {
        status = 'HIGH';
        reasons.push(
          `Logical Education Mismatch: Degree at '${edu.institution}' starts (${edu.startYear}) after it ends (${edu.endYear})`
        );
      }
    }

    // 5. Work started before university education by an impossible gap (6+ years)
    const workStartYears = candidate.careerHistory
      .filter((j) => AnomalyService.isProfessionalExperience(j))
      .map((j) => {
        if (!j.startDate) return null;
        const dt = new Date(j.startDate);
        return isNaN(dt.getTime()) ? null : dt.getFullYear();
      })
      .filter((y): y is number => y !== null);

    const eduStartYears = candidate.education
      .map((e) => e.startYear)
      .filter((y): y is number => typeof y === 'number' && y > 1900);

    if (workStartYears.length > 0 && eduStartYears.length > 0) {
      const earliestWork = Math.min(...workStartYears);
      const earliestEdu = Math.min(...eduStartYears);
      if (earliestEdu - earliestWork > 6) {
        status = 'HIGH';
        reasons.push(
          `Chronological Conflict: Stated work history started in ${earliestWork}, but university education didn't begin until ${earliestEdu}`
        );
      }
    }

    // Return immediately for high severity
    if (status === 'HIGH') {
      return { status, reasons };
    }

    // -------------------------------------------------------------
    // MEDIUM CONFIDENCE ANOMALIES (Suspicious but theoretically possible)
    // -------------------------------------------------------------

    // 1. Skill inflation with zero active experience
    const expertZeroDuration = candidate.skills.filter(
      (s) =>
        (s.proficiency.toLowerCase() === 'expert' || s.proficiency.toLowerCase() === 'advanced') &&
        s.durationMonths === 0
    );
    if (expertZeroDuration.length >= 5) {
      status = 'MEDIUM';
      reasons.push(
        `Skill Inflation Trap: Candidate lists ${expertZeroDuration.length} expert/advanced skills with 0 months of active usage`
      );
    }

    // 2. Long notice period but marked actively seeking work
    if (
      candidate.noticePeriodDays &&
      candidate.noticePeriodDays >= 120 &&
      candidate.openToWork
    ) {
      status = 'MEDIUM';
      reasons.push(
        `Availability Conflict: Candidate is marked 'Open to Work' but has a notice period of ${candidate.noticePeriodDays} days`
      );
    }

    // 3. Accumulated job duration exceeds total YOE
    const totalJobMonths = candidate.careerHistory
      .filter((j) => AnomalyService.isProfessionalExperience(j))
      .reduce((acc, j) => acc + j.durationMonths, 0);
    if (totalJobMonths > yoeMonths + 24) {
      status = 'MEDIUM';
      reasons.push(
        `Experience Cumulative Overlap: Cumulative job history durations (${totalJobMonths}m) significantly exceed stated YOE (${candidate.yearsOfExperience}y)`
      );
    }

    if (status === 'MEDIUM') {
      return { status, reasons };
    }

    // -------------------------------------------------------------
    // LOW CONFIDENCE ANOMALIES (Slight warnings / warnings)
    // -------------------------------------------------------------

    // 1. Profile incomplete
    if (candidate.profileCompleteness !== undefined && candidate.profileCompleteness < 50) {
      status = 'LOW';
      reasons.push(`Incomplete Profile: Stated completeness is under 50% (${candidate.profileCompleteness}%)`);
    }

    // 2. Profile inactive
    if (candidate.lastActiveDate) {
      const active = new Date(candidate.lastActiveDate);
      const diffTime = Math.abs(now.getTime() - active.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 180) {
        status = 'LOW';
        reasons.push(`Inactive Account: Stated last active date was ${diffDays} days ago`);
      }
    }

    // 3. Missing education history completely
    if (candidate.education.length === 0) {
      status = 'LOW';
      reasons.push('Missing Education: Profile lists no formal education history');
    }

    // 4. Zero connections on platform
    if (candidate.connectionCount !== undefined && candidate.connectionCount === 0) {
      status = 'LOW';
      reasons.push('Unconnected Profile: Profile has zero connections on the network');
    }

    return { status, reasons };
  }
}
