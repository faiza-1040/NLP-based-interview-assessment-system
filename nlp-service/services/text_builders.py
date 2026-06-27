

import re
from typing import Dict, Any


def _clean_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def build_job_text(job: Dict[str, Any]) -> str:
    title = job.get("title") or ""
    desc = _clean_html(job.get("description") or "")
    skills = job.get("skillsRequired", []) or []
    exp = job.get("experience") or ""
    qualification = job.get("qualification") or ""
    career_level = job.get("careerLevel") or ""

    return (
        f"{title}\n"
        f"{desc}\n"
        f"Required skills: {', '.join(skills)}\n"
        f"Experience requirement: {exp}\n"
        f"Qualification: {qualification}\n"
        f"Career level: {career_level}"
    ).strip()


def build_resume_text(resume_doc: Dict[str, Any]) -> str:
    structured = resume_doc.get("structured") or {}

    skills = ", ".join(structured.get("skills", []) or [])

    projects = " ".join([
        f"{p.get('name','')} {p.get('description','')} {' '.join(p.get('technologies', []) or [])}"
        for p in (structured.get("projects", []) or [])
    ])

    experience = " ".join([
        f"{e.get('title','') or e.get('jobTitle','')} {e.get('description','')}"
        for e in (structured.get("experience", []) or [])
    ])

    education = " ".join([
        f"{e.get('degree','')} {e.get('field','')} {e.get('institution','')}"
        for e in (structured.get("education", []) or [])
    ])

    return (
        f"Skills: {skills}\n"
        f"Experience: {experience}\n"
        f"Projects: {projects}\n"
        f"Education: {education}"
    ).strip()