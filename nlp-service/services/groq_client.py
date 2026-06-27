
#nlp-service/services/groq_client.py

import os
import json
import re
from groq import Groq
from .resume_structured_fallback import ensure_structured_resume

_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def build_resume_prompt(clean_text: str) -> str:
    return f"""
You are a resume parsing engine.

You receive merged cleaned text extracted from a CV.
You must return ONLY valid JSON in the following exact schema, with no markdown fences, no explanation:

{{
  "markdown": "string",
  "structured": {{
    "name": "string",
    "address": "string",
    "email": "string",
    "phone": "string",
    "summary": "string",
    "skills": [ "skill1", "skill2" ],
    "education": [
      {{
        "degree": "",
        "field": "",
        "institution": "",
        "from": "",
        "to": "",
        "currently": false
      }}
    ],
    "experience": [
      {{
        "title": "",
        "company": "",
        "from": "",
        "to": "",
        "currently": false,
        "description": ""
      }}
    ],
    "languages": [
      {{
        "language": "",
        "level": ""
      }}
    ],
    "certifications": [
      {{
        "name": "",
        "issuer": "",
        "date": ""
      }}
    ],
    "projects": [
      {{
        "name": "",
        "description": "",
        "technologies": [""],
        "link": ""
      }}
    ],
    "hobbies": "string"
  }},
  "scoring_text": "string"
}}

CRITICAL RULES (DO NOT BREAK THEM):
- You MUST output JSON ONLY.
- JSON must begin with {{ and end with }}.
- DO NOT include ```json``` fences or any commentary.
- All fields must exist even if empty.

ADDITIONAL RULES FOR "markdown":
- Produce a CLEAN, FORMATTED resume using Markdown.
- Use H2 section headers (e.g., ## Summary, ## Experience).
- Group content clearly under the correct sections.
- Bullet points where appropriate.
- No raw OCR, no unnecessary symbols.

ADDITIONAL RULES FOR "scoring_text":
- Produce a clean, grouped, human-readable plaintext resume.
- Use uppercase section headers:
  SUMMARY, EDUCATION, EXPERIENCE, PROJECTS, SKILLS, CERTIFICATIONS, LANGUAGES, AWARDS, REFERENCES, OTHER
- Group items under appropriate sections.
- Normalize common variations:
  "Work History", "Employment", "Professional Experience" → EXPERIENCE
  "Academics", "Qualifications" → EDUCATION
  "Tools", "Tech Stack", "Expertise" → SKILLS
  "Awards", "Achievements" → AWARDS
- If a section does not exist, OMIT it.
- If an unknown section exists, include it under OTHER.
- DO NOT output JSON here—only plaintext inside the JSON string.
- DO NOT output raw OCR.

TEXT:
-------------------------
{clean_text}
-------------------------
""".strip()


def _extract_json_block(content: str) -> str:
    # drop code fences if present
    content = content.strip()
    if content.startswith("```"):
        parts = content.split("```")
        # take the part inside fences if available
        if len(parts) >= 2:
            content = parts[1].lstrip("json").strip()
    # get first {...last}
    start = content.find("{")
    end = content.rfind("}")
    if start != -1 and end != -1:
        return content[start:end + 1]
    return content


def parse_resume_with_groq(clean_text: str):
    prompt = build_resume_prompt(clean_text)

    try:
        resp = _client.chat.completions.create(
            model=os.getenv("GROQ_TEXT_MODEL", "llama-3.3-70b-versatile"),
            messages=[
                {
                    "role": "system",
                    "content": "You are a strict JSON resume parser. Return valid JSON only."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,
            max_tokens=4000,
            response_format={"type": "json_object"},
        )

        raw = resp.choices[0].message.content or ""
        print("GROQ RAW RESPONSE FIRST 500:", raw[:500])

        json_str = _extract_json_block(raw)
        data = json.loads(json_str)

        markdown = data.get("markdown") or clean_text
        scoring_text = data.get("scoring_text") or markdown or clean_text
        structured = data.get("structured") or {}

        # ✅ Important: even if Groq returns empty arrays, fallback fills them
        structured = ensure_structured_resume({
            "structured": structured,
            "scoringText": scoring_text,
            "rawText": clean_text,
            "markdown": markdown,
        })

        print("\n===== GROQ STRUCTURED DEBUG =====")
        print("SKILLS:", structured.get("skills"))
        print("EXPERIENCE COUNT:", len(structured.get("experience", []) or []))
        print("PROJECTS COUNT:", len(structured.get("projects", []) or []))
        print("EDUCATION COUNT:", len(structured.get("education", []) or []))
        print("=================================\n")

        return scoring_text, structured, markdown

    except Exception as e:
        print("Groq parse failed. Using deterministic fallback. Error:", e)

        # ✅ Important: do NOT return only raw_text
        structured = ensure_structured_resume({
            "structured": {"raw_text": clean_text},
            "scoringText": clean_text,
            "rawText": clean_text,
            "markdown": clean_text,
        })

        print("\n===== FALLBACK STRUCTURED DEBUG =====")
        print("SKILLS:", structured.get("skills"))
        print("EXPERIENCE COUNT:", len(structured.get("experience", []) or []))
        print("PROJECTS COUNT:", len(structured.get("projects", []) or []))
        print("EDUCATION COUNT:", len(structured.get("education", []) or []))
        print("=====================================\n")

        return clean_text, structured, clean_text