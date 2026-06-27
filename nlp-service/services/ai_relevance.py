# //nlp-service/services/ai_relevance.py
import json
from typing import Dict, Any, List
from .llm_client import groq_chat_json


def _safe_float(value, default=0.0):
    try:
        v = float(value)
        if v < 0:
            return 0.0
        if v > 1:
            return 1.0
        return v
    except Exception:
        return default


def score_experience_relevance(job_doc: Dict[str, Any], experience_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not experience_items:
        return {"overall_score": 0.0, "items": []}

    job_payload = {
        "title": job_doc.get("title", ""),
        "description": job_doc.get("description", ""),
        "skillsRequired": job_doc.get("skillsRequired", []) or [],
        "qualification": job_doc.get("qualification", ""),
        "experience": job_doc.get("experience", ""),
        "careerLevel": job_doc.get("careerLevel", ""),
    }

    exp_payload = []
    for exp in experience_items:
        exp_payload.append({
            "title": exp.get("title") or exp.get("jobTitle") or "",
            "company": exp.get("company", ""),
            "description": exp.get("description", ""),
            "from": exp.get("from", ""),
            "to": exp.get("to", ""),
            "currently": exp.get("currently") or exp.get("currentlyWorking") or False,
        })

    messages = [
        {
            "role": "system",
            "content": (
                "You are a strict hiring relevance evaluator. "
                "Score how relevant each candidate experience item is for the given target job. "
                "Unrelated roles like data entry, admin, clerk, customer support, or office work "
                "must score low for technical jobs unless strong overlap exists. "
                "Return JSON only."
            ),
        },
        {
            "role": "user",
            "content": json.dumps({
                "task": "Evaluate experience relevance for the target job.",
                "job": job_payload,
                "experience_items": exp_payload,
                "required_output_schema": {
                    "items": [
                        {
                            "index": 0,
                            "relevance_score": 0.0,
                            "label": "high|medium|low|none",
                            "reason": "short explanation"
                        }
                    ],
                    "overall_score": 0.0
                }
            })
        }
    ]

    result = groq_chat_json(messages, temperature=0.1, max_tokens=1200)

    items = result.get("items", []) or []
    cleaned_items = []

    for i, item in enumerate(items):
        cleaned_items.append({
            "index": item.get("index", i),
            "relevance_score": _safe_float(item.get("relevance_score", 0.0)),
            "label": item.get("label", "low"),
            "reason": item.get("reason", "")
        })

    overall = _safe_float(result.get("overall_score", 0.0))
    if not cleaned_items and exp_payload:
        overall = 0.0

    return {
        "overall_score": overall,
        "items": cleaned_items
    }


def score_project_relevance(job_doc: Dict[str, Any], projects: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not projects:
        return {"overall_score": 0.0, "items": []}

    job_payload = {
        "title": job_doc.get("title", ""),
        "description": job_doc.get("description", ""),
        "skillsRequired": job_doc.get("skillsRequired", []) or [],
        "qualification": job_doc.get("qualification", ""),
        "experience": job_doc.get("experience", ""),
        "careerLevel": job_doc.get("careerLevel", ""),
    }

    project_payload = []
    for p in projects:
        project_payload.append({
            "name": p.get("name", ""),
            "description": p.get("description", ""),
            "technologies": p.get("technologies", []) or [],
            "link": p.get("link", ""),
        })

    messages = [
        {
            "role": "system",
            "content": (
                "You are a strict hiring relevance evaluator. "
                "Score how relevant each candidate project is for the given target job. "
                "Projects that directly use required technologies or solve similar problems should score high. "
                "Generic or unrelated projects should score low. "
                "Return JSON only."
            ),
        },
        {
            "role": "user",
            "content": json.dumps({
                "task": "Evaluate project relevance for the target job.",
                "job": job_payload,
                "projects": project_payload,
                "required_output_schema": {
                    "items": [
                        {
                            "index": 0,
                            "relevance_score": 0.0,
                            "label": "high|medium|low|none",
                            "reason": "short explanation"
                        }
                    ],
                    "overall_score": 0.0
                }
            })
        }
    ]

    result = groq_chat_json(messages, temperature=0.1, max_tokens=1200)

    items = result.get("items", []) or []
    cleaned_items = []

    for i, item in enumerate(items):
        cleaned_items.append({
            "index": item.get("index", i),
            "relevance_score": _safe_float(item.get("relevance_score", 0.0)),
            "label": item.get("label", "low"),
            "reason": item.get("reason", "")
        })

    overall = _safe_float(result.get("overall_score", 0.0))
    if not cleaned_items and project_payload:
        overall = 0.0

    return {
        "overall_score": overall,
        "items": cleaned_items
    }
