"""Run from the backend folder (venv active):  python check_gemini.py"""
import time
from app.core.config import settings
from app.services import gemini

k = settings.GEMINI_API_KEY
print(f"Key loaded: {k[:4]}...{k[-3:]} (length {len(k)})" if k else "No key loaded!", flush=True)
try:
    print("Models your key can use for text (generateContent):", flush=True)
    names = []
    for m in gemini._get_client().models.list():
        acts = getattr(m, "supported_actions", None) or []
        if "generateContent" in acts and "flash" in (m.name or ""):
            names.append(m.name.replace("models/", ""))
    print("   " + ", ".join(sorted(names)), flush=True)
except Exception as e:
    print("   (could not list models:", str(e)[:120], ")", flush=True)

try:
    t = time.time()
    print("1/3 Embeddings...", flush=True)
    v = gemini.generate_embedding("hello recruiter")
    print(f"    OK - {len(v)} dims in {time.time()-t:.1f}s", flush=True)
    for model in gemini._models():
        t = time.time()
        print(f"2/3 Chat test with {model}...", flush=True)
        try:
            r = gemini._get_client().models.generate_content(model=model, contents="Reply with the single word: ready")
            print(f"    OK - replied {r.text.strip()!r} in {time.time()-t:.1f}s", flush=True)
        except Exception as e:
            print("    not available now:", str(e)[:160], flush=True)
    t = time.time()
    print("3/3 Job-description parsing (can take 10-30s)...", flush=True)
    p = gemini.parse_job_description("Senior ML Engineer, 4+ years, Python, PyTorch, MLOps, Docker.")
    print(f"    OK - {p.title}: {p.requiredSkills} ({time.time()-t:.1f}s)", flush=True)
    print("Gemini is working.")
except Exception as e:
    print("FAILED:", e)
