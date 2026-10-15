import logging
import math
import numpy as np
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional

# Configure logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("Scorers")

class BaseScorer(ABC):
    """
    Abstract Base Class for all candidate evaluation scorers.
    Enforces modular, independent scoring implementation.
    """
    @abstractmethod
    def score(self, candidate: Dict[str, Any], jd: Dict[str, Any], config: Dict[str, Any]) -> float:
        """
        Evaluates a candidate profile against job description criteria.

        Args:
            candidate: Dict containing structured candidate profile, experience, signals.
            jd: Dict containing structured target job description parameters.
            config: Config dictionary containing weights, bands, and rules.

        Returns:
            A score float between 0.0 and 100.0.
        """
        pass


class SemanticScorer(BaseScorer):
    """
    Evaluates semantic text similarity between candidate and JD using precomputed embeddings.
    """
    def score(self, candidate: Dict[str, Any], jd: Dict[str, Any], config: Dict[str, Any]) -> float:
        cand_embed = candidate.get("embedding")
        jd_embed = jd.get("embedding")

        if cand_embed is not None and jd_embed is not None:
            try:
                u = np.array(cand_embed, dtype=np.float32)
                v = np.array(jd_embed, dtype=np.float32)
                
                dot = np.dot(u, v)
                norm_u = np.linalg.norm(u)
                norm_v = np.linalg.norm(v)

                if norm_u != 0 and norm_v != 0:
                    similarity = float(dot / (norm_u * norm_v))
                    similarity_scaled = max(0.0, similarity) * 100.0
                    return min(100.0, similarity_scaled)
            except Exception as e:
                logger.error("Error computing semantic similarity: %s", e)

        # Fallback keyword semantic match
        profile = candidate.get("profile", {})
        headline = profile.get("headline", "") or ""
        summary = profile.get("summary", "") or ""
        skills = [s.get("name", "") for s in candidate.get("skills", []) if s.get("name")]
        skills_text = " ".join(skills)
        
        career = candidate.get("career_history", [])
        roles_text = " ".join([f"{job.get('title', '')} {job.get('description', '')}" for job in career])
        
        combined_text = (headline + " " + summary + " " + skills_text + " " + roles_text).lower()
        
        concepts = [
            ["embeddings", "vector search", "semantic search", "rag", "retrieval-augmented generation", "sentence-transformers", "dense retrieval", "sparse retrieval"],
            ["pinecone", "weaviate", "qdrant", "milvus", "faiss", "chromadb", "opensearch", "elasticsearch"],
            ["fine-tuning", "lora", "qlora", "peft", "llm", "large language model", "transformers", "huggingface"],
            ["ranking", "ndcg", "mrr", "map", "evaluation framework", "learning-to-rank", "ab test", "re-ranking"],
            ["nlp", "natural language", "machine learning", "deep learning", "recommendation system", "classification", "clustering"]
        ]
        
        score = 40.0
        matches = 0
        for concept_list in concepts:
            if any(term in combined_text for term in concept_list):
                matches += 1
                
        score += matches * 12.0
        
        # Apply Role Alignment check:
        # If the candidate's current title is non-technical, apply a severe penalty
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


class DomainScorer(BaseScorer):
    """
    Evaluates candidate domain alignment by checking keyword overlaps.
    """
    def score(self, candidate: Dict[str, Any], jd: Dict[str, Any], config: Dict[str, Any]) -> float:
        search_terms = ['ai', 'ml', 'nlp', 'data', 'cloud', 'search', 'vector', 'vision', 'deep learning', 'found founding', 'product', 'saas']
        
        career = candidate.get("career_history", [])
        history_text = " ".join([f"{job.get('title', '')} {job.get('company', '')} {job.get('description', '')}" for job in career]).lower()
        profile = candidate.get("profile", {})
        profile_text = f"{profile.get('headline', '')} {profile.get('summary', '')}".lower()
        combined_text = history_text + " " + profile_text
        
        score = 50.0
        matches_count = 0
        for term in search_terms:
            if term in combined_text:
                matches_count += 1
                
        score += matches_count * 5.0
        return min(100.0, max(0.0, score))


class SkillScorer(BaseScorer):
    """
    Evaluates hard/soft skill matches between candidate profile and JD criteria.
    """
    def score(self, candidate: Dict[str, Any], jd: Dict[str, Any], config: Dict[str, Any]) -> float:
        cand_skills = {s.get("name", "").lower().strip() for s in candidate.get("skills", []) if s.get("name")}
        
        req_skills = [s.lower().strip() for s in jd.get("required_skills", [])]
        pref_skills = [s.lower().strip() for s in jd.get("preferred_skills", [])]

        if not req_skills and not pref_skills:
            return 100.0

        req_score = 1.0
        if req_skills:
            req_matches = sum(1 for s in req_skills if s in cand_skills)
            req_score = req_matches / len(req_skills)

        pref_score = 1.0
        if pref_skills:
            pref_matches = sum(1 for s in pref_skills if s in cand_skills)
            pref_score = pref_matches / len(pref_skills)

        # Configurable overlay: 80% weight on required, 20% on preferred
        final_score = (req_score * 0.80 + pref_score * 0.20) * 100.0
        return min(100.0, max(0.0, final_score))


class ExperienceScorer(BaseScorer):
    """
    Evaluates candidate total years of experience, seniority title alignment,
    and applies a consulting firm filter if explicitly requested by the JD.
    """
    def score(self, candidate: Dict[str, Any], jd: Dict[str, Any], config: Dict[str, Any]) -> float:
        profile = candidate.get("profile", {})
        yoe = float(profile.get("years_of_experience", 0.0))
        
        # Load parameters from config.json
        exp_cfg = config.get("experience_bands", {})
        target_min = float(exp_cfg.get("target_min", 5.0))
        target_max = float(exp_cfg.get("target_max", 9.0))
        under_penalty = float(exp_cfg.get("under_qualified_penalty_per_year", 15.0))
        over_penalty = float(exp_cfg.get("over_qualified_penalty_per_year", 5.0))

        # Base YOE Score (100 base)
        score = 100.0
        if yoe < target_min:
            score -= (target_min - yoe) * under_penalty
        elif yoe > target_max:
            score -= (yoe - target_max) * over_penalty

        score = max(0.0, score)

        # Consulting company filter
        # Only check if JD explicitly sets prefer_product_company = True
        prefer_product = bool(jd.get("prefer_product_company", False))
        if prefer_product:
            filter_cfg = config.get("consulting_filter", {})
            consulting_firms = {name.lower().strip() for name in filter_cfg.get("companies", [])}
            penalty_multiplier = float(filter_cfg.get("penalty_multiplier", 0.50))

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

            # If they worked EXCLUSIVELY at consulting firms, apply the penalty multiplier
            if has_consulting and not has_product:
                score *= penalty_multiplier

        return min(100.0, max(0.0, score))


class EducationScorer(BaseScorer):
    """
    Evaluates school prestige tiers and target major alignment.
    """
    def score(self, candidate: Dict[str, Any], jd: Dict[str, Any], config: Dict[str, Any]) -> float:
        edu_list = candidate.get("education", [])
        if not edu_list:
            return 40.0 # Default baseline score

        edu_cfg = config.get("education_scoring", {})
        tier_scores = {
            "tier_1": float(edu_cfg.get("tier_1", 100.0)),
            "tier_2": float(edu_cfg.get("tier_2", 80.0)),
            "tier_3": float(edu_cfg.get("tier_3", 60.0)),
            "tier_4": float(edu_cfg.get("tier_4", 40.0)),
            "unknown": float(edu_cfg.get("unknown", 40.0))
        }
        boost_amount = float(edu_cfg.get("cs_major_boost", 20.0))
        cs_majors = {m.lower().strip() for m in edu_cfg.get("cs_majors", [])}

        best_score = 0.0

        for school in edu_list:
            tier = school.get("tier", "unknown").lower().strip()
            base_score = tier_scores.get(tier, tier_scores["unknown"])

            # Check field of study boost
            field = school.get("field_of_study", "").lower().strip()
            has_boost = False
            for major in cs_majors:
                if major in field:
                    has_boost = True
                    break
            
            school_score = base_score
            if has_boost:
                school_score += boost_amount
            
            if school_score > best_score:
                best_score = school_score

        return min(100.0, max(0.0, best_score))


class CareerProgressionScorer(BaseScorer):
    """
    Evaluates candidate job stability, average tenure, and title seniority trajectory.
    """
    def score(self, candidate: Dict[str, Any], jd: Dict[str, Any], config: Dict[str, Any]) -> float:
        career = candidate.get("career_history", [])
        if not career:
            return 50.0

        # 1. Average Tenure Stability (100 base)
        # Target average tenure is 2+ years (24 months). Penalize high frequency short-term job hops
        total_months = sum(int(j.get("duration_months", 0)) for j in career)
        avg_tenure_months = total_months / len(career)

        tenure_score = 100.0
        if avg_tenure_months < 12.0:
            tenure_score = 40.0  # Job hopping flag
        elif avg_tenure_months < 24.0:
            tenure_score = 70.0
        elif avg_tenure_months < 36.0:
            tenure_score = 90.0

        # 2. Seniority progression (checks if they climbed roles, e.g. engineer -> lead/manager)
        # Search for seniority keywords in chronological order (earliest first)
        seniority_keywords = ["lead", "senior", "head", "architect", "principal", "manager", "director"]
        progression_count = 0
        
        # Sort career roles chronologically by start date
        sorted_career = sorted(
            career, 
            key=lambda x: x.get("start_date") or "1970-01-01"
        )
        
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

        # Final aggregate career progression
        final_score = (tenure_score * 0.60) + (progression_score * 0.40)
        return min(100.0, max(0.0, final_score))


class AvailabilityScorer(BaseScorer):
    """
    Evaluates behavioural activity signals (login status, notice period constraints, response rates).
    """
    def score(self, candidate: Dict[str, Any], jd: Dict[str, Any], config: Dict[str, Any]) -> float:
        signals = candidate.get("redrob_signals", {})
        rules = config.get("availability_rules", {})

        # 1. Notice Period Decay
        notice = int(signals.get("notice_period_days", 0))
        notice_mult = 0.50
        for rule in rules.get("notice_period_days", []):
            if notice <= int(rule["limit"]):
                notice_mult = float(rule["multiplier"])
                break

        # 2. Last Active Decay
        now = datetime.now()
        active_str = signals.get("last_active_date")
        days_inactive = 365
        if active_str:
            try:
                active_dt = datetime.strptime(active_str, "%Y-%m-%d")
                days_inactive = (now - active_dt).days
            except ValueError:
                pass

        active_mult = 0.50
        for rule in rules.get("last_active_days", []):
            if days_inactive <= int(rule["limit"]):
                active_mult = float(rule["multiplier"])
                break

        # 3. Recruiter Response Rate Multiplier
        resp_rate = float(signals.get("recruiter_response_rate", 0.0))
        resp_mult = 0.60
        for rule in rules.get("response_rates", []):
            if resp_rate >= float(rule["limit"]):
                resp_mult = float(rule["multiplier"])
                break

        # Availability score represents the product of these modifiers
        availability_pct = notice_mult * active_mult * resp_mult
        return min(100.0, max(0.0, availability_pct * 100.0))
