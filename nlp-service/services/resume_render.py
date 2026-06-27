# nlp-service/services/resume_render.py
import json
from typing import Any, Dict, Optional

from services.llm_client import groq_chat_json


def sanitize_resume_json(input_data: Any) -> Any:
    """
    Python port of your Node sanitizeResumeJson.
    Removes noisy fields and internal Mongo fields.
    """
    if not isinstance(input_data, dict):
        return input_data

    r = dict(input_data)

    # remove noisy / irrelevant fields
    for k in [
        "_id",
        "__v",
        "createdAt",
        "updatedAt",
        "viewModel",
        "selectedTemplateImage",
        "selectedTemplateName",
        "themeColor",
        "templateId",
    ]:
        r.pop(k, None)

    def strip_row_id(row: Any) -> Any:
        if not isinstance(row, dict):
            return row
        x = dict(row)
        x.pop("_id", None)
        return x

    for arr_key in ["education", "experience", "projects", "certifications", "languages"]:
        if isinstance(r.get(arr_key), list):
            r[arr_key] = [strip_row_id(x) for x in r[arr_key]]

    # keep customSections as-is (do NOT strip)
    # If customSections rows have _id and you want to strip them too, uncomment below:
    # if isinstance(r.get("customSections"), list):
    #     r["customSections"] = [strip_row_id(x) for x in r["customSections"]]

    return r


def render_resume_view_model(
    *,
    user_id: str,
    template_id: str,
    resume_json: Dict[str, Any],
    job_title: str = "",
    theme_color: Optional[str] = "#111827",
) -> Dict[str, Any]:
    cleaned = sanitize_resume_json(resume_json)

    system = """
You are a resume formatter.
Return ONLY valid JSON. No markdown. No commentary.
Transform input resume JSON into a template-ready view model.

Rules:
- Never invent degrees, companies, dates, certifications.
- You MAY rewrite summary and experience bullets to be clearer, but keep meaning.
- Convert experience.description into bullets array.
- Ensure arrays exist even if empty.
- Limit bullets per job to max 5.
- Skills max 20 items, dedupe.
- Dates format: "2022 – Present" or "2021 – 2023".
- IMPORTANT: If INPUT has customSections, include them in output (do not invent new ones).
- For customSections: keep title, keep content. You may also provide bullets by splitting content lines.
""".strip()

    schema_hint = """
Return JSON with keys:
templateId,
themeColor,
header{name,email,phone,address},
summary,
education[{degree,institution,dateRange}],
experience[{role,company,dateRange,bullets}],
projects[{name,link,description,tech}],
certifications[{name,issuer,date}],
languages[{name,level}],
skills,
customSections[{title, content, bullets}]
Template rules:
- classic: summary minimal cleanup
- modern: stronger summary, tighter bullets
- compact: summary 2-3 lines, bullets max 3/job, skills max 12
""".strip()

    prompt = f"""
Template selected: {template_id}
Job Title context (optional): {job_title or ""}

{schema_hint}

IMPORTANT:
Return ONLY valid JSON matching the schema exactly.

INPUT RESUME JSON:
{json.dumps(cleaned, ensure_ascii=False)}
""".strip()

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]

    view_model = groq_chat_json(
        messages=messages,
        temperature=0.2,
        max_tokens=1200,
    )

    # Enforce dict
    if not isinstance(view_model, dict):
        view_model = {}

    # Ensure arrays exist
    if not isinstance(view_model.get("education"), list):
        view_model["education"] = []
    if not isinstance(view_model.get("experience"), list):
        view_model["experience"] = []
    if not isinstance(view_model.get("projects"), list):
        view_model["projects"] = []
    if not isinstance(view_model.get("certifications"), list):
        view_model["certifications"] = []
    if not isinstance(view_model.get("languages"), list):
        view_model["languages"] = []
    if not isinstance(view_model.get("skills"), list):
        view_model["skills"] = []

    # Ensure customSections exist
    if not isinstance(view_model.get("customSections"), list):
        view_model["customSections"] = []

    # enforce required fields
    view_model["templateId"] = template_id
    view_model["themeColor"] = theme_color or "#111827"

    return view_model
