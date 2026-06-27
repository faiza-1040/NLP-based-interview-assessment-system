
#nlp-service/services/bm25_index.py
import re
from typing import List, Dict, Any
from bs4 import BeautifulSoup
from rank_bm25 import BM25Okapi

_token_re = re.compile(r"[a-zA-Z0-9]+")

def tokenize(text: str):
    return _token_re.findall((text or "").lower())

def html_to_text(html: str) -> str:
    if not html:
        return ""
    soup = BeautifulSoup(html, "lxml")  # you have lxml
    return soup.get_text(" ", strip=True)

def build_doc(job: dict) -> str:
    parts = []
    title = job.get("title", "")
    parts.append(title)
    parts.append(title)  # weight title

    parts.append(html_to_text(job.get("description", "")))

    skills = job.get("skillsRequired") or []
    if isinstance(skills, list):
        parts.append(" ".join(skills))

    parts.append(job.get("companyName", ""))
    parts.append(job.get("workArrangement", ""))
    parts.append(job.get("jobLocation", ""))
    parts.append(job.get("remoteLocation", ""))

    return " ".join([p for p in parts if p])

class BM25Index:
    def __init__(self):
        self.doc_ids: List[str] = []
        self.tokens: List[List[str]] = []
        self.bm25: BM25Okapi | None = None
        self.version: int = 0

    def rebuild(self, jobs: List[Dict[str, Any]]):
        self.doc_ids = [str(j.get("id")) for j in jobs]
        docs = [build_doc(j) for j in jobs]
        self.tokens = [tokenize(d) for d in docs]
        self.bm25 = BM25Okapi(self.tokens) if self.tokens else None
        self.version += 1

    def count(self) -> int:
        return len(self.doc_ids)

    def rank(self, query: str):
        if not self.bm25 or not self.doc_ids:
            return []

        q_tokens = tokenize(query)
        if not q_tokens:
            return []

        scores = self.bm25.get_scores(q_tokens)

        ranked_pairs = sorted(
            zip(self.doc_ids, scores),
            key=lambda x: float(x[1]),
            reverse=True
        )

        return [{"id": doc_id, "score": float(score)} for doc_id, score in ranked_pairs]
