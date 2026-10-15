import os
import json
import logging
import argparse
import csv
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from anomaly import AnomalyDetector
import scorers

# Configure logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("Ranker")

def load_config(config_path: str) -> Dict[str, Any]:
    """
    Loads weights, bands, and filters dynamically from a JSON configuration file.
    """
    if not os.path.exists(config_path):
        logger.error("Configuration file not found: %s", config_path)
        raise FileNotFoundError(config_path)
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)

def load_precomputed_embeddings(data_dir: str) -> Tuple[Optional[np.ndarray], Dict[str, np.ndarray]]:
    """
    Loads pre-computed job description and candidate embeddings from binary files.
    """
    jd_vector_path = os.path.join(data_dir, "jd_embedding.npy")
    cand_vectors_path = os.path.join(data_dir, "candidate_embeddings.npz")

    jd_embed = None
    cand_embeds = {}

    if os.path.exists(jd_vector_path):
        jd_embed = np.load(jd_vector_path)
        logger.info("Loaded Job Description vector.")
    else:
        logger.warning("Job Description vector not found at %s. Semantic scoring will fallback.", jd_vector_path)

    if os.path.exists(cand_vectors_path):
        with np.load(cand_vectors_path) as loaded:
            for key in loaded.files:
                cand_embeds[key] = loaded[key]
        logger.info("Loaded %d candidate vectors from compressed archive.", len(cand_embeds))
    else:
        logger.warning("Candidate vectors archive not found at %s. Semantic scoring will fallback.", cand_vectors_path)

    return jd_embed, cand_embeds

def generate_reasoning(cand: Dict[str, Any], sub_scores: Dict[str, float], anomaly_status: str, reasons: List[str]) -> str:
    """
    Generates a structured, recruiter-friendly explainability justification.
    """
    profile = cand.get("profile", {})
    name = profile.get("anonymized_name", "Candidate")
    yoe = profile.get("years_of_experience", 0.0)
    title = profile.get("current_title", "Engineer")
    
    skills = [s.get("name", "") for s in cand.get("skills", [])[:3]]
    skills_str = ", ".join(skills)

    if anomaly_status == "HIGH":
        reason = reasons[0] if reasons else "Impossible chronological profile timeline"
        return f"Disqualified: {reason}."

    # Build standard positive highlights
    highlights = []
    if sub_scores.get("skills", 0.0) >= 80.0:
        highlights.append(f"strong match in core skills ({skills_str})")
    if sub_scores.get("experience", 0.0) >= 90.0:
        highlights.append(f"{yoe} years relevant experience matching target band")
    if sub_scores.get("semantic", 0.0) >= 70.0:
        highlights.append("high semantic alignment to JD requirements")

    highlight_str = ", with ".join(highlights) if highlights else f"moderate suitability as {title}"

    # Build warning/gap checks
    warnings = []
    if anomaly_status in ["MEDIUM", "LOW"]:
        warnings.append("profile anomaly flags present")
    notice = int(cand.get("redrob_signals", {}).get("notice_period_days", 0))
    if notice >= 90:
        warnings.append(f"long notice period ({notice} days)")
    
    warning_str = f" (Note: {', '.join(warnings)})" if warnings else ""

    reasoning = f"{title} with {yoe} YOE; demonstrates {highlight_str}{warning_str}."
    return reasoning

def rank_candidates(candidates_path: str, config_path: str, data_dir: str, limit: int) -> List[Dict[str, Any]]:
    """
    Executes the main candidate evaluation, scoring orchestrator, and sorting.
    """
    # 1. Load Configurations and Precomputed Embeddings
    config = load_config(config_path)
    jd_embed, cand_embeds = load_precomputed_embeddings(data_dir)

    # Reconstruct Job parameters
    jd_struct = {
        "embedding": jd_embed,
        "required_skills": [
            "embeddings", "vector databases", "Python", "evaluation frameworks", 
            "NDCG", "MRR", "MAP", "semantic search", "retrieval"
        ],
        "preferred_skills": [
            "fine-tuning", "LoRA", "QLoRA", "learning-to-rank", "distributed systems"
        ],
        "prefer_product_company": True # JD explicitly prefers startup/product companies and rejects consulting only
    }

    # 2. Register Independent Scorers dynamically (Open/Closed Principle)
    scorers_registry = {
        "semantic": scorers.SemanticScorer(),
        "skills": scorers.SkillScorer(),
        "experience": scorers.ExperienceScorer(),
        "education": scorers.EducationScorer(),
        "domain": scorers.DomainScorer(),
        "career_progression": scorers.CareerProgressionScorer(),
        "availability": scorers.AvailabilityScorer()
    }

    weights = config.get("weights", {})
    anomaly_penalties = config.get("anomaly_penalties", {})

    ranked_results: List[Dict[str, Any]] = []

    # 3. Stream Candidates & Run Evaluations
    logger.info("Streaming candidate files...")
    with open(candidates_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            cand = json.loads(line)
            cid = cand.get("candidate_id")

            # Link precomputed embedding if available
            cand["embedding"] = cand_embeds.get(cid)

            # A. Run Independent Anomaly Detector
            anomaly_res = AnomalyDetector.check_candidate(cand)
            status = anomaly_res["status"]
            reasons = anomaly_res["reasons"]

            # B. Execute Modular Scorers
            sub_scores: Dict[str, float] = {}
            for key, scorer in scorers_registry.items():
                try:
                    sub_scores[key] = scorer.score(cand, jd_struct, config)
                except Exception as ex:
                    logger.error("Scorer '%s' failed for candidate %s: %s", key, cid, ex)
                    sub_scores[key] = 0.0

            # C. Aggregate Weighted Composite Score (Orchestrated by engine)
            base_score = 0.0
            for key, val in sub_scores.items():
                base_score += val * weights.get(key, 0.0)

            # D. Apply Anomaly Penalties dynamically
            penalty = float(anomaly_penalties.get(status, 1.0))
            final_score = base_score * penalty

            # E. Generate Explainable Reasoning
            reasoning = generate_reasoning(cand, sub_scores, status, reasons)

            ranked_results.append({
                "candidate_id": cid,
                "score": round(final_score / 100.0, 4), # Scale back to 0.0 - 1.0 range for CSV
                "score_breakdown": sub_scores,
                "anomaly_status": status,
                "anomaly_reasons": reasons,
                "reasoning": reasoning
            })

            if limit > 0 and len(ranked_results) >= limit:
                break

    # 4. Deterministic Sort: Sort by Score (Desc), break ties by Candidate ID (Asc)
    # Python sorts are stable. We can perform a composite key sort:
    # Key = (-score, candidate_id)
    logger.info("Sorting evaluations...")
    ranked_results.sort(key=lambda x: (-x["score"], x["candidate_id"]))

    return ranked_results

def main():
    parser = argparse.ArgumentParser(description="Evaluate and Rank Candidates offline.")
    parser.add_argument("--candidates", type=str, required=True, help="Path to candidates.jsonl")
    parser.add_argument("--out", type=str, required=True, help="Output submission CSV path")
    parser.add_argument("--config", type=str, default="./scripts/config.json", help="Path to config.json")
    parser.add_argument("--data", type=str, default="./scripts/data", help="Data directory containing precomputed vectors")
    parser.add_argument("--limit", type=int, default=0, help="Process first N candidates only (0 = all)")

    args = parser.parse_args()

    # Run evaluations
    ranked = rank_candidates(args.candidates, args.config, args.data, args.limit)

    # Take Top 100
    top_100 = ranked[:100]

    # Write output to CSV
    logger.info("Writing submissions file to %s", args.out)
    with open(args.out, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["candidate_id", "rank", "score", "reasoning"])
        for i, cand in enumerate(top_100):
            writer.writerow([
                cand["candidate_id"],
                i + 1,
                f"{cand['score']:.4f}",
                cand["reasoning"]
            ])

    logger.info("Submission generated successfully with exactly %d rows.", len(top_100))

    # Run local validation check
    challenge_dir = r"G:\Project\hirewise-ai\data\[PUB] India_runs_data_and_ai_challenge\India_runs_data_and_ai_challenge"
    validator_path = os.path.join(challenge_dir, "validate_submission.py")
    if os.path.exists(validator_path):
        logger.info("Found validation script. Executing format tests...")
        import subprocess
        res = subprocess.run(["python", validator_path, args.out], capture_output=True, text=True)
        print(res.stdout)
        if res.returncode != 0:
            logger.error("Validation failed:\n%s", res.stderr)
        else:
            logger.info("Validation checks PASSED successfully.")

if __name__ == "__main__":
    main()
