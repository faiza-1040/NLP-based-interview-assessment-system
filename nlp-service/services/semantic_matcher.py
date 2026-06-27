

# # nlp-service/services/semantic_matcher.py
from typing import Dict, Any
from .hf_embeddings import embed_text, cosine_similarity
from .text_builders import build_job_text, build_resume_text
from .rule_matcher import compute_rule_match
from .sanitizer import sanitize_resume_text


def compute_hybrid_match(job_doc: Dict[str, Any],
                         resume_doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Hybrid ATS scoring:
    - Rule-based matching (main)
    - Semantic similarity (supporting only)
    """

    job_text = build_job_text(job_doc)
    resume_text = build_resume_text(resume_doc)

    sanitized_job_text, _ = sanitize_resume_text(job_text)
    sanitized_resume_text, _ = sanitize_resume_text(resume_text)

    job_emb = embed_text(sanitized_job_text)
    cv_emb = embed_text(sanitized_resume_text)

    sim = cosine_similarity(job_emb, cv_emb)
    semantic_score = max(0, min(100, round(sim * 100)))

    structured = resume_doc.get("structured")
    if structured:
        rule_result = compute_rule_match(job_doc, structured)
        rule_score = rule_result["rule_score"]
        breakdown = rule_result["breakdown"]
    else:
        rule_score = semantic_score
        breakdown = {
            "note": "No structured resume provided; rule score mirrors semantic score."
        }

    w_rule, w_sem = 0.90, 0.10
    final_score = round(w_rule * rule_score + w_sem * semantic_score)
    print("\n===== HYBRID DEBUG =====")
    print("SEMANTIC SCORE:", semantic_score)
    print("RULE SCORE:", rule_score)
    print("FINAL SCORE:", final_score)
    print("========================\n")

    return {
        "similarity": sim,
        "semantic_score": semantic_score,
        "rule_score": rule_score,
        "final_score": final_score,
        "breakdown": breakdown,
    }