#nlp-service/services/normalizers.py
import re
from typing import List

SKILL_ALIASES = {
    "react": ["react", "reactjs", "react.js", "react js"],
    "next": ["next", "nextjs", "next.js", "next js"],
    "redux": ["redux", "redux toolkit", "rtk"],

    "node": ["node", "nodejs", "node.js", "node js"],
    "express": ["express", "expressjs", "express.js", "express js"],
    "javascript": ["javascript", "js", "java script", "es6", "es6+"],
    "typescript": ["typescript", "ts", "type script"],
    "html": ["html", "html5"],
    "css": ["css", "css3"],
    "rest api": ["rest api", "restful api", "restful apis", "api integration", "api development"],

    "mongodb": ["mongodb", "mongo db", "mongo"],
    "mysql": ["mysql", "my sql"],
    "postgresql": ["postgresql", "postgres", "postgre sql"],
    "sql": ["sql", "structured query language"],

    "python": ["python"],
    "java": ["java"],
    "c++": ["c++", "cpp"],

    "machine learning": ["machine learning", "ml"],
    "deep learning": ["deep learning", "dl"],
    "nlp": ["nlp", "natural language processing"],
    "data analysis": ["data analysis", "data analytics"],
    "power bi": ["power bi", "powerbi"],
    "tableau": ["tableau"],
    "excel": ["excel", "ms excel", "microsoft excel"],

    "git": ["git", "github", "git/github", "git and github"],
    "docker": ["docker"],

    "figma": ["figma"],
    "photoshop": ["photoshop", "adobe photoshop"],
    "illustrator": ["illustrator", "adobe illustrator"],
    "canva": ["canva"],

    "seo": ["seo", "search engine optimization"],
    "content writing": ["content writing", "copywriting", "blog writing"],

    "accounting": ["accounting", "bookkeeping"],
    "quickbooks": ["quickbooks"],
    "communication": ["communication", "communication skills"],
}


TITLE_ALIASES = {
    "frontend developer": [
        "frontend developer", "front end developer", "frontend engineer",
        "front end engineer", "react developer", "ui developer"
    ],
    "backend developer": [
        "backend developer", "back end developer", "backend engineer",
        "node developer", "api developer"
    ],
    "full stack developer": [
        "full stack developer", "fullstack developer",
        "mern developer", "software engineer", "software developer"
    ],
    "web developer": [
        "web developer", "website developer"
    ],
    "data analyst": [
        "data analyst", "business analyst", "bi analyst",
        "data analytics", "reporting analyst"
    ],
    "machine learning engineer": [
        "machine learning engineer", "ml engineer", "ai engineer",
        "data scientist"
    ],
    "graphic designer": [
        "graphic designer", "visual designer", "creative designer",
        "ui designer"
    ],
    "accountant": [
        "accountant", "accounts officer", "bookkeeper"
    ],
    "hr officer": [
        "hr officer", "human resource officer", "recruiter",
        "talent acquisition"
    ],
    "data entry": [
        "data entry", "data entry operator", "office clerk",
        "clerk", "computer operator"
    ],
}


def _clean_text(value: str) -> str:
    value = (value or "").strip().lower()
    value = value.replace("&", " and ")
    value = re.sub(r"[\._\-\/]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def canonicalize_skill(value: str) -> str:
    v = _clean_text(value)
    for canon, aliases in SKILL_ALIASES.items():
        if v == canon or v in aliases:
            return canon
    return v


def canonicalize_title(value: str) -> str:
    v = _clean_text(value)
    for canon, aliases in TITLE_ALIASES.items():
        if v == canon or v in aliases:
            return canon
    return v


def normalize_skill_list(skills: List[str]) -> List[str]:
    seen = set()
    out = []
    for s in skills or []:
        c = canonicalize_skill(s)
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out