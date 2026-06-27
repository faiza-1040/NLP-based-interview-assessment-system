
# # # nlp-service/services/rule_matcher.py
# from typing import Dict, Any, List
# import re
# from .normalizers import canonicalize_skill, canonicalize_title, normalize_skill_list
# from .ai_relevance import score_experience_relevance, score_project_relevance


# def _cefr_level_to_score(level_str: str) -> float:
#     if not level_str:
#         return 0.6
#     l = level_str.lower()
#     if "c2" in l:
#         return 1.0
#     if "c1" in l or "advanced" in l:
#         return 0.9
#     if "b2" in l or "upper intermediate" in l:
#         return 0.8
#     if "b1" in l or "intermediate" in l:
#         return 0.6
#     if "a2" in l or "elementary" in l:
#         return 0.4
#     if "a1" in l or "beginner" in l:
#         return 0.2
#     return 0.6


# def _normalize_job(job_doc: Dict[str, Any]) -> Dict[str, Any]:
#     skills_required = normalize_skill_list(job_doc.get("skillsRequired", []) or [])
#     rate_skills = job_doc.get("rateSkills", {}) or {}

#     normalized_rate = {}
#     for k, v in rate_skills.items():
#         pretty_key = re.sub(r"[_]+", " ", k)
#         normalized_rate[canonicalize_skill(pretty_key)] = v

#     required_skills = []
#     nice_to_have_skills = []

#     for s in skills_required:
#         rating = normalized_rate.get(s, "Must Have")
#         if str(rating).lower().startswith("must"):
#             required_skills.append(s)
#         else:
#             nice_to_have_skills.append(s)

#     return {
#         "title": canonicalize_title(job_doc.get("title") or ""),
#         "required_skills": list(dict.fromkeys(required_skills)),
#         "nice_to_have_skills": list(dict.fromkeys(nice_to_have_skills)),
#         "education_required": job_doc.get("qualification") or "",
#     }


# def _build_candidate_skill_evidence(resume_structured: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
#     evidence = {}

#     def add_skill(skill_name: str, score: float, source: str):
#         canon = canonicalize_skill(skill_name)
#         if not canon:
#             return
#         if canon not in evidence:
#             evidence[canon] = {"score": 0.0, "sources": set()}
#         evidence[canon]["score"] = max(evidence[canon]["score"], score)
#         evidence[canon]["sources"].add(source)

#     for lang in resume_structured.get("languages", []) or []:
#         add_skill(lang.get("language") or "", _cefr_level_to_score(lang.get("level") or ""), "languages")

#     for s in resume_structured.get("skills", []) or []:
#         add_skill(s, 0.5, "skills")

#     for exp in resume_structured.get("experience", []) or []:
#         title = exp.get("title") or exp.get("jobTitle") or ""
#         desc = exp.get("description") or ""
#         combined = f"{title} {desc}".lower()

#         for raw in resume_structured.get("skills", []) or []:
#             canon = canonicalize_skill(raw)
#             if canon and canon in combined:
#                 add_skill(canon, 0.85, "experience")

#     for proj in resume_structured.get("projects", []) or []:
#         techs = proj.get("technologies", []) or []
#         desc = proj.get("description") or ""
#         combined = f"{' '.join(techs)} {desc}".lower()

#         for t in techs:
#             add_skill(t, 0.8, "projects")

#         for raw in resume_structured.get("skills", []) or []:
#             canon = canonicalize_skill(raw)
#             if canon and canon in combined:
#                 add_skill(canon, 0.75, "projects")

#     for k in evidence:
#         evidence[k]["sources"] = sorted(list(evidence[k]["sources"]))

#     return evidence


# def _avg_skill_score(skills: List[str], evidence: Dict[str, Dict[str, Any]]) -> float:
#     if not skills:
#         return 1.0
#     vals = [evidence.get(s, {}).get("score", 0.0) for s in skills]
#     return sum(vals) / len(vals)


# def _education_score(resume_structured: Dict[str, Any], job_norm: Dict[str, Any]) -> float:
#     req = (job_norm.get("education_required") or "").lower()
#     if not req:
#         return 1.0

#     edus = resume_structured.get("education", []) or []
#     if not edus:
#         return 0.0

#     for e in edus:
#         degree = (e.get("degree") or e.get("level") or "").lower()
#         if any(x in req for x in ["bachelor", "bachelors", "bs", "b.s"]):
#             if any(x in degree for x in ["bachelor", "bs", "b.s"]):
#                 return 1.0

#     return 0.4


# def _title_alignment_score(job_doc: Dict[str, Any], resume_structured: Dict[str, Any]) -> float:
#     job_title = canonicalize_title(job_doc.get("title") or "")
#     experiences = resume_structured.get("experience", []) or []
#     projects = resume_structured.get("projects", []) or []

#     exp_titles = " ".join([
#         canonicalize_title(e.get("title") or e.get("jobTitle") or "")
#         for e in experiences
#     ]).strip()

#     proj_text = " ".join([
#         f"{p.get('name','')} {p.get('description','')}"
#         for p in projects
#     ]).lower()

#     if job_title and job_title in exp_titles:
#         return 1.0

#     web_keywords = ["web", "frontend", "backend", "full stack", "developer", "react", "node", "javascript"]
#     if any(k in job_title for k in web_keywords):
#         if any(k in exp_titles for k in web_keywords):
#             return 0.9
#         if any(k in proj_text for k in web_keywords):
#             return 0.7
#         return 0.2

#     return 0.6


# def compute_rule_match(job_doc: Dict[str, Any], resume_structured: Dict[str, Any]) -> Dict[str, Any]:
#     job_norm = _normalize_job(job_doc)
#     evidence = _build_candidate_skill_evidence(resume_structured)

#     must = job_norm["required_skills"]
#     nice = job_norm["nice_to_have_skills"]

#     must_score = _avg_skill_score(must, evidence)
#     nice_score = _avg_skill_score(nice, evidence)

#     matched_must = [s for s in must if evidence.get(s, {}).get("score", 0.0) > 0]
#     missing_must = [s for s in must if evidence.get(s, {}).get("score", 0.0) == 0]
#     matched_nice = [s for s in nice if evidence.get(s, {}).get("score", 0.0) > 0]
#     missing_nice = [s for s in nice if evidence.get(s, {}).get("score", 0.0) == 0]

#     must_match_ratio = len(matched_must) / len(must) if must else 1.0

#     ai_experience = score_experience_relevance(job_doc, resume_structured.get("experience", []) or [])
#     experience_relevance = ai_experience["overall_score"]

#     ai_projects = score_project_relevance(job_doc, resume_structured.get("projects", []) or [])
#     project_relevance = ai_projects["overall_score"]

#     title_alignment = _title_alignment_score(job_doc, resume_structured)
#     edu_score = _education_score(resume_structured, job_norm)

#     w_must = 0.35
#     w_nice = 0.10
#     w_exp = 0.20
#     w_proj = 0.15
#     w_title = 0.10
#     w_edu = 0.10

#     base = (
#         must_score * w_must +
#         nice_score * w_nice +
#         experience_relevance * w_exp +
#         project_relevance * w_proj +
#         title_alignment * w_title +
#         edu_score * w_edu
#     )

#     rule_score = max(0, min(100, round(base * 100)))

#     if must and must_match_ratio == 0:
#         rule_score = min(rule_score, 20)
#     elif must and must_match_ratio < 0.25:
#         rule_score = min(rule_score, 30)
#     elif must and must_match_ratio < 0.50:
#         rule_score = min(rule_score, 45)

#     breakdown = {
#         "required_skills": must,
#         "nice_to_have_skills": nice,
#         "candidate_skill_evidence": evidence,
#         "matched_must_have": matched_must,
#         "missing_must_have": missing_must,
#         "matched_nice_to_have": matched_nice,
#         "missing_nice_to_have": missing_nice,
#         "must_match_ratio": must_match_ratio,
#         "experience_relevance": experience_relevance,
#         "project_relevance": project_relevance,
#         "title_alignment": title_alignment,
#         "education_score": edu_score,
#         "ai_experience_relevance": ai_experience,
#         "ai_project_relevance": ai_projects,
#         "weights": {
#             "must": w_must,
#             "nice": w_nice,
#             "experience": w_exp,
#             "projects": w_proj,
#             "title": w_title,
#             "education": w_edu,
#         },
#     }
#     print("\n===== RULE MATCH DEBUG =====")
#     print("MUST:", must)
#     print("JOB TITLE:", job_doc.get("title"))
#     print("NICE:", nice)
#     print("MATCHED MUST:", matched_must)
#     print("MISSING MUST:", missing_must)
#     print("MUST MATCH RATIO:", must_match_ratio)
#     print("EXPERIENCE RELEVANCE:", experience_relevance)
#     print("PROJECT RELEVANCE:", project_relevance)
#     print("TITLE ALIGNMENT:", title_alignment)
#     print("EDUCATION SCORE:", edu_score)
#     print("RULE SCORE:", rule_score)
#     print("============================\n")

#     return {
#         "rule_score": rule_score,
#         "breakdown": breakdown,
#     }


# # nlp-service/services/rule_matcher.py
from typing import Dict, Any, List
import re
from datetime import datetime
from .normalizers import canonicalize_skill, canonicalize_title, normalize_skill_list
from .semantic_relevance import (
    score_experience_relevance_semantic,
    score_project_relevance_semantic
)


def _cefr_level_to_score(level_str: str) -> float:
    if not level_str:
        return 0.6
    l = level_str.lower()
    if "c2" in l:
        return 1.0
    if "c1" in l or "advanced" in l:
        return 0.9
    if "b2" in l or "upper intermediate" in l:
        return 0.8
    if "b1" in l or "intermediate" in l:
        return 0.6
    if "a2" in l or "elementary" in l:
        return 0.4
    if "a1" in l or "beginner" in l:
        return 0.2
    return 0.6


def _normalize_job(job_doc: Dict[str, Any]) -> Dict[str, Any]:
    skills_required = normalize_skill_list(job_doc.get("skillsRequired", []) or [])
    rate_skills = job_doc.get("rateSkills", {}) or {}

    normalized_rate = {}
    for k, v in rate_skills.items():
        pretty_key = re.sub(r"[_]+", " ", k)
        normalized_rate[canonicalize_skill(pretty_key)] = v

    required_skills = []
    nice_to_have_skills = []

    for s in skills_required:
        rating = normalized_rate.get(s, "Must Have")
        if str(rating).lower().startswith("must"):
            required_skills.append(s)
        else:
            nice_to_have_skills.append(s)

    return {
        "title": canonicalize_title(job_doc.get("title") or ""),
        "required_skills": list(dict.fromkeys(required_skills)),
        "nice_to_have_skills": list(dict.fromkeys(nice_to_have_skills)),
        "education_required": job_doc.get("qualification") or "",
    }


def _build_candidate_skill_evidence(resume_structured: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    evidence = {}

    def add_skill(skill_name: str, score: float, source: str):
        canon = canonicalize_skill(skill_name)
        if not canon:
            return
        if canon not in evidence:
            evidence[canon] = {"score": 0.0, "sources": set()}
        evidence[canon]["score"] = max(evidence[canon]["score"], score)
        evidence[canon]["sources"].add(source)

    for lang in resume_structured.get("languages", []) or []:
        add_skill(lang.get("language") or "", _cefr_level_to_score(lang.get("level") or ""), "languages")

    for s in resume_structured.get("skills", []) or []:
        add_skill(s, 0.35, "skills")

    for exp in resume_structured.get("experience", []) or []:
        title = exp.get("title") or exp.get("jobTitle") or ""
        desc = exp.get("description") or ""
        combined = f"{title} {desc}".lower()

        for raw in resume_structured.get("skills", []) or []:
            canon = canonicalize_skill(raw)
            if canon and canon in combined:
                add_skill(canon, 0.85, "experience")

    for proj in resume_structured.get("projects", []) or []:
        techs = proj.get("technologies", []) or []
        desc = proj.get("description") or ""
        combined = f"{' '.join(techs)} {desc}".lower()

        for t in techs:
            add_skill(t, 0.8, "projects")

        for raw in resume_structured.get("skills", []) or []:
            canon = canonicalize_skill(raw)
            if canon and canon in combined:
                add_skill(canon, 0.75, "projects")

    for k in evidence:
        evidence[k]["sources"] = sorted(list(evidence[k]["sources"]))

    return evidence


def _avg_skill_score(skills: List[str], evidence: Dict[str, Dict[str, Any]]) -> float:
    if not skills:
        return 1.0
    vals = [evidence.get(s, {}).get("score", 0.0) for s in skills]
    return sum(vals) / len(vals)


def _education_score(resume_structured: Dict[str, Any], job_norm: Dict[str, Any]) -> float:
    req = (job_norm.get("education_required") or "").lower()
    if not req:
        return 1.0

    edus = resume_structured.get("education", []) or []
    if not edus:
        return 0.0

    for e in edus:
        degree = (e.get("degree") or e.get("level") or "").lower()
        if any(x in req for x in ["bachelor", "bachelors", "bs", "b.s"]):
            if any(x in degree for x in ["bachelor", "bs", "b.s"]):
                return 1.0

    return 0.4


def _title_alignment_score(job_doc: Dict[str, Any], resume_structured: Dict[str, Any]) -> float:
    job_title = canonicalize_title(job_doc.get("title") or "")
    experiences = resume_structured.get("experience", []) or []
    projects = resume_structured.get("projects", []) or []

    exp_titles = " ".join([
        canonicalize_title(e.get("title") or e.get("jobTitle") or "")
        for e in experiences
    ]).strip()

    proj_text = " ".join([
        f"{p.get('name','')} {p.get('description','')}"
        for p in projects
    ]).lower()

    if job_title and job_title in exp_titles:
        return 1.0

    web_keywords = ["web", "frontend", "backend", "full stack", "developer", "react", "node", "javascript"]
    if any(k in job_title for k in web_keywords):
        if any(k in exp_titles for k in web_keywords):
            return 0.9
        if any(k in proj_text for k in web_keywords):
            return 0.7
        return 0.2

    return 0.6

def _extract_required_min_years(job_doc: Dict[str, Any]) -> float:
    """
    Extract minimum required years from job fields.
    Works for:
    "4-6 years", "4–6 years", "minimum 3 years", "2+ years"
    """
    text = " ".join([
        str(job_doc.get("experience") or ""),
        str(job_doc.get("yearsOfExperience") or ""),
        str(job_doc.get("experienceRequired") or ""),
        str(job_doc.get("description") or ""),
        str(job_doc.get("careerLevel") or ""),
    ]).lower()

    # 4-6 years or 4–6 years
    m = re.search(r"(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(?:years|year|yrs|yr)", text)
    if m:
        return float(m.group(1))

    # 2+ years
    m = re.search(r"(\d+(?:\.\d+)?)\s*\+\s*(?:years|year|yrs|yr)", text)
    if m:
        return float(m.group(1))

    # minimum 3 years / at least 3 years
    m = re.search(r"(?:minimum|min|at least)\s*(\d+(?:\.\d+)?)\s*(?:years|year|yrs|yr)", text)
    if m:
        return float(m.group(1))

    # simple: 3 years experience
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:years|year|yrs|yr)", text)
    if m:
        return float(m.group(1))

    return 0.0


def _parse_year_from_text(value: str):
    if not value:
        return None

    value = str(value).lower().strip()

    if "present" in value or "current" in value or "now" in value:
        return datetime.now().year

    m = re.search(r"(19|20)\d{2}", value)
    if m:
        return int(m.group(0))

    return None


def _estimate_candidate_years(resume_structured: Dict[str, Any]) -> float:
    """
    Generic experience-years estimator from structured experience dates.
    If dates are missing, uses conservative approximation based on number of roles.
    """
    experiences = resume_structured.get("experience", []) or []

    if not experiences:
        return 0.0

    total_years = 0.0
    dated_roles = 0

    for exp in experiences:
        start = (
            exp.get("from")
            or exp.get("startDate")
            or exp.get("start")
            or ""
        )
        end = (
            exp.get("to")
            or exp.get("endDate")
            or exp.get("end")
            or ""
        )

        if exp.get("currently") or exp.get("currentlyWorking"):
            end = "present"

        start_year = _parse_year_from_text(start)
        end_year = _parse_year_from_text(end)

        # Sometimes date is inside description
        if start_year is None or end_year is None:
            desc = exp.get("description") or ""
            years = re.findall(r"(19|20)\d{2}", desc)
            years = [int(y) for y in re.findall(r"(?:19|20)\d{2}", desc)]
            if len(years) >= 2:
                start_year = min(years)
                end_year = max(years)
            elif len(years) == 1 and ("present" in desc.lower() or "current" in desc.lower()):
                start_year = years[0]
                end_year = datetime.now().year

        if start_year and end_year and end_year >= start_year:
            total_years += max(0.25, end_year - start_year)
            dated_roles += 1

    if total_years > 0:
        return round(total_years, 1)

    # Conservative fallback if dates missing
    # Do not over-reward unknown dates.
    return min(1.0, len(experiences) * 0.5)


def _apply_seniority_cap(rule_score: int, required_years: float, candidate_years: float) -> int:
    """
    Generic cap based on required vs candidate experience.
    Prevents interns/freshers from scoring 75+ on senior jobs.
    """
    if required_years <= 0:
        return rule_score

    ratio = candidate_years / required_years if required_years else 1.0

    if ratio < 0.25:
        return min(rule_score, 45)
    elif ratio < 0.50:
        return min(rule_score, 55)
    elif ratio < 0.75:
        return min(rule_score, 68)
    elif ratio < 1.00:
        return min(rule_score, 78)

    return rule_score

def compute_rule_match(job_doc: Dict[str, Any], resume_structured: Dict[str, Any]) -> Dict[str, Any]:
    job_norm = _normalize_job(job_doc)
    evidence = _build_candidate_skill_evidence(resume_structured)

    must = job_norm["required_skills"]
    nice = job_norm["nice_to_have_skills"]

    must_score = _avg_skill_score(must, evidence)
    nice_score = _avg_skill_score(nice, evidence)

    matched_must = [s for s in must if evidence.get(s, {}).get("score", 0.0) > 0]
    missing_must = [s for s in must if evidence.get(s, {}).get("score", 0.0) == 0]
    matched_nice = [s for s in nice if evidence.get(s, {}).get("score", 0.0) > 0]
    missing_nice = [s for s in nice if evidence.get(s, {}).get("score", 0.0) == 0]

    must_match_ratio = len(matched_must) / len(must) if must else 1.0

    # ai_experience = score_experience_relevance(job_doc, resume_structured.get("experience", []) or [])
    # experience_relevance = ai_experience["overall_score"]
    

    # ai_projects = score_project_relevance(job_doc, resume_structured.get("projects", []) or [])
    # project_relevance = ai_projects["overall_score"]


    experience_result = score_experience_relevance_semantic(
    job_doc,
    resume_structured.get("experience", []) or []
    )
    experience_relevance = experience_result["overall_score"]

    project_result = score_project_relevance_semantic(
    job_doc,
    resume_structured.get("projects", []) or []
    )
    project_relevance = project_result["overall_score"]
    title_alignment = _title_alignment_score(job_doc, resume_structured)
    edu_score = _education_score(resume_structured, job_norm)

    w_must = 0.50
    w_nice = 0.05
    w_exp = 0.20
    w_proj = 0.10
    w_title = 0.10
    w_edu = 0.05

    base = (
        must_score * w_must +
        nice_score * w_nice +
        experience_relevance * w_exp +
        project_relevance * w_proj +
        title_alignment * w_title +
        edu_score * w_edu
    )

    rule_score = max(0, min(100, round(base * 100)))

    # if must and must_match_ratio == 0:
    #     rule_score = min(rule_score, 20)
    # elif must and must_match_ratio < 0.25:
    #     rule_score = min(rule_score, 30)
    # elif must and must_match_ratio < 0.50:
    #     rule_score = min(rule_score, 45)

    if must and must_match_ratio == 0:
        rule_score = min(rule_score, 20)
    elif must and must_match_ratio < 0.40:
        rule_score = min(rule_score, 35)
    elif must and must_match_ratio < 0.60:
        rule_score = min(rule_score, 50)
    elif must and must_match_ratio < 0.75:
        rule_score = min(rule_score, 65)


    required_years = _extract_required_min_years(job_doc)
    candidate_years = _estimate_candidate_years(resume_structured)

    rule_score = _apply_seniority_cap(
    rule_score,
    required_years,
    candidate_years
    )

    breakdown = {
        "required_skills": must,
        "nice_to_have_skills": nice,
        "candidate_skill_evidence": evidence,
        "matched_must_have": matched_must,
        "missing_must_have": missing_must,
        "matched_nice_to_have": matched_nice,
        "missing_nice_to_have": missing_nice,
        "must_match_ratio": must_match_ratio,
        "experience_relevance": experience_relevance,
        "project_relevance": project_relevance,
        "title_alignment": title_alignment,
        "education_score": edu_score,
        "semantic_experience_relevance": experience_result,
        "semantic_project_relevance": project_result,
        "required_years": required_years,
        "candidate_estimated_years": candidate_years,
        "weights": {
            "must": w_must,
            "nice": w_nice,
            "experience": w_exp,
            "projects": w_proj,
            "title": w_title,
            "education": w_edu,
        },
    }
    print("\n===== RULE MATCH DEBUG =====")
    print("MUST:", must)
    print("JOB TITLE:", job_doc.get("title"))
    print("NICE:", nice)
    print("MATCHED MUST:", matched_must)
    print("MISSING MUST:", missing_must)
    print("MUST MATCH RATIO:", must_match_ratio)
    print("EXPERIENCE RELEVANCE:", experience_relevance)
    print("PROJECT RELEVANCE:", project_relevance)
    print("TITLE ALIGNMENT:", title_alignment)
    print("EDUCATION SCORE:", edu_score)
    print("RULE SCORE:", rule_score)
    print("============================\n")

    return {
        "rule_score": rule_score,
        "breakdown": breakdown,
    }