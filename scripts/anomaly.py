import logging
from datetime import datetime
from typing import Any, Dict, List, Set

# Configure logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("AnomalyDetector")

class AnomalyDetector:
    """
    Deterministic Anomaly Detector that validates candidate profiles.
    Identifies trap and honeypot records with corresponding confidence levels.
    """

    @staticmethod
    def check_candidate(candidate: Dict[str, Any]) -> Dict[str, Any]:
        """
        Scans a candidate JSON structure for logical and physical timeline violations.

        Args:
            candidate: Dict containing candidate profile, education, skills, and signals.

        Returns:
            Dict containing 'status' (CLEAN, LOW, MEDIUM, HIGH) and 'reasons' (List[str]).
        """
        reasons: List[str] = []
        status: str = "CLEAN"
        now = datetime.now()

        profile = candidate.get("profile", {})
        yoe = float(profile.get("years_of_experience", 0.0))
        yoe_months = yoe * 12

        career = candidate.get("career_history", [])
        education = candidate.get("education", [])
        skills = candidate.get("skills", [])
        signals = candidate.get("redrob_signals", {})

        # =====================================================================
        # HIGH CONFIDENCE ANOMALIES (Mathematically/Chronologically Impossible)
        # =====================================================================

        # 1. Single job duration exceeds total stated years of experience
        for i, job in enumerate(career):
            dur = int(job.get("duration_months", 0))
            company = job.get("company", "Unknown")
            if dur > yoe_months + 2:
                status = "HIGH"
                reasons.append(
                    f"Job duration at '{company}' ({dur}m) exceeds total stated experience ({yoe}y)."
                )

            # 2. Job start date is after end date
            start_str = job.get("start_date")
            end_str = job.get("end_date")
            if start_str and end_str:
                try:
                    start_dt = datetime.strptime(start_str, "%Y-%m-%d")
                    end_dt = datetime.strptime(end_str, "%Y-%m-%d")
                    if start_dt > end_dt:
                        status = "HIGH"
                        reasons.append(
                            f"Logical date mismatch: Job at '{company}' starts ({start_str}) after it ends ({end_str})."
                        )
                except ValueError:
                    pass

            # 3. Job start date is in the future
            if start_str:
                try:
                    start_dt = datetime.strptime(start_str, "%Y-%m-%d")
                    if start_dt > now:
                        status = "HIGH"
                        reasons.append(
                            f"Future history mismatch: Job at '{company}' starts in the future ({start_str})."
                        )
                except ValueError:
                    pass

        # 4. Education start year is after end year
        for i, edu in enumerate(education):
            sy = edu.get("start_year")
            ey = edu.get("end_year")
            inst = edu.get("institution", "Unknown")
            if sy and ey and int(sy) > int(ey):
                status = "HIGH"
                reasons.append(
                    f"Logical education mismatch: Studies at '{inst}' start ({sy}) after they end ({ey})."
                )

        # 5. Work started before university education by an impossible gap (6+ years)
        work_start_years: List[int] = []
        for job in career:
            sd = job.get("start_date")
            if sd:
                try:
                    work_start_years.append(datetime.strptime(sd, "%Y-%m-%d").year)
                except ValueError:
                    pass

        edu_start_years = [
            int(edu.get("start_year"))
            for edu in education
            if edu.get("start_year") is not None
        ]

        if work_start_years and edu_start_years:
            earliest_work = min(work_start_years)
            earliest_edu = min(edu_start_years)
            if earliest_edu - earliest_work > 6:
                status = "HIGH"
                reasons.append(
                    f"Chronological conflict: Work history started in {earliest_work}, but university began in {earliest_edu}."
                )

        # Return immediately if HIGH severity is found
        if status == "HIGH":
            logger.debug("Candidate %s flagged as HIGH confidence anomaly: %s", candidate.get("candidate_id"), reasons)
            return {"status": status, "reasons": reasons}

        # =====================================================================
        # MEDIUM CONFIDENCE ANOMALIES (Suspicious but theoretically possible)
        # =====================================================================

        # 1. Skill inflation with zero active experience
        expert_zero_dur = [
            s for s in skills
            if s.get("proficiency", "").lower() in ["expert", "advanced"]
            and int(s.get("duration_months", 0)) == 0
        ]
        if len(expert_zero_dur) >= 5:
            status = "MEDIUM"
            reasons.append(
                f"Skill inflation: Lists {len(expert_zero_dur)} expert/advanced skills with 0 months of active usage."
            )

        # 2. Long notice period but marked actively seeking work
        notice_period = int(signals.get("notice_period_days", 0))
        open_to_work = bool(signals.get("open_to_work_flag", False))
        if notice_period >= 120 and open_to_work:
            status = "MEDIUM"
            reasons.append(
                f"Availability conflict: Candidate marked 'Open to Work' but has a notice period of {notice_period} days."
            )

        # 3. Accumulated job duration exceeds total YOE significantly
        total_job_months = sum(int(job.get("duration_months", 0)) for job in career)
        if total_job_months > yoe_months + 24:
            status = "MEDIUM"
            reasons.append(
                f"Experience overlap: Cumulative job durations ({total_job_months}m) exceed stated YOE ({yoe}y)."
            )

        if status == "MEDIUM":
            return {"status": status, "reasons": reasons}

        # =====================================================================
        # LOW CONFIDENCE ANOMALIES (Slight warnings / warnings)
        # =====================================================================

        # 1. Profile completeness under threshold
        completeness = float(signals.get("profile_completeness_score", 100.0))
        if completeness < 50.0:
            status = "LOW"
            reasons.append(f"Incomplete profile: Completeness is under 50% ({completeness}%).")

        # 2. Profile inactive for more than 6 months
        last_active = signals.get("last_active_date")
        if last_active:
            try:
                active_dt = datetime.strptime(last_active, "%Y-%m-%d")
                diff_days = (now - active_dt).days
                if diff_days > 180:
                    status = "LOW"
                    reasons.append(f"Inactive account: Stated last active date was {diff_days} days ago.")
            except ValueError:
                pass

        # 3. Missing education history completely
        if not education:
            status = "LOW"
            reasons.append("Missing education: Profile has no formal education records.")

        # 4. Zero connections on platform
        connections = int(signals.get("connection_count", 1))
        if connections == 0:
            status = "LOW"
            reasons.append("Unconnected profile: Candidate has 0 platform connections.")

        return {"status": status, "reasons": reasons}
