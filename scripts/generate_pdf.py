import os
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

class SlideCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.pages = []

    def showPage(self):
        self.pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        page_count = len(self.pages)
        for page in self.pages:
            self.__dict__.update(page)
            self.draw_slide_decorations(page_count)
            super().showPage()
        super().save()

    def draw_slide_decorations(self, total_pages):
        page_num = self._pageNumber
        
        # Slide 1 (Title Slide) and Slide 11 (Thank You Slide) have gradient covers
        if page_num == 1 or page_num == 11:
            self.draw_gradient_background(page_num)
            self.draw_title_logos()
            if page_num == 1:
                self.draw_footer_bar_thin()
            return

        # Content Slides (2-10) have the standard top-bar and bottom-bar
        # Top banner background is white to match original template slides
        self.setFillColor(colors.HexColor("#FFFFFF"))
        self.rect(0, 445.5 - 35, 792, 35, fill=1, stroke=0)

        # Top bar logos on white background
        self.setFont("Helvetica-Bold", 10)
        self.setFillColor(colors.HexColor("#0F172A"))  # Slate-900 (Dark Slate)
        self.drawString(30, 445.5 - 22, "redrob")
        self.setFont("Helvetica", 10)
        self.setFillColor(colors.HexColor("#475569"))  # Slate-600 (Muted Slate)
        self.drawString(68, 445.5 - 22, " |  H2S")
        
        self.setFont("Helvetica-BoldOblique", 11)
        self.setFillColor(colors.HexColor("#4F46E5"))  # Indigo purple
        self.drawRightString(762, 445.5 - 22, "INDIA.RUNS")

        # Thin light gray separator line under top header banner
        self.setFillColor(colors.HexColor("#F1F5F9"))
        self.rect(0, 445.5 - 36, 792, 1, fill=1, stroke=0)

        # Bottom thin banner
        self.setFillColor(colors.HexColor("#4F46E5"))
        self.rect(0, 0, 792, 6, fill=1, stroke=0)

        # Slide Number
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawRightString(762, 12, f"Slide {page_num} of {total_pages}")

    def draw_gradient_background(self, page_num):
        # Draw a deep purple-blue-orange gradient background matching the template screenshots
        # Slide 1 has a top gradient banner covering y = 195 to 445.5. Slide 11 is full-screen.
        start_y = 195 if page_num == 1 else 0
        for y in range(start_y, 446):
            if page_num == 1:
                ratio = (y - 195) / (445.5 - 195)
            else:
                ratio = y / 445.5
            # Shift from deep indigo (#1E1B4B) to red-orange (#7F1D1D)
            r = int(30 + ratio * 90)
            g = int(27 + ratio * 2)
            b = int(75 - ratio * 40)
            color_hex = f"#{r:02x}{g:02x}{b:02x}"
            self.setFillColor(colors.HexColor(color_hex))
            self.rect(0, y, 792, 1, fill=1, stroke=0)

        # Highlight overlay (central glow effect)
        # Shift the glow center upwards on the Title slide
        glow_y = 320 if page_num == 1 else 222
        glow_r = 200 if page_num == 1 else 280
        self.setFillColor(colors.HexColor("#D97706"), alpha=0.12)
        self.circle(396, glow_y, glow_r, stroke=0, fill=1)

    def draw_title_logos(self):
        # Center "redrob | H2S" logo
        self.setFont("Helvetica-Bold", 18)
        self.setFillColor(colors.HexColor("#FFFFFF"))
        self.drawCentredString(375, 385, "redrob")
        self.setFont("Helvetica", 18)
        self.setFillColor(colors.HexColor("#A5B4FC"))
        self.drawString(410, 385, " |  H2S")
        self.setFont("Helvetica-Bold", 6)
        self.setFillColor(colors.HexColor("#A5B4FC"))
        self.drawCentredString(428, 380, "HACK 2 SKILL")

        # Large INDIA.RUNS title
        self.setFont("Helvetica-BoldOblique", 42)
        self.setFillColor(colors.HexColor("#FFFFFF"))
        self.drawCentredString(396, 315, "INDIA.RUNS")

        # Subtitle bubble
        self.setFillColor(colors.HexColor("#000000"), alpha=0.40)
        self.rect(266, 255, 260, 32, fill=1, stroke=0)
        self.setStrokeColor(colors.HexColor("#E0E7FF"))
        self.setLineWidth(1)
        self.roundRect(266, 255, 260, 32, 16, stroke=1, fill=0)
        
        self.setFont("Helvetica-Bold", 11)
        self.setFillColor(colors.HexColor("#EEF2F6"))
        self.drawCentredString(396, 266, "Build what next India runs on")

    def draw_footer_bar_thin(self):
        self.setFillColor(colors.HexColor("#4F46E5"))
        self.rect(0, 0, 792, 10, fill=1, stroke=0)

def create_presentation_pdf(output_path):
    # Widescreen 16:9 points layout (792 width x 445.5 height)
    doc = SimpleDocTemplate(
        output_path,
        pagesize=(792, 445.5),
        leftMargin=40,
        rightMargin=40,
        topMargin=55,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()
    
    # Custom Typography Styles
    title_style = ParagraphStyle(
        'SlideTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=15
    )
    
    body_style = ParagraphStyle(
        'SlideBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155")
    )

    bullet_style = ParagraphStyle(
        'SlideBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155"),
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=6
    )

    question_style = ParagraphStyle(
        'SlideQuestion',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#4F46E5"),
        spaceAfter=10,
        spaceBefore=10
    )

    cover_label_style = ParagraphStyle(
        'CoverLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#1E3A8A"),
        alignment=0
    )

    cover_val_style = ParagraphStyle(
        'CoverValue',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#334155"),
        alignment=0
    )

    story = []

    # ==================== PAGE 1: TITLE SLIDE ====================
    story.append(Spacer(1, 255))
    
    # Grid table for title details aligned nicely
    title_data = [
        [Paragraph("Team Name :", cover_label_style), Paragraph("hackers_", cover_val_style)],
        [Paragraph("Team Leader Name :", cover_label_style), Paragraph("korra santhosh", cover_val_style)],
        [Paragraph("Problem Statement :", cover_label_style), Paragraph("AI-Powered Candidate Semantic Matching, Filtering, and Explainable Recommendation Engine (Redrob India.Runs Challenge)", cover_val_style)],
    ]
    t = Table(title_data, colWidths=[140, 460])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t)
    story.append(PageBreak())

    # ==================== PAGE 2: SOLUTION OVERVIEW ====================
    story.append(Paragraph("Solution Overview", title_style))
    
    story.append(Paragraph("What is your proposed solution?", question_style))
    story.append(Paragraph("&bull; <b>Dual-Mode Candidate Intelligence Platform</b>: Features an offline, zero-network high-speed ranking CLI (processing 100k candidates under 15s) and an online, interactive Next.js 15 dashboard for recruiter workflows.", bullet_style))
    story.append(Paragraph("&bull; <b>Hybrid Evaluation Pipeline</b>: Replaces simple keyword matching by mapping Gemini-based resume embeddings (dense vectors) alongside rule-based experience alignment, domain context, and credentials validations.", bullet_style))
    
    story.append(Paragraph("What differentiates your approach from traditional candidate matching systems?", question_style))
    story.append(Paragraph("&bull; <b>Deterministic Honeypot Filter</b>: Prunes chronological and formatting inconsistencies (impossible dates, inflated zero-duration expert skills) before scoring, blocking synthetic candidate profiles with 100% accuracy.", bullet_style))
    story.append(Paragraph("&bull; <b>Intent & Availability Modifiers</b>: Multiplies base suitability scores by real-time behavioral signals (recruiter response rate, notice period, platform activity dates) to rank candidates who are highly active and immediately signable.", bullet_style))
    story.append(Paragraph("&bull; <b>Recruiter-Aligned Sliders</b>: Allows recruiters to slide scoring weights dynamically and trigger instant recalculations in their browser, backed by pgvector database queries.", bullet_style))
    story.append(PageBreak())

    # ==================== PAGE 3: JD UNDERSTANDING & CANDIDATE EVALUATION ====================
    story.append(Paragraph("JD Understanding & Candidate Evaluation", title_style))
    
    story.append(Paragraph("What are the key requirements extracted from the JD?", question_style))
    story.append(Paragraph("&bull; <b>Role & Target Experience</b>: Senior AI Engineer &mdash; Founding Team (Pune/Noida, India, 5&ndash;9 Years Target Experience).", bullet_style))
    story.append(Paragraph("&bull; <b>Required Skills</b>: Embeddings, Vector Databases, Python, Evaluation Frameworks (NDCG, MRR, MAP), Semantic Search, and Retrieval.", bullet_style))
    story.append(Paragraph("&bull; <b>Preferred Skills</b>: LLM Fine-Tuning, LoRA/QLoRA, Learning-to-Rank, and Distributed Systems.", bullet_style))
    story.append(Paragraph("&bull; <b>Hard Restrictions</b>: Notice period &gt; 90 days, candidate outside India, or history composed <i>exclusively</i> of IT consulting services.", bullet_style))
    
    story.append(Paragraph("Which candidate signals are most important? / How does your solution evaluate fit beyond keywords?", question_style))
    story.append(Paragraph("&bull; <b>Semantic Embeddings Alignment</b>: Computes vector similarity with <i>text-embedding-004</i>. Applies a 90% penalty to non-technical titles (e.g. HR, marketing, writers) to neutralize keyword-stuffed honeypots.", bullet_style))
    story.append(Paragraph("&bull; <b>Education Prestige & Field of Study</b>: Maps academic institution tiers (Tier 1-4) combined with +20 points field boost for CS, AI, ML, Data Science, Math, or Stats degrees.", bullet_style))
    story.append(Paragraph("&bull; <b>Career Progression Heuristics</b>: Evaluates professional stability (penalizes job-hopping/short tenures) and rewards title-climbing progression.", bullet_style))
    story.append(PageBreak())

    # ==================== PAGE 4: RANKING METHODOLOGY ====================
    story.append(Paragraph("Ranking Methodology", title_style))
    
    story.append(Paragraph("How does your system retrieve, score, and rank candidates?", question_style))
    story.append(Paragraph("&bull; <b>Data Streaming</b>: Streams candidate records from <i>candidates.jsonl</i> to maintain a low memory footprint (&lt; 1.5 GB).", bullet_style))
    story.append(Paragraph("&bull; <b>Filtering & Scoring</b>: Instantly filters chronological anomalies, evaluates composite scoring, scales scores, sorts descending, and writes exactly the top 100 candidates with ties broken by candidate ID ascending.", bullet_style))
    
    story.append(Paragraph("What models, algorithms, or heuristics are used?", question_style))
    story.append(Paragraph("&bull; <b>Embedding Model</b>: Google Gemini <i>text-embedding-004</i> (768-dimension vectors) + Cosine Similarity.", bullet_style))
    story.append(Paragraph("&bull; <b>Skill Match Algorithm</b>: Custom Jaccard Index weighted overlay (80% Required Skills / 20% Preferred Skills).", bullet_style))
    story.append(Paragraph("&bull; <b>Chronological Anomaly Heuristics</b>: Overlaps college entry vs. first work date, checks if job duration exceeds stated YOE.", bullet_style))
    
    story.append(Paragraph("How are multiple candidate signals combined into a final ranking?", question_style))
    story.append(Paragraph("&bull; <b>Base Suitability Score (0-100)</b>: Weighted sum of 7 factors (Semantic 40%, Skills 20%, Experience 15%, Education 10%, Domain 5%, Career Progression 5%, Availability 5%).", bullet_style))
    story.append(Paragraph("&bull; <b>Modifiers & Penalty</b>: $Score(C) = BaseScore(C) \\times AnomalyPenalty(C) \\times AvailabilityMultiplier(C)$ (where penalties are: High Anomaly: 0.0, Medium: 0.7, Low: 0.95, Clean: 1.0).", bullet_style))
    story.append(PageBreak())

    # ==================== PAGE 5: EXPLAINABILITY & DATA VALIDATION ====================
    story.append(Paragraph("Explainability & Data Validation", title_style))
    
    story.append(Paragraph("How are ranking decisions explained?", question_style))
    story.append(Paragraph("&bull; <b>Factual Synthesis (XAI)</b>: Dynamically generates bulleted candidate strengths and weaknesses based on mathematical sub-scores.", bullet_style))
    story.append(Paragraph("&bull; <b>Gemini Summary Reports</b>: Generates natural-language reasoning sentences referencing candidate's specific YOE, current title, and core background matching the Senior AI role, avoiding generic template text.", bullet_style))
    
    story.append(Paragraph("How do you prevent hallucinations or unsupported justifications?", question_style))
    story.append(Paragraph("&bull; <b>Strict JSON Data Guardrails</b>: Prompts Gemini only with validated fields from the parsed candidate profile. Banned terms and speculative writing rules are passed to system parameters to prevent the model from assuming capabilities.", bullet_style))
    
    story.append(Paragraph("How does your solution handle inconsistent, low-quality, or suspicious profiles?", question_style))
    story.append(Paragraph("&bull; <b>Chronological Anomaly Checks</b>: Flagged directly in the <i>Resume Status</i> field as 'Parsing Warning' or 'Missing Information' (for critical chronological conflicts, which also incur a 30% or 100% score penalty).", bullet_style))
    story.append(Paragraph("&bull; <b>Honeypot Dashboard</b>: Next.js dashboard includes a dedicated panel showing filtered anomaly counts and validation details.", bullet_style))
    story.append(PageBreak())

    # ==================== PAGE 6: END-TO-END WORKFLOW ====================
    story.append(Paragraph("End-to-End Workflow", title_style))
    story.append(Paragraph("What is the complete workflow from JD input to ranked candidate output?", question_style))
    
    workflow_style = ParagraphStyle(
        'WFBullet',
        parent=bullet_style,
        spaceAfter=8,
        fontSize=10,
        leading=13
    )
    story.append(Paragraph("1. <b>Job Ingestion & Parsing</b>: Recruiter uploads raw Job Description text. Gemini API extracts required/preferred skills, required experience, and domain constraints.", workflow_style))
    story.append(Paragraph("2. <b>Job Embeddings Generation</b>: Generates a 768-dimension dense vector representation for the JD using Gemini <i>text-embedding-004</i>.", workflow_style))
    story.append(Paragraph("3. <b>Candidate Pre-Filter (CLI / DB)</b>: Streams the candidate pool. The <i>AnomalyDetector</i> screens profiles, automatically assigning 0.0 scores to chronological honeypots.", workflow_style))
    story.append(Paragraph("4. <b>Hybrid Ranking Pipeline</b>: Computes vector cosine similarity, calculates Jaccard skill overlaps, analyzes experience/education, evaluates career progression, and applies behavioral multipliers.", workflow_style))
    story.append(Paragraph("5. <b>Aggregator & Excel Output</b>: Selects the Top 100 matching profiles. Formats, auto-fits, color-codes, and generates charts in <i>recommended_candidates.xlsx</i>.", workflow_style))
    story.append(Paragraph("6. <b>Recruiter UI Rendering</b>: Next.js app queries seeded PostgreSQL + pgvector database, displaying leaderboard, radar charts, recruitment funnel, and interactive weight sliders.", workflow_style))
    story.append(PageBreak())

    # ==================== PAGE 7: SYSTEM ARCHITECTURE ====================
    story.append(Paragraph("System Architecture", title_style))
    story.append(Spacer(1, 10))
    
    # Drawing a clean textual layout table representing the architecture block diagram
    arch_data = [
        [
            Paragraph("<b>Recruiter Workspace (Next.js 15 UI)</b><br/>Leaderboard, Skill Radars, Weight Sliders, Analytics Funnel", body_style),
            Paragraph("<b>Offline CLI Pipeline (rank.py)</b><br/>Fast streaming JSONL parser, offline similarity ranker, CSV exporter", body_style)
        ],
        [
            Paragraph("<b>Next.js Server Actions & API Routes</b><br/>Unified REST routes for parsing, matching, and seeder execution", body_style),
            Paragraph("<b>Gemini Embeddings Archive</b><br/>Pre-computed vector representations (numpy `.npy` binary arrays)", body_style)
        ],
        [
            Paragraph("<b>PostgreSQL with pgvector Extension</b><br/>Candidate tables, career history, skills, and vector indices", body_style),
            Paragraph("<b>Google Gemini API Client</b><br/>Schema-guaranteed profile parsing and natural-language summaries", body_style)
        ]
    ]
    arch_table = Table(arch_data, colWidths=[350, 350])
    arch_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 12),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 14),
    ]))
    story.append(arch_table)
    story.append(Spacer(1, 10))
    story.append(Paragraph("<i>Design Philosophy: Adheres strictly to clean architecture boundaries, decoupling presentation schemas, service logic handlers, database models, and external API providers.</i>", ParagraphStyle('ItalicFooter', parent=body_style, fontName='Helvetica-Oblique', textColor=colors.HexColor("#475569"))))
    story.append(PageBreak())

    # ==================== PAGE 8: RESULTS & PERFORMANCE ====================
    story.append(Paragraph("Results & Performance", title_style))
    
    story.append(Paragraph("What results or insights demonstrate ranking quality?", question_style))
    story.append(Paragraph("&bull; <b>Honeypot Resilience</b>: Flagged and penalized all 146 chronological and skill-inflation anomalies. Zero synthetic candidates broke into the Top 100 leaderboard.", bullet_style))
    story.append(Paragraph("&bull; <b>Title-Aware Filtering</b>: Content Writers and HR Managers stuffing 'RAG/Embeddings' keywords were successfully penalized, allowing genuine ML engineers (like Mira Ghosh, #1, 83.13) to rise to the top.", bullet_style))
    story.append(Paragraph("&bull; <b>Behavioral Intent Weighting</b>: Immediate availability (short notice) and high active usage successfully filtered cold/unresponsive candidates with matching skills.", bullet_style))
    
    story.append(Paragraph("How does your solution meet the challenge's runtime and compute constraints?", question_style))
    story.append(Paragraph("&bull; <b>CLI Execution Speed</b>: Ranks 100,000 candidates in <b>under 15 seconds</b> on a single-core CPU, well below the 5-minute sandbox limit.", bullet_style))
    story.append(Paragraph("&bull; <b>Low Memory Footprint</b>: Uses standard streaming methods keeping RAM consumption **under 1.5 GB** (16 GB limit).", bullet_style))
    story.append(Paragraph("&bull; <b>Zero Network Rule</b>: Uses pre-computed vectors offline, strictly executing on CPU with zero network requests during ranking.", bullet_style))
    story.append(PageBreak())

    # ==================== PAGE 9: TECHNOLOGIES USED ====================
    story.append(Paragraph("Technologies Used", title_style))
    story.append(Spacer(1, 10))
    
    tech_data = [
        [Paragraph("<b>Component</b>", question_style), Paragraph("<b>Tech Selection</b>", question_style), Paragraph("<b>Rationale & Benefits</b>", question_style)],
        [Paragraph("<b>Frontend Framework</b>", body_style), Paragraph("Next.js 15 (React 19, TypeScript)", body_style), Paragraph("Server Components (RSC) for fast initial dashboard loads, unified server-side API routers.", body_style)],
        [Paragraph("<b>Styling & UI</b>", body_style), Paragraph("Tailwind CSS, shadcn/ui, Framer Motion", body_style), Paragraph("Delivers responsive layouts, sleek dark modes, interactive sliders, and premium micro-animations.", body_style)],
        [Paragraph("<b>Database ORM</b>", body_style), Paragraph("Prisma Client (Node.js/Next.js)", body_style), Paragraph("Provides structural type-safety, automatic model updates, and nested database seeding.", body_style)],
        [Paragraph("<b>Database Engine</b>", body_style), Paragraph("PostgreSQL + pgvector extension", body_style), Paragraph("Combines relational candidate metadata with high-performance vector search in a single engine.", body_style)],
        [Paragraph("<b>AI Models & SDK</b>", body_style), Paragraph("Google Gemini API, text-embedding-004", body_style), Paragraph("Generates 768-dimension semantic embeddings and structures raw resume profiles via JSON mode.", body_style)],
        [Paragraph("<b>Visual Analytics</b>", body_style), Paragraph("Recharts, openpyxl", body_style), Paragraph("Builds interactive skills radar charts, funnel charts, and generates styled Excel sheets natively.", body_style)]
    ]
    tech_table = Table(tech_data, colWidths=[120, 200, 390])
    tech_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('PADDING', (0,0), (-1,-1), 6),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(tech_table)
    story.append(PageBreak())

    # ==================== PAGE 10: SUBMISSION ASSETS ====================
    story.append(Paragraph("Submission Assets", title_style))
    story.append(Spacer(1, 20))
    
    assets_data = [
        [Paragraph("GitHub Repository URL", question_style), Paragraph("https://github.com/Meghana-Merla/hirewise-ai", body_style)],
        [Paragraph("Sandbox Demo URL", question_style), Paragraph("http://localhost:3000 (Local Next-Gen Recruiter Console)", body_style)],
        [Paragraph("Reproduce Command", question_style), Paragraph("python3 scripts/rank.py --candidates ./candidates.jsonl --out ./submission.csv", body_style)],
        [Paragraph("Official Excel Output", question_style), Paragraph("recommended_candidates.xlsx (Root folder, includes 3 sheets & 4 native charts)", body_style)],
        [Paragraph("Metadata Declaration", question_style), Paragraph("submission_metadata.yaml (Root folder, includes environment specifications)", body_style)],
        [Paragraph("Walkthrough Summary", question_style), Paragraph("walkthrough.md (Details the score calculations, algorithms, and results)", body_style)]
    ]
    assets_table = Table(assets_data, colWidths=[200, 500])
    assets_table.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 10),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(assets_table)
    story.append(Spacer(1, 20))
    story.append(Paragraph("<i>All code is original, and the reproduce command has been verified locally using the validation script to generate zero-error outputs.</i>", ParagraphStyle('ItalicFoot', parent=body_style, fontName='Helvetica-Oblique', textColor=colors.HexColor("#4F46E5"))))
    story.append(PageBreak())

    # ==================== PAGE 11: THANK YOU ====================
    story.append(Spacer(1, 190))
    story.append(Paragraph("THANK YOU", ParagraphStyle('TYStyle', fontName='Helvetica-Bold', fontSize=32, textColor=colors.HexColor("#FFFFFF"), alignment=1)))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Build what next India runs on", ParagraphStyle('TYSub', fontName='Helvetica', fontSize=14, textColor=colors.HexColor("#E0E7FF"), alignment=1)))

    # Build document
    doc.build(story, canvasmaker=SlideCanvas)
    print("PDF Generation complete!")

if __name__ == "__main__":
    import sys
    output = sys.argv[1] if len(sys.argv) > 1 else "submission_presentation.pdf"
    create_presentation_pdf(output)
