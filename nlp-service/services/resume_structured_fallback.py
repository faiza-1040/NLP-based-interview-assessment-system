# nlp-service/services/resume_structured_fallback.py
import re
from typing import Dict, Any, List
from .normalizers import SKILL_ALIASES, canonicalize_skill


def _clean_text(text: str) -> str:
    text = text or ""

    # OCR fixes
    text = text.replace("APl", "API")
    text = text.replace("RESTAPl", "REST API")
    text = text.replace("APls", "APIs")
    text = text.replace("Ul", "UI")
    text = text.replace("Linkedln", "LinkedIn")

    # Add spaces where OCR joined words
    text = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def _contains_skill(text: str, aliases: List[str]) -> bool:
    text_l = text.lower()

    for alias in aliases:
        alias = alias.lower().strip()
        if not alias:
            continue

        pattern = r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9])"
        if re.search(pattern, text_l):
            return True

    return False


def extract_skills_from_text(text: str) -> List[str]:
    text = _clean_text(text)
    found = []

    for canon, aliases in SKILL_ALIASES.items():
        names = list(set([canon] + aliases))
        if _contains_skill(text, names):
            found.append(canon)

    return list(dict.fromkeys(found))


def _section(text: str, start_keywords: List[str], end_keywords: List[str]) -> str:
    text_upper = text.upper()

    start_pos = -1
    for kw in start_keywords:
        pos = text_upper.find(kw.upper())
        if pos != -1:
            start_pos = pos
            break

    if start_pos == -1:
        return ""

    end_pos = len(text)
    for kw in end_keywords:
        pos = text_upper.find(kw.upper(), start_pos + 1)
        if pos != -1:
            end_pos = min(end_pos, pos)

    return text[start_pos:end_pos].strip()


def extract_experience_from_text(text: str) -> List[Dict[str, Any]]:
    text = _clean_text(text)

    exp_text = _section(
        text,
        ["WORK EXPERIENCE", "EXPERIENCE", "EMPLOYMENT"],
        ["PROJECTS", "EDUCATION", "CERTIFICATIONS", "SKILLS"]
    )

    if not exp_text:
        return []

    experiences = []

    # Split experience using common role patterns
    chunks = re.split(
        r"(?=(?:Senior|Junior|Frontend|Front End|Backend|Back End|Full Stack|Web|Software|Data|Graphic|HR|Accountant|Developer|Engineer|Analyst|Designer)\s*[A-Za-z ]{2,60}\|)",
        exp_text
    )

    for chunk in chunks:
        chunk = chunk.strip()
        if len(chunk) < 40:
            continue

        title = ""
        company = ""

        first_line = chunk[:150]

        m = re.search(r"([A-Za-z ]{3,80})\|([A-Za-z0-9 .,&-]{2,80})", first_line)
        if m:
            title = m.group(1).strip()
            company = m.group(2).strip()
        else:
            title = first_line[:80].replace("WORK EXPERIENCE", "").strip()

        experiences.append({
            "title": title,
            "company": company,
            "from": "",
            "to": "",
            "currently": False,
            "description": chunk[:1800]
        })

    if not experiences and len(exp_text) > 50:
        experiences.append({
            "title": "",
            "company": "",
            "from": "",
            "to": "",
            "currently": False,
            "description": exp_text[:1800]
        })

    return experiences


def extract_projects_from_text(text: str) -> List[Dict[str, Any]]:
    text = _clean_text(text)

    projects_text = _section(
        text,
        ["PROJECTS"],
        ["EDUCATION", "CERTIFICATIONS", "WORK EXPERIENCE", "SKILLS"]
    )

    if not projects_text:
        return []

    projects = []

    # Split using "Technologies:"
    chunks = re.split(r"(?=[A-Z][A-Za-z0-9 &-]{3,80}\s+Technologies:)", projects_text)

    for chunk in chunks:
        chunk = chunk.strip()
        if len(chunk) < 40:
            continue

        name = chunk.split("Technologies:")[0]
        name = name.replace("PROJECTS", "").strip()[:100]

        techs = []
        tech_match = re.search(r"Technologies:\s*([^\.]+)", chunk, flags=re.IGNORECASE)
        if tech_match:
            tech_text = tech_match.group(1)
            techs = [
                canonicalize_skill(x.strip())
                for x in re.split(r"[,|]", tech_text)
                if x.strip()
            ]

        if not techs:
            techs = extract_skills_from_text(chunk)

        projects.append({
            "name": name,
            "description": chunk[:1800],
            "technologies": list(dict.fromkeys(techs)),
            "link": ""
        })

    return projects


def extract_education_from_text(text: str) -> List[Dict[str, Any]]:
    text = _clean_text(text)

    edu_text = _section(
        text,
        ["EDUCATION"],
        ["CERTIFICATIONS", "PROJECTS", "WORK EXPERIENCE", "SKILLS"]
    )

    if not edu_text:
        return []

    degree = ""
    institution = ""

    degree_match = re.search(
        r"(BS|B\.S|Bachelor|Bachelors|MS|M\.S|Master|Masters|PhD|Intermediate|Matric)[A-Za-z ]{0,80}",
        edu_text,
        flags=re.IGNORECASE
    )

    if degree_match:
        degree = degree_match.group(0).strip()

    inst_match = re.search(
        r"([A-Za-z ]*(University|College|Institute)[A-Za-z ]*)",
        edu_text,
        flags=re.IGNORECASE
    )

    if inst_match:
        institution = inst_match.group(1).strip()

    return [{
        "degree": degree,
        "field": "",
        "institution": institution,
        "from": "",
        "to": "",
        "currently": False
    }]


def ensure_structured_resume(resume_doc_or_structured: Dict[str, Any]) -> Dict[str, Any]:
    structured = resume_doc_or_structured.get("structured") or resume_doc_or_structured

    raw_text = (
        structured.get("raw_text")
        or resume_doc_or_structured.get("scoringText")
        or resume_doc_or_structured.get("scoring_text")
        or resume_doc_or_structured.get("rawText")
        or resume_doc_or_structured.get("markdown")
        or ""
    )

    raw_text = _clean_text(raw_text)

    skills = structured.get("skills") or []
    experience = structured.get("experience") or []
    projects = structured.get("projects") or []
    education = structured.get("education") or []

    if not skills and raw_text:
        skills = extract_skills_from_text(raw_text)

    if not experience and raw_text:
        experience = extract_experience_from_text(raw_text)

    if not projects and raw_text:
        projects = extract_projects_from_text(raw_text)

    if not education and raw_text:
        education = extract_education_from_text(raw_text)

    return {
        **structured,
        "raw_text": raw_text,
        "skills": skills,
        "experience": experience,
        "projects": projects,
        "education": education,
        "certifications": structured.get("certifications") or [],
        "languages": structured.get("languages") or [],
    }