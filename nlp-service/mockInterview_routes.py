# nlp-service/mockInterview_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from services.mockInterview_service import (
    generate_mock_questions,
    evaluate_mock_answer,
)

router = APIRouter(prefix="/mock-interview", tags=["mock-interview"])


class GenerateMockQuestionsRequest(BaseModel):
    role: str
    level: str
    interviewType: str
    skills: List[str] = []
    difficulty: str = "medium"
    questionCount: int = 8
    mode: str = "text"


class EvaluateMockAnswerRequest(BaseModel):
    role: str
    level: str
    interviewType: str
    difficulty: str = "medium"
    skillTag: Optional[str] = None
    question: str
    answer: str
    mode: str = "text"
    meta: Dict[str, Any] = {}


@router.post("/generate-questions")
def generate(req: GenerateMockQuestionsRequest):
    try:
        return generate_mock_questions(req.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evaluate-answer")
def evaluate(req: EvaluateMockAnswerRequest):
    try:
        return evaluate_mock_answer(req.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
