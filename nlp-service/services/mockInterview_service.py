# nlp-service/services/mockInterview_service.py
from typing import Any, Dict
from services.llm_client import groq_chat_json


def normalize_difficulty(value: str = "medium") -> str:
    v = str(value or "medium").strip().lower()
    if v in {"easy", "medium", "hard", "adaptive"}:
        return v
    return "medium"


def generate_mock_questions(payload: Dict[str, Any]) -> Dict[str, Any]:
    role = payload.get("role", "")
    level = payload.get("level", "")
    interview_type = payload.get("interviewType", "")
    skills = payload.get("skills", []) or []
    difficulty = normalize_difficulty(payload.get("difficulty", "medium"))
    qcount = int(payload.get("questionCount", 8))
    mode = str(payload.get("mode", "text")).strip().lower()

    system = (
        "You are a mock interview question generator.\n"
        "Return ONLY valid JSON.\n\n"
        "Output schema:\n"
        "{\n"
        '  "questions": [\n'
        "    {\n"
        '      "questionId": 1,\n'
        '      "type": "technical|behavioral|situational",\n'
        '      "skill": "string",\n'
        '      "difficulty": "easy|medium|hard",\n'
        '      "question": "string"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- Generate professional, realistic mock interview questions.\n"
        "- Questions must match the selected role, level, and interview type.\n"
        "- Use the provided skills where relevant.\n"
        "- Avoid duplicates.\n"
        "- Do not include answers.\n"
        "- If interviewType is Technical, focus mostly on technical questions.\n"
        "- If interviewType is HR / Behavioral, focus mostly on behavioral questions.\n"
        "- If interviewType is Mixed, include both technical and behavioral questions.\n"
        "- If interviewType is System Design, focus on architecture, scalability, tradeoffs, and design reasoning.\n"
    )

    user_obj = {
        "role": role,
        "level": level,
        "interviewType": interview_type,
        "skills": skills,
        "difficulty": difficulty,
        "questionCount": qcount,
        "mode": mode,
    }

    messages = [
        {"role": "system", "content": system},
        {
            "role": "user",
            "content": f"Generate {qcount} mock interview questions for:\n{user_obj}",
        },
    ]

    out = groq_chat_json(messages, temperature=0.3, max_tokens=1800)
    questions = out.get("questions", [])
    if not isinstance(questions, list):
        questions = []

    normalized = []
    for i, q in enumerate(questions[:qcount], start=1):
        if not isinstance(q, dict):
            continue
        normalized.append(
            {
                "questionId": int(q.get("questionId", i)),
                "type": str(q.get("type", "technical")).strip().lower(),
                "skill": str(q.get("skill", "General")).strip(),
                "difficulty": normalize_difficulty(q.get("difficulty", difficulty)),
                "question": str(q.get("question", "")).strip(),
            }
        )

    while len(normalized) < qcount:
        normalized.append(
            {
                "questionId": len(normalized) + 1,
                "type": "technical" if interview_type.lower() == "technical" else "behavioral",
                "skill": skills[0] if skills else "General",
                "difficulty": "medium" if difficulty == "adaptive" else difficulty,
                "question": f"Explain an important concept related to {role}.",
            }
        )

    return {"questions": normalized}


def _compute_voice_integrity_penalty(meta: Dict[str, Any]) -> int:
    penalty = 0
    answer_mode = str(meta.get("answerMode", "text")).lower()

    if answer_mode != "voice":
        return 0

    voice_edit_ratio = meta.get("voiceEditRatio")
    voice_words_per_sec = meta.get("voiceWordsPerSec")
    paste_count = meta.get("pasteCount", 0) or 0

    try:
        if float(voice_edit_ratio or 0) > 3.0:
            penalty += 20
    except (TypeError, ValueError):
        pass

    try:
        if float(voice_words_per_sec or 0) > 5.0:
            penalty += 25
    except (TypeError, ValueError):
        pass

    try:
        if int(paste_count) > 0:
            penalty += 30
    except (TypeError, ValueError):
        pass

    return min(penalty, 75)


def evaluate_mock_answer(payload: Dict[str, Any]) -> Dict[str, Any]:
    role = payload.get("role", "")
    level = payload.get("level", "")
    interview_type = payload.get("interviewType", "")
    difficulty = normalize_difficulty(payload.get("difficulty", "medium"))
    skill_tag = payload.get("skillTag", "") or "General"
    question = payload.get("question", "")
    answer = payload.get("answer", "")
    mode = str(payload.get("mode", "text")).strip().lower()
    meta = payload.get("meta", {}) or {}

    system = (
        "You are a mock interview evaluator and coach.\n"
        "Return ONLY valid JSON.\n\n"
        "Output schema:\n"
        "{\n"
        '  "score": number,\n'
        '  "feedback": string,\n'
        '  "strengths": [string],\n'
        '  "weaknesses": [string],\n'
        '  "missingKeywords": [string],\n'
        '  "suggestion": string,\n'
        '  "idealAnswer": string,\n'
        '  "nextDifficultyHint": "easy|medium|hard",\n'
        '  "aiAnalysis": {\n'
        '     "technical_score": number,\n'
        '     "communication_score": number,\n'
        '     "sentiment": "positive"|"neutral"|"negative",\n'
        '     "intent": "explain"|"example"|"unclear"|"off_topic"|"refusal",\n'
        '     "strengths": [string],\n'
        '     "weaknesses": [string],\n'
        '     "keywords": [string]\n'
        "  },\n"
        '  "cheatingRisk": integer\n'
        "}\n\n"
        "Rules:\n"
        "- score is 0..10.\n"
        "- Give coaching-style feedback suitable for practice.\n"
        "- strengths should explain what the candidate did well.\n"
        "- weaknesses should explain what needs improvement.\n"
        "- missingKeywords should highlight important concepts not mentioned.\n"
        "- suggestion should be concise and practical.\n"
        "- idealAnswer should describe what a stronger answer would include.\n"
        "- nextDifficultyHint should depend on answer quality.\n"
        "- technical_score and communication_score are 0..10.\n"
        "- cheatingRisk is 0..100.\n"
    )

    user_obj = {
        "role": role,
        "level": level,
        "interviewType": interview_type,
        "difficulty": difficulty,
        "skillTag": skill_tag,
        "question": question,
        "answer": answer,
        "mode": mode,
        "meta": {
            "timeTakenSec": meta.get("timeTakenSec"),
            "tabSwitchCount": meta.get("tabSwitchCount"),
            "pasteCount": meta.get("pasteCount"),
            "hiddenTimeMs": meta.get("hiddenTimeMs"),
        },
    }

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"Evaluate this mock interview answer:\n{user_obj}"},
    ]

    out = groq_chat_json(messages, temperature=0.2, max_tokens=1800)

    score = out.get("score", 0)
    feedback = out.get("feedback", "")
    strengths = out.get("strengths", [])
    weaknesses = out.get("weaknesses", [])
    missing_keywords = out.get("missingKeywords", [])
    suggestion = out.get("suggestion", "")
    ideal_answer = out.get("idealAnswer", "")
    next_difficulty_hint = out.get("nextDifficultyHint", "medium")
    ai_analysis = out.get("aiAnalysis", {})
    cheating = out.get("cheatingRisk", 0)

    try:
        score = float(score)
    except Exception:
        score = 0.0

    try:
        cheating = int(cheating)
    except Exception:
        cheating = 0

    if not isinstance(strengths, list):
        strengths = []
    if not isinstance(weaknesses, list):
        weaknesses = []
    if not isinstance(missing_keywords, list):
        missing_keywords = []
    if not isinstance(ai_analysis, dict):
        ai_analysis = {}

    score = max(0.0, min(10.0, score))
    cheating = max(0, min(100, cheating))
    next_difficulty_hint = normalize_difficulty(next_difficulty_hint)
    if next_difficulty_hint == "adaptive":
        next_difficulty_hint = "medium"

    voice_penalty = _compute_voice_integrity_penalty(meta)
    if voice_penalty > 0:
        cheating = min(100, cheating + voice_penalty)
        ai_analysis["voice_integrity_penalty"] = voice_penalty
        ai_analysis["answer_mode"] = str(meta.get("answerMode", "text"))

    return {
        "score": round(score, 2),
        "feedback": str(feedback)[:1200],
        "strengths": [str(x)[:300] for x in strengths[:6]],
        "weaknesses": [str(x)[:300] for x in weaknesses[:6]],
        "missingKeywords": [str(x)[:120] for x in missing_keywords[:10]],
        "suggestion": str(suggestion)[:1200],
        "idealAnswer": str(ideal_answer)[:1600],
        "nextDifficultyHint": next_difficulty_hint,
        "aiAnalysis": ai_analysis,
        "cheatingRisk": cheating,
    }
