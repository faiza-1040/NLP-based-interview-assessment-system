# nlp-service/services/resume_pipeline.py
from .docling_ocr import extract_clean_text_from_url
from .groq_client import parse_resume_with_groq
from .sanitizer import sanitize_resume_text
from .resume_structured_fallback import ensure_structured_resume


def _safe(value):
    return str(value).strip() if value is not None else ""


def _date_range(item):
    from_month = _safe(item.get("fromMonth"))
    from_year = _safe(item.get("fromYear"))
    to_month = _safe(item.get("toMonth"))
    to_year = _safe(item.get("toYear"))

    start = " ".join([x for x in [from_month, from_year] if x])
    end = "Present" if item.get("currentlyWorking") or item.get("currentlyEnrolled") else " ".join(
        [x for x in [to_month, to_year] if x]
    )

    if start and end:
        return f"{start} - {end}"
    if start:
        return start
    if end:
        return end
    return ""


def _split_bullets(text):
    lines = []

    for line in _safe(text).splitlines():
        line = line.strip().lstrip("-").lstrip("•").strip()
        if line:
            lines.append(line)

    return lines


def run_builder_resume_pipeline(resume_json: dict):
    """
    Converts Resume Builder JSON directly into ProcessedResume format.
    This avoids sending builder resumes through OCR/Groq.
    """

    resume_json = resume_json or {}

    personal = resume_json.get("personalDetails") or {}

    skills = []

    if isinstance(resume_json.get("skillItems"), list):
        for item in resume_json.get("skillItems") or []:
            name = _safe(item.get("name"))
            if name:
                skills.append(name)

    if not skills and isinstance(resume_json.get("skills"), list):
        skills = [_safe(s) for s in resume_json.get("skills") or [] if _safe(s)]

    experience = []
    for item in resume_json.get("experience") or []:
        bullets = _split_bullets(item.get("description"))

        experience.append({
            "title": _safe(item.get("jobTitle")),
            "jobTitle": _safe(item.get("jobTitle")),
            "company": _safe(item.get("company")),
            "description": " ".join(bullets) or _safe(item.get("description")),
            "bullets": bullets,
            "from": " ".join([x for x in [_safe(item.get("fromMonth")), _safe(item.get("fromYear"))] if x]),
            "to": "Present" if item.get("currentlyWorking") else " ".join(
                [x for x in [_safe(item.get("toMonth")), _safe(item.get("toYear"))] if x]
            ),
            "dateRange": _date_range(item),
            "currentlyWorking": bool(item.get("currentlyWorking")),
        })

    education = []
    for item in resume_json.get("education") or []:
        degree = " - ".join(
            [x for x in [_safe(item.get("level")), _safe(item.get("field"))] if x]
        )

        education.append({
            "degree": degree,
            "level": _safe(item.get("level")),
            "field": _safe(item.get("field")),
            "institution": _safe(item.get("institution")),
            "from": _safe(item.get("fromYear")),
            "to": "Present" if item.get("currentlyEnrolled") else _safe(item.get("toYear")),
            "dateRange": _date_range(item),
            "grade": _safe(item.get("grade")),
        })

    projects = []
    for item in resume_json.get("projects") or []:
        projects.append({
            "name": _safe(item.get("name")),
            "description": _safe(item.get("description")),
            "link": _safe(item.get("link")),
            "technologies": item.get("technologies") if isinstance(item.get("technologies"), list) else [],
        })

    certifications = []
    for item in resume_json.get("certifications") or []:
        certifications.append({
            "name": _safe(item.get("name")),
            "issuer": _safe(item.get("issuedBy")),
            "issuedBy": _safe(item.get("issuedBy")),
            "date": _safe(item.get("date")),
        })

    languages = []
    for item in resume_json.get("languages") or []:
        languages.append({
            "language": _safe(item.get("language")),
            "name": _safe(item.get("language")),
            "level": _safe(item.get("level")),
        })

    custom_sections = []
    for item in resume_json.get("customSections") or []:
        custom_sections.append({
            "title": _safe(item.get("title")),
            "content": _safe(item.get("content")),
            "bullets": _split_bullets(item.get("content")),
        })

    summary = _safe(resume_json.get("summary"))

    scoring_parts = [
        _safe(personal.get("fullName")),
        _safe(personal.get("jobTitle")),
        summary,
        "Skills: " + ", ".join(skills),
        "Experience: " + " ".join(
            [
                f"{x.get('title')} {x.get('company')} {x.get('description')}"
                for x in experience
            ]
        ),
        "Projects: " + " ".join(
            [
                f"{x.get('name')} {x.get('description')} {' '.join(x.get('technologies') or [])}"
                for x in projects
            ]
        ),
        "Education: " + " ".join(
            [
                f"{x.get('degree')} {x.get('institution')}"
                for x in education
            ]
        ),
        "Certifications: " + " ".join(
            [
                f"{x.get('name')} {x.get('issuer')}"
                for x in certifications
            ]
        ),
    ]

    scoring_text = "\n".join([x for x in scoring_parts if _safe(x)])

    structured = {
        "raw_text": scoring_text,
        "name": _safe(personal.get("fullName")),
        "title": _safe(personal.get("jobTitle")),
        "summary": summary,
        "skills": skills,
        "experience": experience,
        "projects": projects,
        "education": education,
        "certifications": certifications,
        "languages": languages,
        "customSections": custom_sections,
    }

    structured = ensure_structured_resume({
        "structured": structured,
        "scoringText": scoring_text,
        "rawText": scoring_text,
        "markdown": scoring_text,
    })

    return {
        "scoring_text": scoring_text,
        "structured": structured,
        "markdown": scoring_text,
    }


def run_resume_pipeline(file_url: str):
    clean_text = extract_clean_text_from_url(file_url)

    sanitized_text, pii_found = sanitize_resume_text(clean_text)

    print("\n===== SANITIZED DEBUG =====")
    print("SANITIZED TEXT:\n", sanitized_text[:500])
    print("PII FOUND:", pii_found)
    print("===========================\n")

    scoring_text, structured, markdown = parse_resume_with_groq(sanitized_text)

    structured = ensure_structured_resume({
        "structured": structured or {},
        "scoringText": scoring_text or sanitized_text,
        "rawText": sanitized_text,
        "markdown": markdown or "",
    })

    print("\n===== PIPELINE FINAL STRUCTURED DEBUG =====")
    print("SKILLS:", structured.get("skills"))
    print("EXPERIENCE COUNT:", len(structured.get("experience", []) or []))
    print("PROJECTS COUNT:", len(structured.get("projects", []) or []))
    print("EDUCATION COUNT:", len(structured.get("education", []) or []))
    print("==========================================\n")

    return {
        "scoring_text": scoring_text or sanitized_text,
        "structured": structured,
        "markdown": markdown or scoring_text or sanitized_text,
    }
