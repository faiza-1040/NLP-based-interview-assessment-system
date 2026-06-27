# nlp-service/interview_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from services.interview_service import generate_questions, evaluate_answer
from services.camera_detection import analyze_frame, get_status

router = APIRouter(prefix="/interview", tags=["interview"])


class GenerateQuestionsRequest(BaseModel):
    jobTitle: str
    jobDescription: str
    mustHaveSkills: List[str] = []
    niceToHaveSkills: List[str] = []
    candidateSkills: List[str] = []
    matchedSkills: List[str] = []
    missingSkills: List[str] = []
    weights: Dict[str, Any] = {}
    questionCount: int = 8
    jobRequirements: Dict[str, Any] = {}


class EvaluateAnswerRequest(BaseModel):
    question: str
    answer: str
    skill: Optional[str] = None
    jobTitle: Optional[str] = None
    jobDescription: Optional[str] = None
    mustHaveSkills: List[str] = []
    candidateSkills: List[str] = []
    meta: Dict[str, Any] = {}


class CameraFrameRequest(BaseModel):
    interviewId: str
    imageBase64: str


@router.post("/generate-questions")
def generate(req: GenerateQuestionsRequest):
    try:
        return generate_questions(req.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evaluate-answer")
def evaluate(req: EvaluateAnswerRequest):
    try:
        return evaluate_answer(req.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-frame")
def analyze_camera_frame(req: CameraFrameRequest):
    try:
        if not req.imageBase64:
            raise HTTPException(status_code=400, detail="imageBase64 is required")
        result = analyze_frame(req.imageBase64)
        # If mediapipe is not available, still return 200 with the result dict
        # so the Node controller can log it rather than treating it as a network error.
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/camera-health")
def camera_health():
    """
    Call this from browser or curl to verify MediaPipe is actually loaded.
    GET http://localhost:8000/interview/camera-health
    Expected: { "mediapipe_available": true, "error": null }
    If mediapipe_available is false, run:
      pip install mediapipe opencv-python-headless --break-system-packages
    """
    return get_status()