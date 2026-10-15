import os
import json
import logging
import argparse
import numpy as np
from typing import List, Dict, Any
import google.generativeai as genai
from tqdm import tqdm
import time

# Configure logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("Precompute")

def get_candidate_text(cand: Dict[str, Any]) -> str:
    """
    Creates a rich text representation of a candidate profile for embedding.
    """
    profile = cand.get("profile", {})
    headline = profile.get("headline", "")
    summary = profile.get("summary", "")
    current_title = profile.get("current_title", "")
    current_company = profile.get("current_company", "")
    
    skills = [s.get("name", "") for s in cand.get("skills", []) if s.get("name")]
    skills_str = ", ".join(skills)
    
    roles = []
    for job in cand.get("career_history", []):
        roles.append(f"{job.get('title', '')} at {job.get('company', '')}: {job.get('description', '')}")
    roles_str = " | ".join(roles)

    text = f"Title: {current_title} at {current_company}\nHeadline: {headline}\nSummary: {summary}\nSkills: {skills_str}\nExperience: {roles_str}"
    return text.strip()

def run_precompute(candidates_path: str, jd_path: str, output_dir: str, limit: int):
    """
    Orchestrates embedding precomputation using Google Gemini API.
    """
    # 1. Initialize Gemini API Client
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.error("Environment variable GEMINI_API_KEY not found. Cannot proceed.")
        raise ValueError("GEMINI_API_KEY is required")
    
    genai.configure(api_key=api_key)
    model_name = "models/gemini-embedding-001"

    os.makedirs(output_dir, exist_ok=True)
    jd_vector_path = os.path.join(output_dir, "jd_embedding.npy")
    cand_vectors_path = os.path.join(output_dir, "candidate_embeddings.npz")

    # 2. Embed Job Description
    logger.info("Reading Job Description from %s", jd_path)
    if not os.path.exists(jd_path):
        logger.error("Job Description path not found: %s", jd_path)
        raise FileNotFoundError(jd_path)
        
    with open(jd_path, "r", encoding="utf-8") as f:
        jd_text = f.read().strip()
    
    logger.info("Generating embedding for Job Description...")
    try:
        jd_result = genai.embed_content(
            model=model_name,
            content=jd_text,
            task_type="retrieval_document",
            output_dimensionality=768
        )
        jd_embedding = np.array(jd_result["embedding"], dtype=np.float32)
        np.save(jd_vector_path, jd_embedding)
        logger.info("Saved JD embedding to %s", jd_vector_path)
    except Exception as e:
        logger.error("Error generating JD embedding: %s", e)
        raise e

    # 3. Read Candidate Profiles
    logger.info("Reading candidates from %s", candidates_path)
    if not os.path.exists(candidates_path):
        logger.error("Candidates path not found: %s", candidates_path)
        raise FileNotFoundError(candidates_path)

    candidates: List[Dict[str, Any]] = []
    with open(candidates_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                candidates.append(json.loads(line))
            if limit > 0 and len(candidates) >= limit:
                break
    
    logger.info("Loaded %d candidates. Starting batch embedding generation...", len(candidates))
    
    # Cache to allow incremental resumes
    embeddings_cache: Dict[str, List[float]] = {}
    if os.path.exists(cand_vectors_path):
        try:
            with np.load(cand_vectors_path) as loaded:
                for k in loaded.files:
                    embeddings_cache[k] = loaded[k].tolist()
            logger.info("Found existing cache at %s with %d entries.", cand_vectors_path, len(embeddings_cache))
        except Exception:
            logger.warning("Could not load existing cache archive. Will overwrite.")

    batch_size = 50
    candidates_to_embed = [c for c in candidates if c.get("candidate_id") not in embeddings_cache]
    logger.info("Remaining candidates to embed: %d", len(candidates_to_embed))

    if not candidates_to_embed:
        logger.info("All candidates already cached.")
        return

    # Ingest in batches to handle rate limits gracefully
    for i in tqdm(range(0, len(candidates_to_embed), batch_size), desc="Embedding Batches"):
        batch = candidates_to_embed[i : i + batch_size]
        batch_ids = [c["candidate_id"] for c in batch]
        batch_texts = [get_candidate_text(c) for c in batch]
        
        retries = 3
        while retries > 0:
            try:
                response = genai.embed_content(
                    model=model_name,
                    content=batch_texts,
                    task_type="retrieval_document",
                    output_dimensionality=768
                )
                embeddings = response["embedding"]
                
                # Save to cache
                for cid, vec in zip(batch_ids, embeddings):
                    embeddings_cache[cid] = vec
                
                # Batch throttling limit to prevent API rate-limit exhaustion
                time.sleep(0.5) 
                break
            except Exception as ex:
                retries -= 1
                logger.warning("API Error: %s. Retries remaining: %d. Waiting 5s...", ex, retries)
                time.sleep(5)
        
        if retries == 0:
            logger.error("Failed to complete batch embedding generation. Exiting early.")
            break

        # Periodically save progress every 500 records
        if (i // batch_size) % 10 == 0:
            # Convert cache to numpy binaries and save
            save_dict = {k: np.array(v, dtype=np.float32) for k, v in embeddings_cache.items()}
            np.savez_compressed(cand_vectors_path, **save_dict)

    # Save final complete index
    save_dict = {k: np.array(v, dtype=np.float32) for k, v in embeddings_cache.items()}
    np.savez_compressed(cand_vectors_path, **save_dict)
    logger.info("Successfully completed precomputation. Cache size: %d vectors.", len(embeddings_cache))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Precompute JD and Candidate embeddings offline.")
    parser.add_argument("--candidates", type=str, required=True, help="Path to candidates.jsonl")
    parser.add_argument("--jd", type=str, required=True, help="Path to job_description.txt")
    parser.add_argument("--outdir", type=str, default="./scripts/data", help="Output directory for embeddings")
    parser.add_argument("--limit", type=int, default=0, help="Maximum number of candidates to process (0 = all)")
    
    args = parser.parse_args()
    
    run_precompute(args.candidates, args.jd, args.outdir, args.limit)
