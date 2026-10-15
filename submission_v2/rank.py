#!/usr/bin/env python3
"""Redrob hackathon ranker (v2). Rule-based, CPU-only, offline, single pass.

Usage: python rank.py --candidates ./candidates.jsonl --out ./submission.csv
Signals: role/title fit, career-history evidence (retrieval/ranking/recsys/eval shipped
in production), trust-weighted skills, experience band, behavioural availability,
JD disqualifiers (consulting-only, research-only, CV/speech-only), honeypot filter.
"""
import argparse, csv, gzip, json, re, sys, hashlib
from datetime import date

REF_DATE = date(2026, 5, 27)  # latest last_active_date in the pool -> reproducible

TITLE_STRONG = {"search engineer", "recommendation systems engineer", "nlp engineer", "senior nlp engineer",
    "machine learning engineer", "senior machine learning engineer", "staff machine learning engineer",
    "applied ml engineer", "senior applied scientist", "ai engineer", "senior ai engineer", "lead ai engineer"}
TITLE_MID = {"ml engineer": .8, "senior software engineer (ml)": .8, "data scientist": .65, "senior data scientist": .72,
    "ai specialist": .6, "ai research engineer": .5, "junior ml engineer": .45}
TITLE_LOW = {"computer vision engineer": .2, "data engineer": .25, "senior data engineer": .28, "analytics engineer": .2,
    "backend engineer": .22, "senior software engineer": .22, "software engineer": .15, "data analyst": .1,
    "cloud engineer": .1, "devops engineer": .1, "full stack developer": .1, "java developer": .08, ".net developer": .06}

def title_score(t):
    t = (t or "").lower().strip()
    if t in TITLE_STRONG: return 1.0
    if t in TITLE_MID: return TITLE_MID[t]
    return TITLE_LOW.get(t, 0.03)

# career-description evidence groups: (name, regex, weight)
EVID = [
  ("retrieval", r"embedding|vector (search|index|database|db)|hybrid (retrieval|search)|bm25|dense retriev|semantic search|retrieval|index refresh|faiss|opensearch|elasticsearch|pinecone|qdrant|milvus|weaviate", 1.0),
  ("ranking", r"\branking|learning[- ]to[- ]rank|re-?rank|ndcg|\bmrr\b|relevance (label|model|tuning)|query understanding", 1.0),
  ("recsys", r"recommendation (system|engine)|collaborative filtering|matrix factori[sz]ation|cold[- ]start", 0.9),
  ("eval", r"a/b test|offline (eval|benchmark|experiment)|eval(uation)? (harness|framework|pipeline)|online experiment", 0.7),
  ("llm", r"fine-?tun|lora|qlora|\bpeft\b|\bllm|sentence-transformer|rag\b", 0.6),
  ("prod", r"production|shipped|deployed|latency|serving|live (a/b|traffic)|millions? of (users|queries)|\d+m\+ users", 0.5),
]
EVID_RE = [(n, re.compile(p, re.I), w) for n, p, w in EVID]
RESEARCH_RE = re.compile(r"academic lab|research (lab|group|scientist)|published|\bpapers?\b|thesis|phd research|no production", re.I)
CV_RE = re.compile(r"computer vision|object detection|image (classification|segmentation)|\byolo\b|speech|robotic|\basr\b|\btts\b|autonomous", re.I)
NLP_IR_RE = re.compile(r"\bnlp\b|natural language|retriev|search|ranking|recommend|text|language model|llm", re.I)

CORE_SKILLS = {  # name(lower) -> weight
 "embeddings":1.0, "sentence transformers":1.0, "vector representations":.8, "faiss":1.0, "pinecone":.9, "qdrant":.9, "weaviate":.9,
 "milvus":.9, "opensearch":.9, "elasticsearch":.9, "pgvector":.8, "bm25":1.0, "information retrieval systems":1.0,
 "information retrieval":1.0, "semantic search":1.0, "rag":.7, "recommendation systems":1.0, "learning to rank":1.0,
 "ndcg":1.0, "python":.7, "nlp":.7, "natural language processing":.7, "lora":.5, "qlora":.5, "peft":.5, "fine-tuning llms":.6,
 "content matching":.6, "haystack":.4, "llamaindex":.3, "langchain":.15, "pytorch":.4, "mlops":.3, "feature engineering":.4,
 "xgboost":.5, "machine learning":.35, "deep learning":.3, "a/b testing":.6, "mlflow":.2}
PROF_W = {"beginner":.3, "intermediate":.6, "advanced":.85, "expert":1.0}
CONSULT = ("tcs","infosys","wipro","accenture","cognizant","capgemini","tata consultancy","mindtree","tech mahindra","hcl","l&t infotech","lti ")
INDIA_PREF = {"pune","noida"}
INDIA_OK = {"hyderabad","mumbai","delhi","gurgaon","gurugram","bangalore","bengaluru","new delhi","ghaziabad","faridabad","navi mumbai","thane","chennai"}

def parse_d(s):
    try: y,m,d = s.split("-"); return date(int(y),int(m),int(d))
    except Exception: return None

def honeypot(c):
    """Return list of reasons the profile is impossible/inconsistent (tier-0 candidates)."""
    p=c["profile"]; yoe=float(p.get("years_of_experience") or 0); r=[]
    cur=c["career_history"]; edu=c.get("education",[])
    for j in cur:
        if j["duration_months"] > yoe*12 + 3: r.append("job longer than stated experience")
        a,b = parse_d(j["start_date"]), parse_d(j["end_date"]) if j.get("end_date") else None
        if a and b and a>b: r.append("job ends before it starts")
        if a and a>REF_DATE: r.append("future start date")
        if a and b:
            real=(b.year-a.year)*12+b.month-a.month
            if abs(real-j["duration_months"])>14: r.append("duration inconsistent with dates")
    for e in edu:
        if e["start_year"]>e["end_year"]: r.append("education reversed")
    ws=[parse_d(j["start_date"]).year for j in cur if parse_d(j["start_date"])]
    es=[e["start_year"] for e in edu]
    if ws and es and min(es)-min(ws)>6: r.append("worked years before degree")
    tot=sum(j["duration_months"] for j in cur)
    if tot > yoe*12+30: r.append("cumulative tenure exceeds experience")
    zero=[s for s in c["skills"] if s["proficiency"] in("expert","advanced") and (s.get("duration_months") or 0)==0]
    if len(zero)>=4: r.append("expert skills with zero usage")
    over=[s for s in c["skills"] if (s.get("duration_months") or 0) > yoe*12+24]
    if len(over)>=3: r.append("skill use longer than career")
    return r

def evidence(c):
    """Recency-weighted career evidence. Returns (score 0..1, hit group names)."""
    hits={}; total=0.0
    jobs=c["career_history"]
    for i,j in enumerate(jobs):  # file lists most recent first
        txt=j["description"]
        rec = 1.0 if (j.get("is_current") or i==0) else (0.8 if i==1 else 0.6)
        jt=j["title"].lower()
        titled = 1.0 if title_score(jt)>=.6 else 0.5
        s=0.0
        for n,rx,w in EVID_RE:
            if rx.search(txt):
                s+=w; hits[n]=hits.get(n,0)+1
        total += min(s,3.2)*rec*titled
    ev = min(1.0, total/5.0)
    return ev, hits

def skill_score(c):
    s=0.0; used=[]
    yoe=float(c["profile"].get("years_of_experience") or 0)
    for k in c["skills"]:
        w=CORE_SKILLS.get(k["name"].lower())
        if not w: continue
        dur=k.get("duration_months") or 0
        if dur<=0: continue
        trust = PROF_W.get(k["proficiency"],.5) * min(1.0,dur/24.0) * (0.6+0.4*min(1.0,(k.get("endorsements") or 0)/20.0))
        if dur > yoe*12+12: trust*=0.5  # implausible usage length
        s+=w*trust; used.append((w*trust,k["name"],k["proficiency"],dur))
    used.sort(reverse=True)
    return min(1.0, s/6.0), used

def exp_fit(y):
    if 6<=y<=8: return 1.0
    if 5<=y<=9: return .93
    if 4<=y<5 or 9<y<=11: return .72
    if 3<=y<4 or 11<y<=13: return .5
    return .3 if y>=2 else .15

def consulting_only(c):
    jobs=c["career_history"]
    return all(any(k in j["company"].lower() for k in CONSULT) for j in jobs)

def availability(c):
    s=c["redrob_signals"]
    la=parse_d(s["last_active_date"]); days=(REF_DATE-la).days if la else 400
    act = 1.0 if days<=30 else .93 if days<=60 else .82 if days<=120 else .62 if days<=200 else .4
    rr=s["recruiter_response_rate"]
    resp = .55+.45*min(1.0,rr/0.6)
    otw = 1.0 if s["open_to_work_flag"] else .88
    n=s["notice_period_days"]
    notice = 1.0 if n<=30 else .95 if n<=45 else .88 if n<=60 else .78 if n<=90 else .65
    comp = 0.95+0.05*(s["interview_completion_rate"])
    return act*resp*otw*notice*comp, days

def location_factor(c):
    p=c["profile"]; loc=(p.get("location") or "").lower(); country=(p.get("country") or "").lower()
    reloc=c["redrob_signals"]["willing_to_relocate"]
    if country=="india":
        if any(x in loc for x in INDIA_PREF): return 1.0
        if any(x in loc for x in INDIA_OK): return .97
        return .93 if reloc else .88
    return .8 if reloc else .62

def tenure_factor(c):
    jobs=c["career_history"]
    if len(jobs)<3: return 1.0
    avg=sum(j["duration_months"] for j in jobs)/len(jobs)
    return 1.0 if avg>=20 else .92 if avg>=15 else .82

def score(c):
    p=c["profile"]
    ts=title_score(p["current_title"])
    past=max((title_score(j["title"]) for j in c["career_history"]),default=0)
    tsc=max(ts, .75*past)
    ev,hits=evidence(c); sk,used=skill_score(c)
    yoe=float(p["years_of_experience"])
    base = .30*tsc + .38*ev + .17*sk + .15*exp_fit(yoe)
    # gate: non-ML role with no real evidence can't score high regardless of keywords
    if ts<.3 and ev<.25: base*=.35
    allt=" ".join(j["description"] for j in c["career_history"])+" "+p["summary"]
    notes=[]
    if consulting_only(c): base*=.55; notes.append("consulting-only career")
    if CV_RE.search(allt) and not NLP_IR_RE.search(allt): base*=.5; notes.append("cv/speech focus")
    elif ts<.3 and len(CV_RE.findall(allt))>=3: base*=.7
    if RESEARCH_RE.search(allt) and not re.search(r"production|shipped|deployed",allt,re.I): base*=.5; notes.append("research-only")
    if "ai research" in p["current_title"].lower() and "production" not in allt.lower(): base*=.7
    if re.search(r"langchain|openai",allt,re.I) and not hits.get("retrieval") and not hits.get("ranking") and not hits.get("recsys"): base*=.8
    av,days=availability(c)
    final = base*av*location_factor(c)*tenure_factor(c)
    hp=honeypot(c)
    if hp: final*=0.02
    return final, dict(ts=ts,ev=ev,hits=hits,sk=sk,used=used,days=days,hp=hp,notes=notes,tsc=tsc)

PHR = {
 "retrieval":"embedding/vector retrieval work", "ranking":"ranking and relevance work", "recsys":"recommendation-system delivery",
 "eval":"A/B and offline evaluation", "llm":"LLM/embedding-model work"}

def build_reasoning(c, info, rank):
    p=c["profile"]; s=c["redrob_signals"]; h=int(hashlib.md5(c["candidate_id"].encode()).hexdigest(),16)
    yoe=p["years_of_experience"]; title=p["current_title"]; comp=p["current_company"]
    topsk=[f'{n} ({pr}, {d}mo)' for _,n,pr,d in info["used"][:3]]
    ev=[PHR[k] for k in ("retrieval","ranking","recsys","eval","llm") if info["hits"].get(k)]
    cons=[]
    if s["notice_period_days"]>=90: cons.append(f'{s["notice_period_days"]}-day notice period')
    elif s["notice_period_days"]>60: cons.append(f'{s["notice_period_days"]}-day notice')
    if info["days"]>120: cons.append(f'last active {info["days"]} days before the data cut-off')
    if s["recruiter_response_rate"]<.3: cons.append(f'low recruiter response rate ({s["recruiter_response_rate"]:.2f})')
    if p["country"].lower()!="india": cons.append(f'based in {p["country"]}' + ("" if s["willing_to_relocate"] else " and not open to relocating"))
    elif not any(x in p["location"].lower() for x in INDIA_PREF|INDIA_OK) and not s["willing_to_relocate"]: cons.append(f'{p["location"].split(",")[0]}-based, not willing to relocate')
    if yoe<5: cons.append(f'{yoe} yrs is below the 5-9 band')
    elif yoe>9: cons.append(f'{yoe} yrs is above the 5-9 band')
    if info["notes"]: cons+= info["notes"]
    if not topsk and not ev: cons.append("little direct retrieval/ranking evidence")
    jobs=len(c["career_history"])
    if jobs>=3 and sum(j["duration_months"] for j in c["career_history"])/jobs<15: cons.append("short average tenure")
    tier = "strong" if rank<=15 else "good" if rank<=60 else "partial"
    evs = ", ".join(ev[:3]) if ev else "limited direct ranking/retrieval evidence"
    sk = "; ".join(topsk) if topsk else "few trusted core skills"
    eng = f'last active {info["days"]}d ago, response rate {s["recruiter_response_rate"]:.2f}, notice {s["notice_period_days"]}d'
    openers = {
     "strong":[f"{title} at {comp}, {yoe} yrs: career history shows {evs}, which maps directly to the JD's retrieval/ranking mandate.",
               f"{yoe} yrs as {title} ({comp}); history documents {evs}, the core of this role.",
               f"Closest fit to the JD: {title} with {yoe} yrs and {evs} in past roles."],
     "good":[f"{title} at {comp} with {yoe} yrs; career shows {evs}, a solid but not perfect match to the JD.",
             f"Relevant {title} ({yoe} yrs, {comp}) with {evs}.",
             f"{yoe} yrs, {title}; evidence of {evs}, somewhat narrower than the top candidates."],
     "partial":[f"Credible but lower-ranked: {title} at {comp}, {yoe} yrs, with {evs}.",
                f"{title} ({yoe} yrs, {comp}) with {evs}; ranked lower on weaker overall fit than the leaders.",
                f"{title}, {yoe} yrs; {evs}, trailing the top group on role fit and availability."]}[tier]
    out = openers[h%3] + f" Skills with real usage: {sk}. Engagement: {eng}."
    if cons: out += " Concerns: " + "; ".join(cons[:3]) + "."
    return out

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--candidates",required=True); ap.add_argument("--out",required=True)
    ap.add_argument("--debug",default=None); a=ap.parse_args()
    op = gzip.open if a.candidates.endswith(".gz") else open
    res=[]
    with op(a.candidates,"rt",encoding="utf-8") as f:
        for line in f:
            if not line.strip(): continue
            c=json.loads(line); sc,info=score(c)
            res.append((sc,c["candidate_id"],c,info))
    res.sort(key=lambda x:(-round(x[0],6),x[1]))
    top=res[:100]
    with open(a.out,"w",encoding="utf-8",newline="") as f:
        w=csv.writer(f); w.writerow(["candidate_id","rank","score","reasoning"])
        for i,(sc,cid,c,info) in enumerate(top,1):
            w.writerow([cid,i,f"{round(sc,6):.6f}",build_reasoning(c,info,i)])
    if a.debug:
        with open(a.debug,"w") as f:
            for i,(sc,cid,c,info) in enumerate(res[:300],1):
                f.write(json.dumps(dict(rank=i,id=cid,score=sc,title=c["profile"]["current_title"],yoe=c["profile"]["years_of_experience"],
                  hits=info["hits"],ts=info["ts"],ev=info["ev"],sk=info["sk"],hp=info["hp"],notes=info["notes"]))+"\n")
if __name__=="__main__": main()
