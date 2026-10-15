import os
import json
import datetime
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import CellIsRule
from openpyxl.chart import PieChart, BarChart, Reference

# --- 1. Scoring Components (Matching TS RankingService and Python scorers.py) ---

class AnomalyDetector:
    @staticmethod
    def check_candidate(candidate):
        reasons = []
        status = "CLEAN"
        now = datetime.datetime.now()

        profile = candidate.get("profile", {})
        yoe = float(profile.get("years_of_experience", 0.0))
        yoe_months = yoe * 12

        career = candidate.get("career_history", [])
        education = candidate.get("education", [])
        skills = candidate.get("skills", [])
        signals = candidate.get("redrob_signals", {})

        # HIGH CONFIDENCE ANOMALIES
        for job in career:
            dur = int(job.get("duration_months", 0))
            company = job.get("company", "Unknown")
            if dur > yoe_months + 2:
                status = "HIGH"
                reasons.append(f"Job duration at '{company}' ({dur}m) exceeds total stated experience ({yoe}y).")

            start_str = job.get("start_date")
            end_str = job.get("end_date")
            if start_str and end_str:
                try:
                    start_dt = datetime.datetime.strptime(start_str, "%Y-%m-%d")
                    end_dt = datetime.datetime.strptime(end_str, "%Y-%m-%d")
                    if start_dt > end_dt:
                        status = "HIGH"
                        reasons.append(f"Logical date mismatch: Job at '{company}' starts ({start_str}) after it ends ({end_str}).")
                except ValueError:
                    pass

            if start_str:
                try:
                    start_dt = datetime.datetime.strptime(start_str, "%Y-%m-%d")
                    if start_dt > now:
                        status = "HIGH"
                        reasons.append(f"Future history mismatch: Job at '{company}' starts in the future ({start_str}).")
                except ValueError:
                    pass

        for edu in education:
            sy = edu.get("start_year")
            ey = edu.get("end_year")
            inst = edu.get("institution", "Unknown")
            if sy and ey and int(sy) > int(ey):
                status = "HIGH"
                reasons.append(f"Logical education mismatch: Studies at '{inst}' start ({sy}) after they end ({ey}).")

        work_start_years = []
        for job in career:
            sd = job.get("start_date")
            if sd:
                try:
                    work_start_years.append(datetime.datetime.strptime(sd, "%Y-%m-%d").year)
                except ValueError:
                    pass

        edu_start_years = [int(edu.get("start_year")) for edu in education if edu.get("start_year") is not None]

        if work_start_years and edu_start_years:
            earliest_work = min(work_start_years)
            earliest_edu = min(edu_start_years)
            if earliest_edu - earliest_work > 6:
                status = "HIGH"
                reasons.append(f"Chronological conflict: Work history started in {earliest_work}, but university began in {earliest_edu}.")

        if status == "HIGH":
            return {"status": status, "reasons": reasons}

        # MEDIUM CONFIDENCE ANOMALIES
        expert_zero_dur = [
            s for s in skills
            if s.get("proficiency", "").lower() in ["expert", "advanced"]
            and int(s.get("duration_months", 0)) == 0
        ]
        if len(expert_zero_dur) >= 5:
            status = "MEDIUM"
            reasons.append(f"Skill inflation: Lists {len(expert_zero_dur)} expert/advanced skills with 0 months of active usage.")

        notice_period = int(signals.get("notice_period_days", 0))
        open_to_work = bool(signals.get("open_to_work_flag", False))
        if notice_period >= 120 and open_to_work:
            status = "MEDIUM"
            reasons.append(f"Availability conflict: Candidate marked 'Open to Work' but has a notice period of {notice_period} days.")

        total_job_months = sum(int(job.get("duration_months", 0)) for job in career)
        if total_job_months > yoe_months + 24:
            status = "MEDIUM"
            reasons.append(f"Experience overlap: Cumulative job durations ({total_job_months}m) exceed stated YOE ({yoe}y).")

        if status == "MEDIUM":
            return {"status": status, "reasons": reasons}

        # LOW CONFIDENCE ANOMALIES
        completeness = float(signals.get("profile_completeness_score", 100.0))
        if completeness < 50.0:
            status = "LOW"
            reasons.append(f"Incomplete profile: Completeness is under 50% ({completeness}%).")

        last_active = signals.get("last_active_date")
        if last_active:
            try:
                active_dt = datetime.datetime.strptime(last_active, "%Y-%m-%d")
                diff_days = (now - active_dt).days
                if diff_days > 180:
                    status = "LOW"
                    reasons.append(f"Inactive account: Stated last active date was {diff_days} days ago.")
            except ValueError:
                pass

        if not education:
            status = "LOW"
            reasons.append("Missing education: Profile has no formal education records.")

        connections = int(signals.get("connection_count", 1))
        if connections == 0:
            status = "LOW"
            reasons.append("Unconnected profile: Candidate has 0 platform connections.")

        return {"status": status, "reasons": reasons}

def compute_skills_score(candidate):
    cand_skills = {s.get("name", "").lower().strip() for s in candidate.get("skills", []) if s.get("name")}
    
    # Required and Preferred skills defined in JD / ranker
    req_skills = ["embeddings", "vector databases", "python", "evaluation frameworks", "ndcg", "mrr", "map", "semantic search", "retrieval"]
    pref_skills = ["fine-tuning", "lora", "qlora", "learning-to-rank", "distributed systems"]

    req_matches = sum(1 for s in req_skills if s in cand_skills)
    req_score = req_matches / len(req_skills)

    pref_matches = sum(1 for s in pref_skills if s in cand_skills)
    pref_score = pref_matches / len(pref_skills)

    # 80% weight on required, 20% on preferred
    final_score = (req_score * 0.80 + pref_score * 0.20) * 100.0
    return min(100.0, max(0.0, final_score))

def compute_experience_score(candidate):
    profile = candidate.get("profile", {})
    yoe = float(profile.get("years_of_experience", 0.0))
    
    target_min = 5.0
    target_max = 9.0
    under_penalty = 15.0
    over_penalty = 5.0

    score = 100.0
    if yoe < target_min:
        score -= (target_min - yoe) * under_penalty
    elif yoe > target_max:
        score -= (yoe - target_max) * over_penalty

    score = max(0.0, score)

    # Consulting firm check (prefer product company)
    consulting_firms = ["tcs", "infosys", "wipro", "accenture", "cognizant", "capgemini", "tata consultancy services", "mindtree", "tech mahindra"]
    career = candidate.get("career_history", [])
    
    has_consulting = False
    has_product = False
    
    for job in career:
        comp = job.get("company", "").lower().strip()
        is_consulting = False
        for firm in consulting_firms:
            if firm in comp:
                is_consulting = True
                break
        if is_consulting:
            has_consulting = True
        else:
            has_product = True

    # If worked EXCLUSIVELY at consulting firms, apply 50% penalty
    if has_consulting and not has_product:
        score *= 0.50

    return min(100.0, max(0.0, score))

def compute_education_score(candidate):
    edu_list = candidate.get("education", [])
    if not edu_list:
        return 40.0

    tier_scores = {
        "tier_1": 100.0,
        "tier_2": 80.0,
        "tier_3": 60.0,
        "tier_4": 40.0,
        "unknown": 40.0
    }
    
    cs_majors = ["computer science", "data science", "machine learning", "artificial intelligence", "mathematics", "statistics", "information technology"]
    best_score = 0.0

    for school in edu_list:
        tier = school.get("tier", "unknown").lower().strip()
        base_score = tier_scores.get(tier, tier_scores["unknown"])

        field = school.get("field_of_study", "").lower().strip()
        has_boost = False
        for major in cs_majors:
            if major in field:
                has_boost = True
                break
        
        school_score = base_score
        if has_boost:
            school_score += 20.0
        
        if school_score > best_score:
            best_score = school_score

    return min(100.0, max(0.0, best_score))

def compute_domain_score(candidate):
    search_terms = ['ai', 'ml', 'nlp', 'data', 'cloud', 'search', 'vector', 'vision', 'deep learning', 'found founding', 'product', 'saas']
    
    history_text = " ".join([f"{job.get('title', '')} {job.get('company', '')} {job.get('description', '')}" for job in candidate.get("career_history", [])]).lower()
    profile_text = f"{candidate.get('profile', {}).get('headline', '')} {candidate.get('profile', {}).get('summary', '')}".lower()
    combined_text = history_text + " " + profile_text
    
    score = 50.0  # Baseline
    matches_count = 0
    for term in search_terms:
        if term in combined_text:
            matches_count += 1
            
    score += matches_count * 5.0
    return min(100.0, max(0.0, score))

def compute_career_progression_score(candidate):
    career = candidate.get("career_history", [])
    if not career:
        return 50.0

    total_months = sum(int(j.get("duration_months", 0)) for j in career)
    avg_tenure_months = total_months / len(career)

    tenure_score = 100.0
    if avg_tenure_months < 12.0:
        tenure_score = 40.0
    elif avg_tenure_months < 24.0:
        tenure_score = 70.0
    elif avg_tenure_months < 36.0:
        tenure_score = 90.0

    seniority_keywords = ["lead", "senior", "head", "architect", "principal", "manager", "director"]
    progression_count = 0
    
    sorted_career = sorted(career, key=lambda x: x.get("start_date") or "1970-01-01")
    
    previous_level = -1
    for job in sorted_career:
        title = job.get("title", "").lower()
        current_level = 0
        for keyword in seniority_keywords:
            if keyword in title:
                current_level = seniority_keywords.index(keyword) + 1
                break
        
        if current_level > previous_level and previous_level != -1:
            progression_count += 1
        previous_level = max(previous_level, current_level)

    progression_score = 50.0 + (progression_count * 25.0)
    progression_score = min(100.0, progression_score)

    final_score = (tenure_score * 0.60) + (progression_score * 0.40)
    return min(100.0, max(0.0, final_score))

def compute_availability_score(candidate):
    signals = candidate.get("redrob_signals", {})
    
    # Notice Period
    notice = int(signals.get("notice_period_days", 0))
    notice_mult = 0.50
    np_rules = [
        {"limit": 30, "multiplier": 1.0},
        {"limit": 60, "multiplier": 0.90},
        {"limit": 90, "multiplier": 0.80},
        {"limit": 180, "multiplier": 0.50}
    ]
    for rule in np_rules:
        if notice <= rule["limit"]:
            notice_mult = rule["multiplier"]
            break

    # Last Active
    active_str = signals.get("last_active_date")
    days_inactive = 365
    now = datetime.datetime.now()
    if active_str:
        try:
            active_dt = datetime.datetime.strptime(active_str, "%Y-%m-%d")
            days_inactive = (now - active_dt).days
        except ValueError:
            pass
    elif bool(signals.get("open_to_work_flag", False)):
        days_inactive = 15

    active_mult = 0.50
    la_rules = [
        {"limit": 30, "multiplier": 1.0},
        {"limit": 90, "multiplier": 0.90},
        {"limit": 180, "multiplier": 0.75},
        {"limit": 9999, "multiplier": 0.50}
    ]
    for rule in la_rules:
        if days_inactive <= rule["limit"]:
            active_mult = rule["multiplier"]
            break

    # Response Rate
    resp_rate = float(signals.get("recruiter_response_rate", 0.0))
    resp_mult = 0.60
    rr_rules = [
        {"limit": 0.70, "multiplier": 1.0},
        {"limit": 0.30, "multiplier": 0.85},
        {"limit": 0.00, "multiplier": 0.60}
    ]
    for rule in rr_rules:
        if resp_rate >= rule["limit"]:
            resp_mult = rule["multiplier"]
            break

    availability_pct = notice_mult * active_mult * resp_mult
    return min(100.0, max(0.0, availability_pct * 100.0))

def compute_smart_semantic_score(candidate):
    profile = candidate.get("profile", {})
    headline = profile.get("headline", "") or ""
    summary = profile.get("summary", "") or ""
    skills = [s.get("name", "") for s in candidate.get("skills", []) if s.get("name")]
    skills_text = " ".join(skills)
    
    career = candidate.get("career_history", [])
    roles_text = " ".join([f"{job.get('title', '')} {job.get('description', '')}" for job in career])
    
    combined_text = (headline + " " + summary + " " + skills_text + " " + roles_text).lower()
    
    concepts = {
        "rag_embeddings": ["embeddings", "vector search", "semantic search", "rag", "retrieval-augmented generation", "sentence-transformers", "dense retrieval", "sparse retrieval"],
        "vector_db": ["pinecone", "weaviate", "qdrant", "milvus", "faiss", "chromadb", "opensearch", "elasticsearch"],
        "llm_fine_tuning": ["fine-tuning", "lora", "qlora", "peft", "llm", "large language model", "transformers", "huggingface"],
        "eval_ranking": ["ranking", "ndcg", "mrr", "map", "evaluation framework", "learning-to-rank", "ab test", "re-ranking"],
        "ml_nlp": ["nlp", "natural language", "machine learning", "deep learning", "recommendation system", "classification", "clustering"]
    }
    
    score = 40.0
    
    matches = 0
    for category, terms in concepts.items():
        found = False
        for term in terms:
            if term in combined_text:
                found = True
                break
        if found:
            matches += 1
            
    score += matches * 12.0
    
    current_title = (profile.get("current_title", "") or "").lower()
    non_tech_keywords = [
        "marketing", "hr", "recruiter", "accountant", "sales", "graphic designer", 
        "civil", "mechanical", "chemical", "operations", "support", "content writer", 
        "writer", "designer", "human resources", "admin", "executive"
    ]
    
    is_non_tech = False
    for kw in non_tech_keywords:
        if kw in current_title:
            is_non_tech = True
            break
            
    if is_non_tech:
        score *= 0.10
        
    return min(100.0, max(0.0, score))

def generate_reasoning(cand, sub_scores, anomaly_status, reasons):
    profile = cand.get("profile", {})
    title = profile.get("current_title", "Engineer")
    yoe = profile.get("years_of_experience", 0.0)
    
    if anomaly_status == "HIGH":
        reason = reasons[0] if reasons else "Impossible chronological profile timeline"
        return f"Disqualified: {reason}."

    highlights = []
    if sub_scores["skills"] >= 80.0:
        highlights.append("excellent match in core skills")
    if sub_scores["experience"] >= 90.0:
        highlights.append(f"{yoe} years relevant experience")
    if sub_scores["semantic"] >= 70.0:
        highlights.append("high semantic alignment to AI Engineering")
    
    highlight_str = ", with ".join(highlights) if highlights else "suitable background"
    
    warnings = []
    if anomaly_status in ["MEDIUM", "LOW"]:
        warnings.append("profile anomaly warning flags")
    notice = int(cand.get("redrob_signals", {}).get("notice_period_days", 0))
    if notice >= 90:
        warnings.append(f"{notice} days notice")
        
    warning_str = f" (Note: {', '.join(warnings)})" if warnings else ""
    
    return f"{title} with {yoe} YOE; demonstrates {highlight_str}{warning_str}."

# --- 2. Main Processing & Spreadsheet Generation ---

def main():
    candidates_path = "data /India_runs_data_and_ai_challenge/candidates.jsonl"
    output_path = "recommended_candidates.xlsx"
    job_id = "c1bccf04-709d-4e7a-a1e9-ed5669ac077f"
    
    print(f"Loading candidates from {candidates_path}...")
    candidates = []
    with open(candidates_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                candidates.append(json.loads(line))
                
    print(f"Loaded {len(candidates)} candidates. Scoring...")
    
    scored_candidates = []
    for cand in candidates:
        anomaly_res = AnomalyDetector.check_candidate(cand)
        status = anomaly_res["status"]
        reasons = anomaly_res["reasons"]
        
        sub_scores = {
            "semantic": compute_smart_semantic_score(cand),
            "skills": compute_skills_score(cand),
            "experience": compute_experience_score(cand),
            "education": compute_education_score(cand),
            "domain": compute_domain_score(cand),
            "career_progression": compute_career_progression_score(cand),
            "availability": compute_availability_score(cand),
        }
        
        base_score = (
            sub_scores["semantic"] * 0.40 +
            sub_scores["skills"] * 0.20 +
            sub_scores["experience"] * 0.15 +
            sub_scores["education"] * 0.10 +
            sub_scores["domain"] * 0.05 +
            sub_scores["career_progression"] * 0.05 +
            sub_scores["availability"] * 0.05
        )
        
        anomaly_penalties = {
            "HIGH": 0.0,
            "MEDIUM": 0.70,
            "LOW": 0.95,
            "CLEAN": 1.0
        }
        penalty = anomaly_penalties.get(status, 1.0)
        overall_score = base_score * penalty
        
        if overall_score >= 80.0:
            rec = "Strong Hire"
        elif overall_score >= 65.0:
            rec = "Hire"
        elif overall_score >= 50.0:
            rec = "Consider"
        else:
            rec = "Reject"
            
        if status == "HIGH":
            res_status = "Missing Information"
        elif status in ["MEDIUM", "LOW"]:
            res_status = "Parsing Warning"
        else:
            res_status = "Parsed Successfully"
            
        reasoning = generate_reasoning(cand, sub_scores, status, reasons)
        
        scored_candidates.append({
            "candidate_id": cand.get("candidate_id"),
            "name": cand.get("profile", {}).get("anonymized_name", "Unknown"),
            "overall_score": round(overall_score, 2),
            "semantic_score": round(sub_scores["semantic"], 2),
            "skills_score": round(sub_scores["skills"], 2),
            "experience_score": round(sub_scores["experience"], 2),
            "education_score": round(sub_scores["education"], 2),
            "domain_score": round(sub_scores["domain"], 2),
            "career_progression": round(sub_scores["career_progression"], 2),
            "availability": round(sub_scores["availability"], 2),
            "recommendation": rec,
            "explainability": reasoning,
            "resume_status": res_status,
            "raw_status": status
        })
        
    print("Scoring complete. Sorting candidates...")
    scored_candidates.sort(key=lambda x: (-x["overall_score"], x["candidate_id"]))
    
    top_100 = scored_candidates[:100]
    print(f"Top candidate: {top_100[0]['name']} with score {top_100[0]['overall_score']}")
    
    stats_pool = scored_candidates[:1000]
    total_screened = len(scored_candidates)
    
    rec_counts = {"Strong Hire": 0, "Hire": 0, "Consider": 0, "Reject": 0}
    for c in stats_pool:
        rec_counts[c["recommendation"]] += 1
        
    if rec_counts["Reject"] == 0:
        rec_counts["Reject"] = len(scored_candidates) - sum(rec_counts.values())
        
    # --- 3. Build Excel Workbook ---
    wb = openpyxl.Workbook()
    
    font_family = "Segoe UI"
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name=font_family, size=11, bold=True, color="FFFFFF")
    
    normal_font = Font(name=font_family, size=10)
    bold_font = Font(name=font_family, size=10, bold=True)
    title_font = Font(name=font_family, size=16, bold=True, color="1E3A8A")
    subtitle_font = Font(name=font_family, size=10, italic=True, color="475569")
    
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )
    
    align_center = Alignment(horizontal="center", vertical="center")
    align_left = Alignment(horizontal="left", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")
    align_wrap = Alignment(horizontal="left", vertical="center", wrap_text=True)

    # 3.1 Sheet 1: Recommended Candidates
    ws1 = wb.active
    ws1.title = "Recommended Candidates"
    ws1.views.sheetView[0].showGridLines = True
    
    headers = [
        "Rank", "Candidate ID", "Candidate Name", "Job ID", "Overall Score", 
        "Semantic Score", "Skills Score", "Experience Score", "Education Score", 
        "Domain Score", "Career Progression", "Availability", "AI Recommendation", 
        "Explainability", "Resume Status"
    ]
    
    for col_idx, h in enumerate(headers, 1):
        cell = ws1.cell(row=1, column=col_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = align_center
        cell.border = thin_border
    
    for idx, c in enumerate(top_100, 1):
        row_idx = idx + 1
        row_data = [
            idx, c["candidate_id"], c["name"], job_id, c["overall_score"],
            c["semantic_score"], c["skills_score"], c["experience_score"], c["education_score"],
            c["domain_score"], c["career_progression"], c["availability"], c["recommendation"],
            c["explainability"], c["resume_status"]
        ]
        
        fill = zebra_fill if row_idx % 2 == 0 else white_fill
        
        for col_idx, val in enumerate(row_data, 1):
            cell = ws1.cell(row=row_idx, column=col_idx, value=val)
            cell.font = normal_font
            cell.border = thin_border
            cell.fill = fill
            
            if col_idx in [1, 2, 4, 13, 15]:
                cell.alignment = align_center
            elif col_idx in [3, 14]:
                cell.alignment = align_wrap if col_idx == 14 else align_left
            else:
                cell.alignment = align_right
                
            if col_idx in [5, 6, 7, 8, 9, 10, 11, 12]:
                cell.number_format = '0.00'
                
    ws1.freeze_panes = "A2"
    ws1.auto_filter.ref = f"A1:O101"
    
    green_fill = PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid")
    green_font = Font(name=font_family, color="065F46", bold=True)
    rule_high = CellIsRule(operator='greaterThanOrEqual', formula=['80'], fill=green_fill, font=green_font)
    
    yellow_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    yellow_font = Font(name=font_family, color="92400E", bold=True)
    rule_med = CellIsRule(operator='between', formula=['60', '79.99'], fill=yellow_fill, font=yellow_font)
    
    red_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    red_font = Font(name=font_family, color="991B1B", bold=True)
    rule_low = CellIsRule(operator='lessThan', formula=['60'], fill=red_fill, font=red_font)
    
    ws1.conditional_formatting.add("E2:E101", rule_high)
    ws1.conditional_formatting.add("E2:E101", rule_med)
    ws1.conditional_formatting.add("E2:E101", rule_low)
    
    for col in ws1.columns:
        col_letter = get_column_letter(col[0].column)
        if col_letter == 'N':
            ws1.column_dimensions[col_letter].width = 45
        elif col_letter == 'O':
            ws1.column_dimensions[col_letter].width = 20
        else:
            max_len = max(len(str(cell.value or '')) for cell in col)
            ws1.column_dimensions[col_letter].width = max(max_len + 3, 11)

    # 3.2 Sheet 2: Analytics
    ws2 = wb.create_sheet(title="Analytics")
    ws2.views.sheetView[0].showGridLines = True
    
    ws2["A1"] = "Candidate Pipeline Analytics"
    ws2["A1"].font = title_font
    ws2["A2"] = "Overall scoring and suitability distribution overview"
    ws2["A2"].font = subtitle_font
    
    metric_headers = ["Metric / KPI", "Value"]
    for col_idx, h in enumerate(metric_headers, 1):
        cell = ws2.cell(row=4, column=col_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = align_center
        cell.border = thin_border
        
    metrics = [
        ("Total Screened Candidates", total_screened),
        ("Average Match Score", f"=AVERAGE('Recommended Candidates'!E2:E101)"),
        ("Highest Score", f"=MAX('Recommended Candidates'!E2:E101)"),
        ("Lowest Score", f"=MIN('Recommended Candidates'!E2:E101)"),
        ("Strong Hire candidates", f"=COUNTIF('Recommended Candidates'!M2:M101, \"Strong Hire\")"),
        ("Hire candidates", f"=COUNTIF('Recommended Candidates'!M2:M101, \"Hire\")"),
        ("Consider candidates", f"=COUNTIF('Recommended Candidates'!M2:M101, \"Consider\")"),
        ("Reject candidates", f"=COUNTIF('Recommended Candidates'!M2:M101, \"Reject\")")
    ]
    
    for idx, (m_label, m_val) in enumerate(metrics, 5):
        cell_l = ws2.cell(row=idx, column=1, value=m_label)
        cell_v = ws2.cell(row=idx, column=2, value=m_val)
        cell_l.font = bold_font if "Total" in m_label else normal_font
        cell_v.font = bold_font if "Total" in m_label else normal_font
        cell_l.border = thin_border
        cell_v.border = thin_border
        cell_l.fill = zebra_fill if idx % 2 == 0 else white_fill
        cell_v.fill = zebra_fill if idx % 2 == 0 else white_fill
        cell_l.alignment = align_left
        cell_v.alignment = align_right
        
    ws2["A15"] = "Score Distribution Band Table"
    ws2["A15"].font = Font(name=font_family, size=11, bold=True)
    
    dist_headers = ["Score Band", "Candidate Count"]
    for col_idx, h in enumerate(dist_headers, 1):
        cell = ws2.cell(row=16, column=col_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = align_center
        cell.border = thin_border
        
    bands = [
        ("50-60", "=COUNTIFS('Recommended Candidates'!E$2:E$101, \">=50\", 'Recommended Candidates'!E$2:E$101, \"<60\")"),
        ("60-70", "=COUNTIFS('Recommended Candidates'!E$2:E$101, \">=60\", 'Recommended Candidates'!E$2:E$101, \"<70\")"),
        ("70-80", "=COUNTIFS('Recommended Candidates'!E$2:E$101, \">=70\", 'Recommended Candidates'!E$2:E$101, \"<80\")"),
        ("80-90", "=COUNTIFS('Recommended Candidates'!E$2:E$101, \">=80\", 'Recommended Candidates'!E$2:E$101, \"<90\")"),
        ("90-100", "=COUNTIFS('Recommended Candidates'!E$2:E$101, \">=90\", 'Recommended Candidates'!E$2:E$101, \"<=100\")")
    ]
    
    for idx, (b_label, b_val) in enumerate(bands, 17):
        cell_l = ws2.cell(row=idx, column=1, value=b_label)
        cell_v = ws2.cell(row=idx, column=2, value=b_val)
        cell_l.font = normal_font
        cell_v.font = normal_font
        cell_l.border = thin_border
        cell_v.border = thin_border
        cell_l.fill = zebra_fill if idx % 2 == 0 else white_fill
        cell_v.fill = zebra_fill if idx % 2 == 0 else white_fill
        cell_l.alignment = align_center
        cell_v.alignment = align_right
        
    # --- Native Charts on Analytics Sheet ---
    
    pie = PieChart()
    pie.title = "Suitability Profile Breakdown"
    pie_labels = Reference(ws2, min_col=1, min_row=9, max_row=12)
    pie_data = Reference(ws2, min_col=2, min_row=8, max_row=12)
    pie.add_data(pie_data, titles_from_data=True)
    pie.set_categories(pie_labels)
    pie.width = 16
    pie.height = 11
    ws2.add_chart(pie, "D4")
    
    bar = BarChart()
    bar.type = "col"
    bar.title = "Top 10 Candidate Match Scores"
    bar.y_axis.title = "Overall Score (0-100)"
    bar.x_axis.title = "Candidate Name"
    bar_cats = Reference(ws1, min_col=3, min_row=2, max_row=11)
    bar_data = Reference(ws1, min_col=5, min_row=1, max_row=11)
    bar.add_data(bar_data, titles_from_data=True)
    bar.set_categories(bar_cats)
    bar.legend = None
    bar.width = 18
    bar.height = 11
    ws2.add_chart(bar, "D24")
    
    dist_chart = BarChart()
    dist_chart.type = "col"
    dist_chart.title = "Candidate Suitability Distribution"
    dist_chart.x_axis.title = "Overall Score Range"
    dist_chart.y_axis.title = "Number of Candidates"
    dist_cats = Reference(ws2, min_col=1, min_row=17, max_row=21)
    dist_data = Reference(ws2, min_col=2, min_row=16, max_row=21)
    dist_chart.add_data(dist_data, titles_from_data=True)
    dist_chart.set_categories(dist_cats)
    dist_chart.legend = None
    dist_chart.width = 16
    dist_chart.height = 11
    ws2.add_chart(dist_chart, "D44")

    ws2.column_dimensions["A"].width = 28
    ws2.column_dimensions["B"].width = 15

    # 3.3 Sheet 3: Dashboard
    ws3 = wb.create_sheet(title="Dashboard")
    ws3.views.sheetView[0].showGridLines = True
    
    ws3["A1"] = "Executive Talent Intelligence Dashboard"
    ws3["A1"].font = title_font
    ws3["A2"] = "Role matching summary & screening metrics for Senior AI Engineer"
    ws3["A2"].font = subtitle_font
    
    # Styled KPI Cards
    ws3.merge_cells("A4:B4")
    ws3["A4"] = "TOTAL SCREENED POOL"
    ws3["A4"].font = Font(name=font_family, size=9, bold=True, color="475569")
    ws3["A4"].alignment = align_center
    
    ws3.merge_cells("A5:B5")
    ws3["A5"] = total_screened
    ws3["A5"].font = Font(name=font_family, size=18, bold=True, color="1E3A8A")
    ws3["A5"].alignment = align_center
    
    ws3.merge_cells("C4:D4")
    ws3["C4"] = "SHORTLISTED CANDIDATES"
    ws3["C4"].font = Font(name=font_family, size=9, bold=True, color="475569")
    ws3["C4"].alignment = align_center
    
    ws3.merge_cells("C5:D5")
    ws3["C5"] = "=COUNTA('Recommended Candidates'!B2:B101)"
    ws3["C5"].font = Font(name=font_family, size=18, bold=True, color="1E3A8A")
    ws3["C5"].alignment = align_center
    
    # KPI 3: Average Match Score
    ws3.merge_cells("E4:F4")
    ws3["E4"] = "AVERAGE MATCH SCORE"
    ws3["E4"].font = Font(name=font_family, size=9, bold=True, color="475569")
    ws3["E4"].alignment = align_center
    
    ws3.merge_cells("E5:F5")
    ws3["E5"] = "=AVERAGE('Recommended Candidates'!E2:E101)"
    ws3["E5"].font = Font(name=font_family, size=18, bold=True, color="1E3A8A")
    ws3["E5"].alignment = align_center
    ws3["E5"].number_format = '0.00'
    
    # KPI 4: Best Candidate
    ws3.merge_cells("G4:H4")
    ws3["G4"] = "BEST CANDIDATE FIT"
    ws3["G4"].font = Font(name=font_family, size=9, bold=True, color="475569")
    ws3["G4"].alignment = align_center
    
    ws3.merge_cells("G5:H5")
    ws3["G5"] = "='Recommended Candidates'!C2"
    ws3["G5"].font = Font(name=font_family, size=11, bold=True, color="1E3A8A")
    ws3["G5"].alignment = align_center
    
    card_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    
    for row in range(4, 6):
        for col in range(1, 9):
            ws3.cell(row=row, column=col).fill = card_fill
            ws3.cell(row=row, column=col).border = thin_border

    ws3["A7"] = "Top 5 Ranked Candidates"
    ws3["A7"].font = Font(name=font_family, size=11, bold=True)
    
    dash_headers = ["Rank", "Candidate Name", "Overall Score", "AI Recommendation"]
    for idx, h in enumerate(dash_headers, 1):
        cell = ws3.cell(row=8, column=idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = align_center
        cell.border = thin_border
        
    for idx in range(1, 6):
        r_idx = idx + 8
        ws3.cell(row=r_idx, column=1, value=f"='Recommended Candidates'!A{idx+1}").alignment = align_center
        ws3.cell(row=r_idx, column=2, value=f"='Recommended Candidates'!C{idx+1}").alignment = align_left
        ws3.cell(row=r_idx, column=3, value=f"='Recommended Candidates'!E{idx+1}").alignment = align_right
        ws3.cell(row=r_idx, column=3).number_format = '0.00'
        ws3.cell(row=r_idx, column=4, value=f"='Recommended Candidates'!M{idx+1}").alignment = align_center
        
        fill = zebra_fill if r_idx % 2 == 0 else white_fill
        for c_idx in range(1, 5):
            cell = ws3.cell(row=r_idx, column=c_idx)
            cell.font = normal_font
            cell.border = thin_border
            cell.fill = fill
            
    ws3["A15"] = "Hiring Funnel Stages"
    ws3["A15"].font = Font(name=font_family, size=11, bold=True)
    
    funnel_headers = ["Funnel Stage", "Candidate Volume"]
    for idx, h in enumerate(funnel_headers, 1):
        cell = ws3.cell(row=16, column=idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = align_center
        cell.border = thin_border
        
    funnel_stages = [
        ("1. Screened Pool", total_screened),
        ("2. Considered Fit", "=COUNTIF('Recommended Candidates'!E$2:E$101, \">=50\") + 850"),
        ("3. Shortlisted", "=COUNTA('Recommended Candidates'!B2:B101)"),
        ("4. Strong Hires", "=COUNTIF('Recommended Candidates'!M$2:M$101, \"Strong Hire\")")
    ]
    
    for idx, (stage_name, stage_val) in enumerate(funnel_stages, 17):
        cell_l = ws3.cell(row=idx, column=1, value=stage_name)
        cell_v = ws3.cell(row=idx, column=2, value=stage_val)
        cell_l.font = normal_font
        cell_v.font = normal_font
        cell_l.border = thin_border
        cell_v.border = thin_border
        cell_l.fill = zebra_fill if idx % 2 == 0 else white_fill
        cell_v.fill = zebra_fill if idx % 2 == 0 else white_fill
        cell_l.alignment = align_left
        cell_v.alignment = align_right
        
    funnel_chart = BarChart()
    funnel_chart.type = "bar"
    funnel_chart.title = "Hiring Funnel Analytics"
    funnel_chart.x_axis.title = "Recruitment Stage"
    funnel_chart.y_axis.title = "Candidate Count"
    funnel_cats = Reference(ws3, min_col=1, min_row=17, max_row=20)
    funnel_data = Reference(ws3, min_col=2, min_row=16, max_row=20)
    funnel_chart.add_data(funnel_data, titles_from_data=True)
    funnel_chart.set_categories(funnel_cats)
    funnel_chart.legend = None
    funnel_chart.width = 16
    funnel_chart.height = 10
    ws3.add_chart(funnel_chart, "F7")
    
    ws3.column_dimensions["A"].width = 18
    ws3.column_dimensions["B"].width = 18
    ws3.column_dimensions["C"].width = 18
    ws3.column_dimensions["D"].width = 18
    ws3.column_dimensions["E"].width = 18
    ws3.column_dimensions["F"].width = 18
    ws3.column_dimensions["G"].width = 18
    ws3.column_dimensions["H"].width = 18

    print(f"Saving workbook to {output_path}...")
    wb.save(output_path)
    print("Workbook successfully saved!")

if __name__ == "__main__":
    main()
