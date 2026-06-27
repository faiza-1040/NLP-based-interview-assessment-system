# nlp-service/services/bm25_search.py
import re
from bs4 import BeautifulSoup
from rank_bm25 import BM25Okapi
from typing import List, Dict, Any


def html_to_text(html: str) -> str:
    if not html:
        return ""

    soup = BeautifulSoup(html, "lxml")
    return soup.get_text(" ", strip=True)


_token_re = re.compile(r"[a-zA-Z0-9]+")


def tokenize(text: str):
    return _token_re.findall((text or "").lower())


def build_doc(job: Dict[str, Any]) -> str:
    parts = []

    title = job.get("title", "")

    # Repeat title to give title more BM25 weight.
    # This helps "data engineer" match title strongly.
    parts.append(title)
    parts.append(title)
    parts.append(title)
    parts.append(title)

    parts.append(html_to_text(job.get("description", "")))

    skills = job.get("skillsRequired") or []

    if isinstance(skills, list):
        parts.append(" ".join([str(s) for s in skills]))

    parts.append(job.get("companyName", ""))
    parts.append(job.get("workArrangement", ""))
    parts.append(job.get("jobLocation", ""))
    parts.append(job.get("remoteLocation", ""))

    return " ".join([str(p) for p in parts if p])


def bm25_rank(query: str, jobs: List[Dict[str, Any]]):
    if not jobs:
        return []

    docs = [build_doc(j) for j in jobs]
    tokenized_docs = [tokenize(d) for d in docs]

    query_tokens = tokenize(query)

    if len(query_tokens) == 0:
        return []

    bm25 = BM25Okapi(tokenized_docs)
    scores = bm25.get_scores(query_tokens)

    ranked = sorted(
        zip(jobs, scores),
        key=lambda x: float(x[1]),
        reverse=True,
    )

    # Important:
    # Do not return zero-score jobs.
    # Zero-score jobs are unrelated jobs.
    out = [
        {
            "id": str(j["id"]),
            "score": float(score),
        }
        for j, score in ranked
        if float(score) > 0
    ]

    return out