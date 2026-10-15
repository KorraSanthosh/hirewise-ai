"""Role categories used to group candidates on the dashboard (title first, skills as a fallback)."""
import re
from typing import Iterable, List

OTHER = "Other"

# order matters: the first category whose title pattern matches wins
TITLE_RULES = [
    ("ML / AI Engineer", r"machine learning|\bml\b|\bai\b|deep learning|mlops|artificial intelligence|\bllm\b|\bnlp\b|computer vision|generative"),
    ("Data Scientist", r"data scien|statistician|research scientist|applied scientist|decision scien"),
    ("Data Engineer", r"data engineer|\betl\b|big data|analytics engineer|data platform|data architect"),
    ("Data / BI Analyst", r"data analyst|business analyst|\bbi\b|business intelligence|analytics|reporting analyst|insight"),
    ("Backend / Full-stack", r"backend|back-end|full.?stack|software engineer|software developer|\bsde\b|\bsoftware\b|python developer|java developer|api developer|programmer"),
    ("Frontend / UI", r"front.?end|\bui\b|\bux\b|react|web developer|angular|javascript developer"),
    ("DevOps / Cloud", r"devops|\bsre\b|cloud|platform engineer|infrastructure|site reliability|security engineer"),
    ("Product / Management", r"product manager|project manager|program manager|scrum|engineering manager|delivery manager|product owner"),
]

SKILL_RULES = [
    ("ML / AI Engineer", {"machine learning", "deep learning", "pytorch", "tensorflow", "mlops", "nlp", "computer vision", "llm", "large language models", "transformers", "keras", "generative ai"}),
    ("Data Scientist", {"statistics", "pandas", "numpy", "scikit-learn", "r", "hypothesis testing", "a/b testing", "data science", "regression"}),
    ("Data Engineer", {"spark", "airflow", "etl", "kafka", "hadoop", "dbt", "snowflake", "data pipelines", "databricks"}),
    ("Data / BI Analyst", {"tableau", "power bi", "excel", "sql", "looker", "data visualization"}),
    ("Backend / Full-stack", {"java", "spring", "django", "fastapi", "flask", "node.js", "go", "microservices", "rest apis", "postgresql", "mongodb"}),
    ("Frontend / UI", {"react", "angular", "vue", "javascript", "typescript", "html", "css"}),
    ("DevOps / Cloud", {"docker", "kubernetes", "terraform", "aws", "google cloud", "azure", "ci/cd", "jenkins", "linux"}),
]

CATEGORIES: List[str] = [c for c, _ in TITLE_RULES] + [OTHER]


def role_category(title: str, skills: Iterable[str] = ()) -> str:
    t = (title or "").lower()
    for cat, pat in TITLE_RULES:
        if re.search(pat, t):
            return cat
    have = {(s or "").lower().strip() for s in skills}
    best, best_n = OTHER, 0
    for cat, keys in SKILL_RULES:
        n = len(have & keys)
        if n > best_n:
            best, best_n = cat, n
    return best if best_n >= 2 else OTHER
