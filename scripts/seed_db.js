const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// Helper to parse dates safely
function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// --- Self-contained JS Scoring and Anomaly Logic ---

class AnomalyDetector {
  static checkCandidate(candidate) {
    const reasons = [];
    let status = "CLEAN";
    const now = new Date();

    const profile = candidate.profile || {};
    const yoe = parseFloat(profile.years_of_experience || 0.0);
    const yoe_months = yoe * 12;

    const career = candidate.career_history || [];
    const education = candidate.education || [];
    const skills = candidate.skills || [];
    const signals = candidate.redrob_signals || {};

    // HIGH CONFIDENCE ANOMALIES
    for (const job of career) {
      const dur = parseInt(job.duration_months || 0);
      const company = job.company || "Unknown";
      if (dur > yoe_months + 2) {
        status = "HIGH";
        reasons.push(`Job duration at '${company}' (${dur}m) exceeds total stated experience (${yoe}y).`);
      }

      const start_str = job.start_date;
      const end_str = job.end_date;
      if (start_str && end_str) {
        try {
          const start_dt = new Date(start_str);
          const end_dt = new Date(end_str);
          if (start_dt > end_dt) {
            status = "HIGH";
            reasons.push(`Logical date mismatch: Job at '${company}' starts (${start_str}) after it ends (${end_str}).`);
          }
        } catch (e) {}
      }

      if (start_str) {
        try {
          const start_dt = new Date(start_str);
          if (start_dt > now) {
            status = "HIGH";
            reasons.push(`Future history mismatch: Job at '${company}' starts in the future (${start_str}).`);
          }
        } catch (e) {}
      }
    }

    for (const edu of education) {
      const sy = edu.start_year;
      const ey = edu.end_year;
      const inst = edu.institution || "Unknown";
      if (sy && ey && parseInt(sy) > parseInt(ey)) {
        status = "HIGH";
        reasons.push(`Logical education mismatch: Studies at '${inst}' start (${sy}) after they end (${ey}).`);
      }
    }

    const work_start_years = [];
    for (const job of career) {
      const sd = job.start_date;
      if (sd) {
        try {
          work_start_years.push(new Date(sd).getFullYear());
        } catch (e) {}
      }
    }

    const edu_start_years = education
      .map(edu => parseInt(edu.start_year))
      .filter(yr => !isNaN(yr));

    if (work_start_years.length > 0 && edu_start_years.length > 0) {
      const earliest_work = Math.min(...work_start_years);
      const earliest_edu = Math.min(...edu_start_years);
      if (earliest_edu - earliest_work > 6) {
        status = "HIGH";
        reasons.push(`Chronological conflict: Work history started in ${earliest_work}, but university began in ${earliest_edu}.`);
      }
    }

    if (status === "HIGH") {
      return { status, reasons };
    }

    // MEDIUM CONFIDENCE ANOMALIES
    const expert_zero_dur = skills.filter(
      s => ["expert", "advanced"].includes((s.proficiency || "").toLowerCase().trim()) &&
      parseInt(s.duration_months || 0) === 0
    );
    if (expert_zero_dur.length >= 5) {
      status = "MEDIUM";
      reasons.push(`Skill inflation: Lists ${expert_zero_dur.length} expert/advanced skills with 0 months of active usage.`);
    }

    const notice_period = parseInt(signals.notice_period_days || 0);
    const open_to_work = !!signals.open_to_work_flag;
    if (notice_period >= 120 && open_to_work) {
      status = "MEDIUM";
      reasons.push(`Availability conflict: Candidate marked 'Open to Work' but has a notice period of {notice_period} days.`);
    }

    const total_job_months = career.reduce((sum, job) => sum + parseInt(job.duration_months || 0), 0);
    if (total_job_months > yoe_months + 24) {
      status = "MEDIUM";
      reasons.push(`Experience overlap: Cumulative job durations (${total_job_months}m) exceed stated YOE (${yoe}y).`);
    }

    if (status === "MEDIUM") {
      return { status, reasons };
    }

    // LOW CONFIDENCE ANOMALIES
    const completeness = parseFloat(signals.profile_completeness_score || 100.0);
    if (completeness < 50.0) {
      status = "LOW";
      reasons.push(`Incomplete profile: Completeness is under 50% (${completeness}%).`);
    }

    const last_active = signals.last_active_date;
    if (last_active) {
      try {
        const active_dt = new Date(last_active);
        const diff_days = Math.floor((now - active_dt) / (1000 * 60 * 60 * 24));
        if (diff_days > 180) {
          status = "LOW";
          reasons.push(`Inactive account: Stated last active date was ${diff_days} days ago.`);
        }
      } catch (e) {}
    }

    if (education.length === 0) {
      status = "LOW";
      reasons.push("Missing education: Profile has no formal education records.");
    }

    const connections = parseInt(signals.connection_count || 1);
    if (connections === 0) {
      status = "LOW";
      reasons.push("Unconnected profile: Candidate has 0 platform connections.");
    }

    return { status, reasons };
  }
}

function compute_skills_score(candidate) {
  const cand_skills = new Set((candidate.skills || []).map(s => (s.name || "").toLowerCase().trim()).filter(Boolean));
  
  const req_skills = ["embeddings", "vector databases", "python", "evaluation frameworks", "ndcg", "mrr", "map", "semantic search", "retrieval"];
  const pref_skills = ["fine-tuning", "lora", "qlora", "learning-to-rank", "distributed systems"];

  const req_matches = req_skills.filter(s => cand_skills.has(s)).length;
  const req_score = req_matches / req_skills.length;

  const pref_matches = pref_skills.filter(s => cand_skills.has(s)).length;
  const pref_score = pref_matches / pref_skills.length;

  const final_score = (req_score * 0.80 + pref_score * 0.20) * 100.0;
  return Math.min(100.0, Math.max(0.0, final_score));
}

function compute_experience_score(candidate) {
  const profile = candidate.profile || {};
  const yoe = parseFloat(profile.years_of_experience || 0.0);
  
  const target_min = 5.0;
  const target_max = 9.0;
  const under_penalty = 15.0;
  const over_penalty = 5.0;

  let score = 100.0;
  if (yoe < target_min) {
    score -= (target_min - yoe) * under_penalty;
  } else if (yoe > target_max) {
    score -= (yoe - target_max) * over_penalty;
  }

  score = Math.max(0.0, score);

  const consulting_firms = ["tcs", "infosys", "wipro", "accenture", "cognizant", "capgemini", "tata consultancy services", "mindtree", "tech mahindra"];
  const career = candidate.career_history || [];
  
  let has_consulting = false;
  let has_product = false;
  
  for (const job of career) {
    const comp = (job.company || "").toLowerCase().trim();
    let is_consulting = false;
    for (const firm of consulting_firms) {
      if (comp.includes(firm)) {
        is_consulting = true;
        break;
      }
    }
    if (is_consulting) {
      has_consulting = true;
    } else {
      has_product = true;
    }
  }

  if (has_consulting && !has_product) {
    score *= 0.50;
  }

  return Math.min(100.0, Math.max(0.0, score));
}

function compute_education_score(candidate) {
  const edu_list = candidate.education || [];
  if (edu_list.length === 0) {
    return 40.0;
  }

  const tier_scores = {
    "tier_1": 100.0,
    "tier_2": 80.0,
    "tier_3": 60.0,
    "tier_4": 40.0,
    "unknown": 40.0
  };
  
  const cs_majors = ["computer science", "data science", "machine learning", "artificial intelligence", "mathematics", "statistics", "information technology"];
  let best_score = 0.0;

  for (const school of edu_list) {
    const tier = (school.tier || "unknown").toLowerCase().trim();
    const base_score = tier_scores[tier] || tier_scores["unknown"];

    const field = (school.field_of_study || "").toLowerCase().trim();
    let has_boost = false;
    for (const major of cs_majors) {
      if (field.includes(major)) {
        has_boost = true;
        break;
      }
    }
    
    let school_score = base_score;
    if (has_boost) {
      school_score += 20.0;
    }
    
    if (school_score > best_score) {
      best_score = school_score;
    }
  }

  return Math.min(100.0, Math.max(0.0, best_score));
}

function compute_domain_score(candidate) {
  const search_terms = ['ai', 'ml', 'nlp', 'data', 'cloud', 'search', 'vector', 'vision', 'deep learning', 'found founding', 'product', 'saas'];
  
  const history_text = (candidate.career_history || []).map(job => `${job.title || ''} ${job.company || ''} ${job.description || ''}`).join(" ").toLowerCase();
  const profile_text = `${candidate.profile?.headline || ''} ${candidate.profile?.summary || ''}`.toLowerCase();
  const combined_text = history_text + " " + profile_text;
  
  let score = 50.0;
  let matches_count = 0;
  for (const term of search_terms) {
    if (combined_text.includes(term)) {
      matches_count += 1;
    }
  }
  
  score += matches_count * 5.0;
  return Math.min(100.0, Math.max(0.0, score));
}

function compute_career_progression_score(candidate) {
  const career = candidate.career_history || [];
  if (career.length === 0) {
    return 50.0;
  }

  const total_months = career.reduce((sum, j) => sum + parseInt(j.duration_months || 0), 0);
  const avg_tenure_months = total_months / career.length;

  let tenure_score = 100.0;
  if (avg_tenure_months < 12.0) {
    tenure_score = 40.0;
  } else if (avg_tenure_months < 24.0) {
    tenure_score = 70.0;
  } else if (avg_tenure_months < 36.0) {
    tenure_score = 90.0;
  }

  const seniority_keywords = ["lead", "senior", "head", "architect", "principal", "manager", "director"];
  let progression_count = 0;
  
  const sorted_career = [...career].sort((a, b) => (a.start_date || "1970-01-01").localeCompare(b.start_date || "1970-01-01"));
  
  let previous_level = -1;
  for (const job of sorted_career) {
    const title = (job.title || "").toLowerCase();
    let current_level = 0;
    for (let i = 0; i < seniority_keywords.length; i++) {
      if (title.includes(seniority_keywords[i])) {
        current_level = i + 1;
        break;
      }
    }
    
    if (current_level > previous_level && previous_level !== -1) {
      progression_count += 1;
    }
    previous_level = Math.max(previous_level, current_level);
  }

  let progression_score = 50.0 + (progression_count * 25.0);
  progression_score = Math.min(100.0, progression_score);

  const final_score = (tenure_score * 0.60) + (progression_score * 0.40);
  return Math.min(100.0, Math.max(0.0, final_score));
}

function compute_availability_score(candidate) {
  const signals = candidate.redrob_signals || {};
  
  // Notice Period
  const notice = parseInt(signals.notice_period_days || 0);
  let notice_mult = 0.50;
  const np_rules = [
    { limit: 30, multiplier: 1.0 },
    { limit: 60, multiplier: 0.90 },
    { limit: 90, multiplier: 0.80 },
    { limit: 180, multiplier: 0.50 }
  ];
  for (const rule of np_rules) {
    if (notice <= rule.limit) {
      notice_mult = rule.multiplier;
      break;
    }
  }

  // Last Active
  const active_str = signals.last_active_date;
  let days_inactive = 365;
  const now = new Date();
  if (active_str) {
    try {
      const active_dt = new Date(active_str);
      days_inactive = Math.floor((now - active_dt) / (1000 * 60 * 60 * 24));
    } catch (e) {}
  } else if (signals.open_to_work_flag) {
    days_inactive = 15;
  }

  let active_mult = 0.50;
  const la_rules = [
    { limit: 30, multiplier: 1.0 },
    { limit: 90, multiplier: 0.90 },
    { limit: 180, multiplier: 0.75 },
    { limit: 9999, multiplier: 0.50 }
  ];
  for (const rule of la_rules) {
    if (days_inactive <= rule.limit) {
      active_mult = rule.multiplier;
      break;
    }
  }

  // Response Rate
  const resp_rate = parseFloat(signals.recruiter_response_rate || 0.0);
  let resp_mult = 0.60;
  const rr_rules = [
    { limit: 0.70, multiplier: 1.0 },
    { limit: 0.30, multiplier: 0.85 },
    { limit: 0.00, multiplier: 0.60 }
  ];
  for (const rule of rr_rules) {
    if (resp_rate >= rule.limit) {
      resp_mult = rule.multiplier;
      break;
    }
  }

  const availability_pct = notice_mult * active_mult * resp_mult;
  return Math.min(100.0, Math.max(0.0, availability_pct * 100.0));
}

function compute_smart_semantic_score(candidate) {
  const profile = candidate.profile || {};
  const headline = profile.headline || "";
  const summary = profile.summary || "";
  const skills = (candidate.skills || []).map(s => s.name || "").filter(Boolean);
  const skills_text = skills.join(" ");
  
  const career = candidate.career_history || [];
  const roles_text = career.map(job => `${job.title || ''} ${job.description || ''}`).join(" ");
  
  const combined_text = (headline + " " + summary + " " + skills_text + " " + roles_text).toLowerCase();
  
  const concepts = [
    ["embeddings", "vector search", "semantic search", "rag", "retrieval-augmented generation", "sentence-transformers", "dense retrieval", "sparse retrieval"],
    ["pinecone", "weaviate", "qdrant", "milvus", "faiss", "chromadb", "opensearch", "elasticsearch"],
    ["fine-tuning", "lora", "qlora", "peft", "llm", "large language model", "transformers", "huggingface"],
    ["ranking", "ndcg", "mrr", "map", "evaluation framework", "learning-to-rank", "ab test", "re-ranking"],
    ["nlp", "natural language", "machine learning", "deep learning", "recommendation system", "classification", "clustering"]
  ];
  
  let score = 40.0;
  
  let matches = 0;
  for (const concept_list of concepts) {
    if (concept_list.some(term => combined_text.includes(term))) {
      matches += 1;
    }
  }
  
  score += matches * 12.0;
  
  const current_title = (profile.current_title || "").toLowerCase();
  const non_tech_keywords = [
    "marketing", "hr", "recruiter", "accountant", "sales", "graphic designer", 
    "civil", "mechanical", "chemical", "operations", "support", "content writer", 
    "writer", "designer", "human resources", "admin", "executive"
  ];
  
  let is_non_tech = false;
  for (const kw of non_tech_keywords) {
    if (current_title.includes(kw)) {
      is_non_tech = true;
      break;
    }
  }
  
  if (is_non_tech) {
    score *= 0.10;
  }
  
  return Math.min(100.0, Math.max(0.0, score));
}

function generate_reasoning(cand, sub_scores, anomaly_status, reasons) {
  const profile = cand.profile || {};
  const title = profile.current_title || "Engineer";
  const yoe = profile.years_of_experience || 0.0;
  
  if (anomaly_status === "HIGH") {
    const reason = reasons[0] || "Impossible chronological profile timeline";
    return `Disqualified: ${reason}.`;
  }

  const highlights = [];
  if (sub_scores.skills >= 80.0) {
    highlights.push("excellent match in core skills");
  }
  if (sub_scores.experience >= 90.0) {
    highlights.push(`${yoe} years relevant experience`);
  }
  if (sub_scores.semantic >= 70.0) {
    highlights.push("high semantic alignment to AI Engineering");
  }
  
  const highlight_str = highlights.length > 0 ? highlights.join(", with ") : "suitable background";
  
  const warnings = [];
  if (["MEDIUM", "LOW"].includes(anomaly_status)) {
    warnings.push("profile anomaly warning flags");
  }
  const notice = parseInt(cand.redrob_signals?.notice_period_days || 0);
  if (notice >= 90) {
    warnings.push(`${notice} days notice`);
  }
    
  const warning_str = warnings.length > 0 ? ` (Note: ${warnings.join(", ")})` : "";
  
  return `${title} with ${yoe} YOE; demonstrates ${highlight_str}${warning_str}.`;
}

// --- 2. Main Processing & Seeding ---

async function main() {
  console.log("Starting database seeding...");

  const email = "recruiter@hirewise.ai";
  const passwordHash = await bcrypt.hash("password123", 10);
  
  console.log(`Checking if user ${email} exists...`);
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: "Acme Recruiter",
        role: "recruiter",
      },
    });
    console.log("Default recruiter user created successfully.");
  } else {
    console.log("Recruiter user already exists.");
  }

  const jdPath = path.join(__dirname, "../data_texts/job_description.txt");
  let rawDescription = "Senior AI Engineer role to build core ranking and retrieval systems from scratch.";
  try {
    if (fs.existsSync(jdPath)) {
      rawDescription = fs.readFileSync(jdPath, "utf-8");
    }
  } catch (e) {
    console.warn("Could not read job description file, using fallback description.", e);
  }

  const jobTitle = "Senior AI Engineer — Founding Team";
  console.log(`Checking if job "${jobTitle}" exists...`);
  let job = await prisma.job.findFirst({
    where: { title: jobTitle },
  });

  if (!job) {
    job = await prisma.job.create({
      data: {
        userId: user.id,
        title: jobTitle,
        company: "Redrob AI",
        department: "AI Engineering",
        rawDescription,
        requiredSkills: ["embeddings", "vector databases", "Python", "evaluation frameworks", "NDCG", "MRR", "MAP", "semantic search", "retrieval"],
        preferredSkills: ["fine-tuning", "LoRA", "QLoRA", "learning-to-rank", "distributed systems"],
        responsibilities: [
          "Own the intelligence layer of Redrob's product.",
          "Ship a v2 ranking system that improves recruiter-engagement metrics.",
          "Set up offline and online evaluation infrastructure.",
          "Mentor junior engineers and drive long-term architecture."
        ],
        experienceYears: 5,
        educationLevel: "Bachelor",
        seniority: "Senior",
        domain: "AI/ML",
        softSkills: ["async-first writing", "constructive feedback"],
        preferProductCompany: true,
        preferredDegrees: ["B.Tech", "M.Tech", "B.S.", "M.S.", "Ph.D."],
        preferredUniversities: ["IIT", "NIT", "BITS", "IISc", "Top Global Schools"],
      },
    });
    console.log(`Created Job Posting ID: ${job.id}`);
  } else {
    console.log(`Job posting already exists with ID: ${job.id}`);
  }

  const candidatesPath = path.join(__dirname, "../data /India_runs_data_and_ai_challenge/candidates.jsonl");
  if (!fs.existsSync(candidatesPath)) {
    console.error(`Error: candidates.jsonl not found at ${candidatesPath}`);
    return;
  }

  console.log("Reading candidates.jsonl...");
  const fileContent = fs.readFileSync(candidatesPath, "utf-8");
  const lines = fileContent.split("\n").filter(line => line.trim() !== "");
  const allCandidates = lines.map(line => JSON.parse(line));
  console.log(`Loaded ${allCandidates.length} candidates. Scoring and sorting...`);

  const candidatesWithScores = allCandidates.map(cand => {
    const profile = cand.profile || {};
    const signals = cand.redrob_signals || {};
    
    const anomaly = AnomalyDetector.checkCandidate(cand);
    
    const sub_scores = {
      semantic: compute_smart_semantic_score(cand),
      skills: compute_skills_score(cand),
      experience: compute_experience_score(cand),
      education: compute_education_score(cand),
      domain: compute_domain_score(cand),
      career_progression: compute_career_progression_score(cand),
      availability: compute_availability_score(cand),
    };
    
    const base_score = (
      sub_scores.semantic * 0.40 +
      sub_scores.skills * 0.20 +
      sub_scores.experience * 0.15 +
      sub_scores.education * 0.10 +
      sub_scores.domain * 0.05 +
      sub_scores.career_progression * 0.05 +
      sub_scores.availability * 0.05
    );
    
    const anomaly_penalties = {
      "HIGH": 0.0,
      "MEDIUM": 0.70,
      "LOW": 0.95,
      "CLEAN": 1.0
    };
    const penalty = anomaly_penalties[anomaly.status] || 1.0;
    const overallScore = base_score * penalty;

    return {
      cand,
      scores: {
        overallScore,
        semanticSimilarity: sub_scores.semantic,
        skillMatchScore: sub_scores.skills,
        experienceScore: sub_scores.experience,
        educationScore: sub_scores.education,
        domainScore: sub_scores.domain,
        careerProgressionScore: sub_scores.career_progression,
        availabilityScore: sub_scores.availability,
      },
      anomaly
    };
  });

  candidatesWithScores.sort((a, b) => {
    if (b.scores.overallScore !== a.scores.overallScore) {
      return b.scores.overallScore - a.scores.overallScore;
    }
    return a.cand.candidate_id.localeCompare(b.cand.candidate_id);
  });

  const top100ToSeed = candidatesWithScores.slice(0, 100);
  console.log(`Ready to seed top 100 candidates. First candidate: ${top100ToSeed[0].cand.profile.anonymized_name} (${top100ToSeed[0].scores.overallScore.toFixed(2)}%)`);

  for (let idx = 0; idx < top100ToSeed.length; idx++) {
    const item = top100ToSeed[idx];
    const c = item.cand;
    const profile = c.profile || {};
    const signals = c.redrob_signals || {};
    const scores = item.scores;
    const anomaly = item.anomaly;

    console.log(`Seeding candidate [${idx + 1}/100]: ${profile.anonymized_name} (${c.candidate_id})...`);

    await prisma.candidate.deleteMany({
      where: { candidateId: c.candidate_id }
    });

    const createdCand = await prisma.candidate.create({
      data: {
        userId: user.id,
        candidateId: c.candidate_id,
        name: profile.anonymized_name || "Unknown",
        email: `${c.candidate_id.toLowerCase()}@example.com`,
        phone: signals.verified_phone ? `+91-9999900${idx}` : null,
        rawResumeText: profile.summary || "",
        headline: profile.headline || "",
        summary: profile.summary || "",
        location: profile.location || "",
        country: profile.country || "",
        yearsOfExperience: parseFloat(profile.years_of_experience || 0.0),
        currentTitle: profile.current_title || "",
        currentCompany: profile.current_company || "",
        currentCompanySize: profile.current_company_size || "1-10",
        currentIndustry: profile.current_industry || "Technology",
        profileCompleteness: parseFloat(signals.profile_completeness_score || 0.0),
        signupDate: parseDate(signals.signup_date),
        lastActiveDate: parseDate(signals.last_active_date),
        openToWork: !!signals.open_to_work_flag,
        profileViews30d: parseInt(signals.profile_views_received_30d || 0),
        applications30d: parseInt(signals.applications_submitted_30d || 0),
        recruiterResponse: parseFloat(signals.recruiter_response_rate || 1.0),
        avgResponseTime: parseFloat(signals.avg_response_time_hours || 0.0),
        connectionCount: parseInt(signals.connection_count || 0),
        endorsementsCount: parseInt(signals.endorsements_received || 0),
        noticePeriodDays: parseInt(signals.notice_period_days || 0),
        expectedSalaryMin: parseFloat(signals.expected_salary_range_inr_lpa?.min || 0.0),
        expectedSalaryMax: parseFloat(signals.expected_salary_range_inr_lpa?.max || 0.0),
        preferredWorkMode: signals.preferred_work_mode || "flexible",
        willingToRelocate: !!signals.willing_to_relocate,
        githubActivityScore: parseFloat(signals.github_activity_score || -1.0),
        searchAppearance30d: parseInt(signals.search_appearance_30d || 0),
        savedByRecruiters30d: parseInt(signals.saved_by_recruiters_30d || 0),
        interviewCompletion: parseFloat(signals.interview_completion_rate || 0.0),
        offerAcceptanceRate: parseFloat(signals.offer_acceptance_rate || -1.0),
        verifiedEmail: !!signals.verified_email,
        verifiedPhone: !!signals.verified_phone,
        linkedinConnected: !!signals.linkedin_connected,
        anomalyStatus: anomaly.status || "CLEAN",
        anomalyReasons: anomaly.reasons || [],
      }
    });

    if (c.skills && c.skills.length > 0) {
      await prisma.skill.createMany({
        data: c.skills.map(s => ({
          candidateId: createdCand.id,
          name: s.name,
          proficiency: s.proficiency || "intermediate",
          endorsements: parseInt(s.endorsements || 0),
          durationMonths: parseInt(s.duration_months || 0)
        }))
      });
    }

    if (c.career_history && c.career_history.length > 0) {
      await prisma.careerHistory.createMany({
        data: c.career_history.map(ch => ({
          candidateId: createdCand.id,
          company: ch.company,
          title: ch.title,
          startDate: parseDate(ch.start_date),
          endDate: parseDate(ch.end_date),
          durationMonths: parseInt(ch.duration_months || 0),
          isCurrent: !!ch.is_current,
          industry: ch.industry || "",
          companySize: ch.company_size || "1-10",
          description: ch.description || ""
        }))
      });
    }

    if (c.education && c.education.length > 0) {
      await prisma.education.createMany({
        data: c.education.map(edu => ({
          candidateId: createdCand.id,
          institution: edu.institution,
          degree: edu.degree,
          fieldOfStudy: edu.field_of_study || "",
          startYear: edu.start_year ? parseInt(edu.start_year) : null,
          endYear: edu.end_year ? parseInt(edu.end_year) : null,
          grade: edu.grade || null,
          tier: edu.tier || "unknown"
        }))
      });
    }

    const strengths = [];
    if (scores.skillMatchScore >= 80.0) strengths.push("Strong core AI/ML skills overlap.");
    if (scores.experienceScore >= 90.0) strengths.push("Stated YOE aligns perfectly with target seniority.");
    if (scores.availabilityScore >= 80.0) strengths.push("Highly active and immediately available.");

    const weaknesses = [];
    if (scores.availabilityScore < 50.0) weaknesses.push("Long notice period or inactive profile.");
    if (anomaly.status !== "CLEAN") weaknesses.push("Inconsistencies detected in history/skills timeline.");

    let rec = "Consider";
    if (scores.overallScore >= 80.0) rec = "Strong Hire";
    else if (scores.overallScore >= 65.0) rec = "Hire";
    else if (scores.overallScore < 50.0) rec = "Reject";

    await prisma.match.create({
      data: {
        jobId: job.id,
        candidateId: createdCand.id,
        overallScore: scores.overallScore,
        semanticSimilarity: scores.semanticSimilarity,
        skillMatchScore: scores.skillMatchScore,
        experienceScore: scores.experienceScore,
        educationScore: scores.educationScore,
        domainScore: scores.domainScore,
        careerProgressionScore: scores.careerProgressionScore,
        availabilityScore: scores.availabilityScore,
        strengths,
        weaknesses,
        missingSkills: ["distributed systems"],
        hiringRecommendation: rec,
        improvementSuggestions: ["Strengthen hands-on fine-tuning project examples"],
        recruiterStatus: scores.overallScore >= 65.0 ? "SHORTLISTED" : "PENDING"
      }
    });
  }

  console.log("Database seeding completed successfully!");
}

main()
  .catch(e => {
    console.error("Seeding failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
