# nlp-service/services/semantic_relevance.py
import re
from typing import Dict, Any, List
from .hf_embeddings import embed_text, cosine_similarity
from .normalizers import normalize_skill_list, canonicalize_skill


def _clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = text.lower()
    text = re.sub(r"[^a-z0-9+#.\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _sim(text1: str, text2: str) -> float:
    text1 = _clean(text1)
    text2 = _clean(text2)

    if not text1 or not text2:
        return 0.0

    return max(0.0, cosine_similarity(embed_text(text1), embed_text(text2)))


def _job_context_text(job_doc: Dict[str, Any]) -> str:
    title = job_doc.get("title") or ""
    desc = job_doc.get("description") or ""
    skills = ", ".join(job_doc.get("skillsRequired", []) or [])
    qualification = job_doc.get("qualification") or ""
    experience = job_doc.get("experience") or ""
    career = job_doc.get("careerLevel") or ""

    return (
        f"Job title: {title}. "
        f"Job description: {desc}. "
        f"Required skills: {skills}. "
        f"Qualification: {qualification}. "
        f"Experience requirement: {experience}. "
        f"Career level: {career}."
    )


def _skill_overlap_score(required_skills: List[str], candidate_text: str) -> float:
    """
    Generic strict skill overlap.
    Works for web, data, design, accounting, HR, etc.
    """
    skills = normalize_skill_list(required_skills)
    text = _clean(candidate_text)

    if not skills:
        return 1.0

    matched = 0

    for skill in skills:
        skill = canonicalize_skill(skill)
        if not skill:
            continue

        # exact phrase match
        if skill in text:
            matched += 1

    return matched / len(skills)


def _keyword_context_overlap(job_text: str, candidate_text: str) -> float:
    """
    Generic context overlap.
    Removes common words and compares meaningful terms.
    This helps prevent irrelevant experience from getting high score.
    """
    stop_words = {
        "the", "a", "an", "and", "or", "to", "for", "with", "in", "on", "of",
        "is", "are", "was", "were", "be", "as", "by", "from", "this", "that",
        "you", "we", "will", "work", "role", "job", "candidate", "required",
        "requirements", "responsibilities", "skills", "experience"
    }

    job_tokens = [
        t for t in _clean(job_text).split()
        if len(t) > 2 and t not in stop_words
    ]

    cand_tokens = set([
        t for t in _clean(candidate_text).split()
        if len(t) > 2 and t not in stop_words
    ])

    if not job_tokens:
        return 0.0

    matched = sum(1 for t in job_tokens if t in cand_tokens)
    return min(1.0, matched / min(len(job_tokens), 30))


def score_experience_relevance_semantic(
    job_doc: Dict[str, Any],
    experience_items: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Generic deterministic experience relevance.
    Experience scores high only if it matches job context and required skills.
    """
    if not experience_items:
        return {"overall_score": 0.0, "items": []}

    job_title = job_doc.get("title") or ""
    job_context = _job_context_text(job_doc)
    required_skills = job_doc.get("skillsRequired", []) or []

    items = []

    for index, exp in enumerate(experience_items):
        exp_title = exp.get("title") or exp.get("jobTitle") or ""
        exp_desc = exp.get("description") or ""
        exp_text = f"{exp_title}. {exp_desc}"

        title_similarity = _sim(job_title, exp_title)
        context_similarity = _sim(job_context, exp_text)
        skill_overlap = _skill_overlap_score(required_skills, exp_text)
        keyword_overlap = _keyword_context_overlap(job_context, exp_text)

        score = (
            0.35 * context_similarity +
            0.30 * skill_overlap +
            0.20 * title_similarity +
            0.15 * keyword_overlap
        )

        # Generic protection:
        # If experience has no required skill overlap and weak keyword overlap,
        # do not allow semantic similarity to over-reward it.
        if required_skills and skill_overlap == 0 and keyword_overlap < 0.20:
            score = min(score, 0.30)

        # If title is unrelated and skills are missing, cap it.
        if title_similarity < 0.35 and skill_overlap == 0:
            score = min(score, 0.35)

        score = max(0.0, min(1.0, score))

        if score >= 0.75:
            label = "high"
        elif score >= 0.50:
            label = "medium"
        elif score >= 0.25:
            label = "low"
        else:
            label = "none"

        items.append({
            "index": index,
            "title": exp_title,
            "relevance_score": round(score, 3),
            "label": label,
            "signals": {
                "title_similarity": round(title_similarity, 3),
                "context_similarity": round(context_similarity, 3),
                "skill_overlap": round(skill_overlap, 3),
                "keyword_overlap": round(keyword_overlap, 3),
            }
        })

    scores = [item["relevance_score"] for item in items]

    best_score = max(scores)
    avg_score = sum(scores) / len(scores)

    # Best relevant experience matters more than average of all old jobs.
    overall = 0.65 * best_score + 0.35 * avg_score

    return {
        "overall_score": round(max(0.0, min(1.0, overall)), 3),
        "items": items
    }


def score_project_relevance_semantic(
    job_doc: Dict[str, Any],
    projects: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Generic deterministic project relevance.
    Project scores high only if it matches job skills/context.
    """
    if not projects:
        return {"overall_score": 0.0, "items": []}

    job_context = _job_context_text(job_doc)
    required_skills = job_doc.get("skillsRequired", []) or []

    items = []

    for index, project in enumerate(projects):
        name = project.get("name") or ""
        desc = project.get("description") or ""
        techs = project.get("technologies", []) or []

        project_text = f"{name}. {desc}. Technologies: {' '.join(techs)}"

        context_similarity = _sim(job_context, project_text)
        skill_overlap = _skill_overlap_score(required_skills, project_text)
        keyword_overlap = _keyword_context_overlap(job_context, project_text)

        score = (
            0.40 * skill_overlap +
            0.35 * context_similarity +
            0.25 * keyword_overlap
        )

        # Generic protection against unrelated/generic projects
        if required_skills and skill_overlap == 0 and keyword_overlap < 0.20:
            score = min(score, 0.30)

        score = max(0.0, min(1.0, score))

        if score >= 0.75:
            label = "high"
        elif score >= 0.50:
            label = "medium"
        elif score >= 0.25:
            label = "low"
        else:
            label = "none"

        items.append({
            "index": index,
            "name": name,
            "relevance_score": round(score, 3),
            "label": label,
            "signals": {
                "context_similarity": round(context_similarity, 3),
                "skill_overlap": round(skill_overlap, 3),
                "keyword_overlap": round(keyword_overlap, 3),
            }
        })

    scores = [item["relevance_score"] for item in items]

    best_score = max(scores)
    avg_score = sum(scores) / len(scores)

    overall = 0.70 * best_score + 0.30 * avg_score

    return {
        "overall_score": round(max(0.0, min(1.0, overall)), 3),
        "items": items
    }