# nlp-service/main.py
import os
import traceback
from typing import Any, Dict, List

from services.resume_render import render_resume_view_model
from services.bm25_search import bm25_rank
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()  # load HF_API_TOKEN, HF_MODEL_ID etc.

from services.resume_pipeline import run_resume_pipeline, run_builder_resume_pipeline
# from services.semantic_matcher import compute_sbert_match
from services.semantic_matcher import compute_hybrid_match
from services.pdf_generator import generate_resume_pdf_bytes

from services.bm25_index import BM25Index
bm25_index = BM25Index()
from interview_routes import router as interview_router
from mockInterview_routes import router as mock_interview_router


app = FastAPI(title="TalentHire NLP Service")
# ---------------- Resume PDF generation endpoint ----------------

class ResumePdfRequest(BaseModel):
    userId: str
    templateId: str
    viewModel: Dict[str, Any]
    themeColor: str | None = "#111827"


@app.post("/resume/generate-pdf")
def generate_pdf(req: ResumePdfRequest):
    pdf_bytes = generate_resume_pdf_bytes(
        req.viewModel,
        req.themeColor or "#111827"
    )

    filename = f"resume_{req.userId}_{req.templateId}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


# ---------------- Existing models / endpoints ----------------

class ProcessResumeRequest(BaseModel):
    source_type: str
    file_url: str | None = None
    user_id: str
    resume_json: Dict[str, Any] | None = None


class ProcessResumeResponse(BaseModel):
    scoring_text: str
    structured: dict
    markdown: str | None = None


@app.get("/health")
def health():
    return {"status": "ok"}

# ---------------- Resume Render (viewModel generation) endpoint ----------------

class ResumeRenderRequest(BaseModel):
    userId: str
    templateId: str
    resumeJson: Dict[str, Any]
    jobTitle: str | None = ""
    themeColor: str | None = "#111827"


@app.post("/resume/render")
def resume_render(req: ResumeRenderRequest):
    if not req.userId or not req.templateId or not req.resumeJson:
        raise HTTPException(status_code=400, detail="userId, templateId, resumeJson are required")

    try:
        vm = render_resume_view_model(
            user_id=req.userId,
            template_id=req.templateId,
            resume_json=req.resumeJson,
            job_title=req.jobTitle or "",
            theme_color=req.themeColor or "#111827",
        )
        return {"templateId": req.templateId, "viewModel": vm}
    except Exception as e:
        print("Error in /resume/render:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to render resume")

@app.post("/process-resume", response_model=ProcessResumeResponse)
def process_resume(req: ProcessResumeRequest):
    if req.source_type not in {"uploaded_pdf", "builder_form"}:
        raise HTTPException(status_code=400, detail="Unsupported source_type")

    try:
        if req.source_type == "uploaded_pdf":
            if not req.file_url:
                raise HTTPException(status_code=400, detail="file_url is required for uploaded_pdf")

            result = run_resume_pipeline(req.file_url)
            return ProcessResumeResponse(**result)

        if req.source_type == "builder_form":
            if not req.resume_json:
                raise HTTPException(status_code=400, detail="resume_json is required for builder_form")

            result = run_builder_resume_pipeline(req.resume_json)
            return ProcessResumeResponse(**result)

    except HTTPException:
        raise

    except Exception as e:
        print("Error in /process-resume:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ---------------- New SBERT match endpoint ----------------

class MatchRequest(BaseModel):
    job: Dict[str, Any]     # your full Job document JSON
    resume: Dict[str, Any]  # your processed Resume document JSON (with scoringText)

# class MatchResponse(BaseModel):
#     similarity: float
#     score: int

class MatchResponse(BaseModel):
    similarity: float
    semantic_score: int
    rule_score: int
    final_score: int
    breakdown: Dict[str, Any]


@app.post("/match-job", response_model=MatchResponse)
def match_job(req: MatchRequest):
    """
    Compute SBERT-based similarity between a job posting and a processed resume.
    This does NOT touch existing resume pipeline logic.
    """
    try:
        # result = compute_sbert_match(req.job, req.resume)
        result = compute_hybrid_match(req.job, req.resume)
        return MatchResponse(**result)
    except Exception as e:
        print("Error in /match-job:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
# ---------------- BM25 ranking endpoint ----------------

class BM25Job(BaseModel):
    id: str
    title: str = ""
    description: str = ""
    skillsRequired: List[str] = []
    companyName: str = ""

    workArrangement: str = ""
    jobLocation: str = ""
    remoteLocation: str = ""



class BM25Request(BaseModel):
    query: str
    jobs: List[BM25Job]

class BM25IndexRequest(BaseModel):
    jobs: List[BM25Job]

class BM25QueryRequest(BaseModel):
    query: str


@app.post("/bm25/rank")
# def bm25_rank_endpoint(req: BM25Request):
#     try:
#         ranked = bm25_rank(req.query.strip(), [j.model_dump() for j in req.jobs])
#         return {"ranked": ranked}
#     except Exception as e:
#         print("Error in /bm25/rank:", e)
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=str(e))
def bm25_rank_endpoint(req: BM25Request):
    query = (req.query or "").strip()
    jobs = req.jobs or []

    if len(jobs) == 0:
        return {"ranked": []}

    # ✅ convert Pydantic models to dicts
    jobs_dict = [j.model_dump() for j in jobs]

    if query == "" or len(query) < 3:
        return {"ranked": []}
    ranked = bm25_rank(query, jobs_dict)
    return {"ranked": ranked}


@app.post("/bm25/index")
def bm25_build_index(req: BM25IndexRequest):
    jobs_dict = [j.model_dump() for j in (req.jobs or [])]
    bm25_index.rebuild(jobs_dict)
    return {"ok": True, "count": bm25_index.count(), "version": bm25_index.version}

@app.post("/bm25/rank-index")
def bm25_rank_from_index(req: BM25QueryRequest):
    query = (req.query or "").strip()
    if not query:
        return {"ranked": [], "version": bm25_index.version}
    ranked = bm25_index.rank(query)
    return {"ranked": ranked, "version": bm25_index.version}
app.include_router(interview_router)
app.include_router(mock_interview_router)
