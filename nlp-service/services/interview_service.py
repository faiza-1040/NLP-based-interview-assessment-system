# //nlp-service/services/interview_service.py
from typing import Any, Dict, List
from services.llm_client import groq_chat_json




def generate_questions(payload: Dict[str, Any]) -> Dict[str, Any]:
    job_title = payload.get("jobTitle", "")
    job_description = payload.get("jobDescription", "")
    must_have = payload.get("mustHaveSkills", []) or []
    nice_have = payload.get("niceToHaveSkills", []) or []
    candidate_skills = payload.get("candidateSkills", []) or []
    matched = payload.get("matchedSkills", []) or []
    missing = payload.get("missingSkills", []) or []
    qcount = int(payload.get("questionCount", 8))

    system = (
        "You are an interview question generator for a hiring platform.\n"
        "Return ONLY valid JSON.\n"
        "Output must be:\n"
        "{\n"
        '  "questions": [\n'
        "    {\n"
        '      "questionId": 1,\n'
        '      "type": "technical|behavioral|situational",\n'
        '      "skill": "string",\n'
        '      "difficulty": "easy|medium|hard",\n'
        '      "question": "string",\n'
        '      "answerFormat": "text|code",\n'
        '      "language": "javascript|python|java|cpp|general",\n'
        '      "starterCode": "string"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- Create non-duplicated, job-relevant questions.\n"
        "- 70% questions must focus on job description + must-have skills.\n"
        "- 30% questions should probe missing skills and validate matched skills.\n"
        "- Include only 1 or 2 coding questions maximum.\n"
        "- Coding questions must use answerFormat='code'.\n"
        "- Non-coding questions must use answerFormat='text'.\n"
        "- For coding questions, include suitable starterCode.\n"
        "- Coding starterCode must not include the final solution.\n"
        "- Do not include answers.\n"
    )

    user_obj = {
        "jobTitle": job_title,
        "jobDescription": job_description,
        "mustHaveSkills": must_have,
        "niceToHaveSkills": nice_have,
        "candidateSkills": candidate_skills,
        "matchedSkills": matched,
        "missingSkills": missing,
        "questionCount": qcount,
    }

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"Generate {qcount} questions for:\n{user_obj}"},
    ]

    out = groq_chat_json(messages, temperature=0.3, max_tokens=1800)
    questions = out.get("questions", [])
    if not isinstance(questions, list):
        questions = []

    normalized = []
    code_count = 0

    for i, q in enumerate(questions[:qcount], start=1):
        if not isinstance(q, dict):
            continue

        answer_format = str(q.get("answerFormat", "text")).lower()
        if answer_format not in {"text", "code"}:
            answer_format = "text"

        # Hard safety: max 2 code questions
        if answer_format == "code":
            code_count += 1
            if code_count > 2:
                answer_format = "text"

        language = str(q.get("language", "general")).lower()
        if language not in {"javascript", "python", "java", "cpp", "general"}:
            language = "general"

        if answer_format == "text":
            language = "general"

        normalized.append({
            "questionId": int(q.get("questionId", i)),
            "type": str(q.get("type", "technical")),
            "skill": str(q.get("skill", "General")),
            "difficulty": str(q.get("difficulty", "medium")),
            "question": str(q.get("question", "")).strip(),
            "answerFormat": answer_format,
            "language": language,
            "starterCode": str(q.get("starterCode", "")) if answer_format == "code" else "",
        })

    while len(normalized) < qcount:
        normalized.append({
            "questionId": len(normalized) + 1,
            "type": "technical",
            "skill": "General",
            "difficulty": "medium",
            "question": f"Explain a core concept related to {job_title}.",
            "answerFormat": "text",
            "language": "general",
            "starterCode": "",
        })

    return {"questions": normalized}


def _compute_voice_integrity_penalty(meta: Dict[str, Any]) -> int:
    """
    Adds extra cheating risk for suspicious voice behaviour.
    Only runs when answerMode == "voice". Never touches the score.

    Rules:
      voiceEditRatio > 3.0         → +20
      voiceWordsPerSec > 5.0       → +25
      pasteCount > 0 in voice mode → +30
    Cap: 75 points max from this function.
    """
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

def _fallback_grading_from_output(
    score: float,
    feedback: str,
    ai_analysis: Dict[str, Any],
) -> Dict[str, Any]:
    feedback_l = (feedback or "").lower()
    weaknesses = [str(x).lower() for x in (ai_analysis.get("weaknesses", []) or [])]

    correctness = "partial"
    completeness = "medium"
    misconceptions = []
    missing_points = []
    matched_points = []
    expected_points = ["core concept 1", "core concept 2"]

    incorrect_signals = [
        "incorrect",
        "does not address",
        "does not clearly distinguish",
        "wrong",
        "confusing",
        "confused",
        "misconception",
        "inaccurate",
        "off topic",
        "off-topic",
        "failure to address",
        "lack of understanding",
    ]

    partial_signals = [
        "mostly correct",
        "incomplete",
        "lacks depth",
        "lacks clarity",
        "brief answer",
        "no examples",
        "could be more precise",
    ]

    correct_signals = [
        "clear and accurate",
        "strong understanding",
        "correctly distinguishing",
        "clear explanation",
        "technical accuracy",
    ]

    if any(s in feedback_l for s in incorrect_signals):
        correctness = "incorrect"
        completeness = "low"
        misconceptions.append("Detected from feedback/analysis")
    elif any(s in feedback_l for s in partial_signals):
        correctness = "partial"
        completeness = "medium"
        missing_points.append("Depth/precision/examples missing")
    elif any(s in feedback_l for s in correct_signals):
        correctness = "correct"
        completeness = "high"

    if any("inaccurate" in w or "lack of understanding" in w or "failure to address" in w for w in weaknesses):
        correctness = "incorrect"
        completeness = "low"
        misconceptions.append("Detected from weaknesses")

    if any("lack" in w or "brief" in w or "no examples" in w for w in weaknesses) and correctness != "incorrect":
        if correctness == "correct":
            completeness = "medium"
        missing_points.append("Precision/detail/examples missing")

    if score <= 3:
        correctness = "incorrect"
        completeness = "low"
    elif score <= 6 and correctness != "incorrect":
        correctness = "partial"
        if completeness == "high":
            completeness = "medium"

    return {
        "expected_points": expected_points,
        "matched_points": matched_points,
        "missing_points": missing_points,
        "misconceptions": misconceptions,
        "correctness": correctness,
        "completeness": completeness,
    }


def evaluate_answer(payload: Dict[str, Any]) -> Dict[str, Any]:
    question = payload.get("question", "")
    answer = payload.get("answer", "")
    skill = payload.get("skill", "") or ""
    job_title = payload.get("jobTitle", "") or ""
    job_description = payload.get("jobDescription", "") or ""
    must_have = payload.get("mustHaveSkills", []) or []
    candidate_skills = payload.get("candidateSkills", []) or []
    meta = payload.get("meta", {}) or {}

    answer_mode = str(meta.get("answerMode", "text")).lower()
    code_language = str(meta.get("codeLanguage") or "unknown").lower()

    text_meta = {
        "timeTakenSec": meta.get("timeTakenSec"),
        "tabSwitchCount": meta.get("tabSwitchCount"),
        "pasteCount": meta.get("pasteCount"),
        "hiddenTimeMs": meta.get("hiddenTimeMs"),
    }

    if answer_mode == "code":
        system = (
            "You are an automated coding interview evaluator.\n"
            "Return ONLY valid JSON.\n\n"
            "Important:\n"
            "- You are NOT executing the code.\n"
            "- Evaluate by static reasoning only.\n"
            "- Analyze the submitted code exactly as written.\n"
            "- Do not assume indentation or syntax was intended differently.\n"
            "- For Python answers, carefully check indentation, block structure, and scope.\n"
            "- Check if return statements are inside or outside the correct block.\n"
            "- Check syntax, logic, edge cases, readability, and complexity.\n\n"
            "Output schema:\n"
            "{\n"
            '  "score": number,\n'
            '  "feedback": string,\n'
            '  "grading": {\n'
            '     "expected_points": [string],\n'
            '     "matched_points": [string],\n'
            '     "missing_points": [string],\n'
            '     "misconceptions": [string],\n'
            '     "correctness": "correct|partial|incorrect",\n'
            '     "completeness": "high|medium|low"\n'
            "  },\n"
            '  "aiAnalysis": {\n'
            '     "technical_score": number,\n'
            '     "communication_score": number,\n'
            '     "sentiment": "positive|neutral|negative",\n'
            '     "intent": "explain|example|unclear|off_topic|refusal",\n'
            '     "strengths": [string],\n'
            '     "weaknesses": [string],\n'
            '     "keywords": [string]\n'
            "  },\n"
            '  "cheatingRisk": integer\n'
            "}\n\n"
            "Rules:\n"
            "- You MUST always return a non-empty grading object.\n"
            "- grading.expected_points must contain at least 2 items.\n"
            "- grading.correctness must always be one of: correct, partial, incorrect.\n"
            "- grading.completeness must always be one of: high, medium, low.\n"
            "- grading.misconceptions and grading.missing_points must always be arrays, even if empty.\n"
            "- score is 0..10.\n"
            "- technical_score and communication_score are 0..10.\n"
            "- cheatingRisk is 0..100.\n"
            "- If code has major syntax or indentation errors, score should usually be 0..3.\n"
            "- If code logic is related but incomplete, score should usually be 4..6.\n"
            "- If code is mostly correct with minor gaps, score should usually be 7..8.\n"
            "- Give 9..10 only for correct, clean, robust code.\n"
            "- Do not claim that tests were executed.\n"
            "- pasteCount > 0 increases cheating risk.\n"
            "- tabSwitchCount increases cheating risk.\n"
        )

        user_content = f"""
Evaluate this coding answer.

Job title:
{job_title}

Job description:
{job_description}

Skill target:
{skill}

Question:
{question}

Candidate selected language:
{code_language}

Candidate submitted code:
{answer}

Behavior meta:
{text_meta}

Evaluate the code by static reasoning only.
"""

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ]

    else:
        system = (
            "You are an automated interview evaluator.\n"
            "Return ONLY valid JSON.\n\n"
            "Output schema:\n"
            "{\n"
            '  "score": number,\n'
            '  "feedback": string,\n'
            '  "grading": {\n'
            '     "expected_points": [string],\n'
            '     "matched_points": [string],\n'
            '     "missing_points": [string],\n'
            '     "misconceptions": [string],\n'
            '     "correctness": "correct|partial|incorrect",\n'
            '     "completeness": "high|medium|low"\n'
            "  },\n"
            '  "aiAnalysis": {\n'
            '     "technical_score": number,\n'
            '     "communication_score": number,\n'
            '     "sentiment": "positive|neutral|negative",\n'
            '     "intent": "explain|example|unclear|off_topic|refusal",\n'
            '     "strengths": [string],\n'
            '     "weaknesses": [string],\n'
            '     "keywords": [string]\n'
            "  },\n"
            '  "cheatingRisk": integer\n'
            "}\n\n"
            "Rules:\n"
            "- You MUST always return a non-empty grading object.\n"
            "- grading.expected_points must contain at least 2 items.\n"
            "- grading.correctness must always be one of: correct, partial, incorrect.\n"
            "- grading.completeness must always be one of: high, medium, low.\n"
            "- grading.misconceptions and grading.missing_points must always be arrays, even if empty.\n"
            "- Do not omit grading.\n"
            "- score is 0..10 overall.\n"
            "- technical_score and communication_score are 0..10.\n"
            "- cheatingRisk is 0..100.\n"
            "- First identify the expected core concepts needed for a correct answer.\n"
            "- Then compare the candidate answer against those concepts.\n"
            "- Conceptual correctness matters more than wording.\n"
            "- Do NOT give partial credit just because the answer is related to the topic.\n"
            "- If the answer contains a misconception, incorrect definition, reversed concept, or confused explanation, score should usually stay between 0 and 3.\n"
            "- Only give 4..6 if the answer shows some correct understanding but is incomplete.\n"
            "- Give 7..8 if mostly correct with minor gaps.\n"
            "- Give 9..10 only if fully correct, precise, and clearly explained.\n"
            "- For difference-between questions, if the answer does not clearly distinguish both sides, max score should usually be 3.\n"
            "- Short answers are acceptable only if they are correct.\n"
            "- Short but wrong answers must receive a low score.\n\n"
            "Cheating risk hints:\n"
            "- pasteCount > 0 increases risk a lot.\n"
            "- tabSwitchCount increases risk.\n"
            "- timeTakenSec very low for complex question increases risk.\n"
            "- very generic textbook answer increases risk.\n"
            "- answer far beyond candidateSkills increases risk.\n"
        )

        user_obj = {
            "jobTitle": job_title,
            "jobDescription": job_description,
            "mustHaveSkills": must_have,
            "candidateSkills": candidate_skills,
            "question": question,
            "skillTarget": skill,
            "answer": answer,
            "behaviorMeta": text_meta,
        }

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Evaluate:\n{user_obj}"},
        ]

    out = groq_chat_json(messages, temperature=0.1, max_tokens=1600)

    score = out.get("score", 0)
    feedback = out.get("feedback", "")
    grading = out.get("grading", {})
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

    if not isinstance(grading, dict):
        grading = {}

    if not isinstance(ai_analysis, dict):
        ai_analysis = {}

    score = max(0.0, min(10.0, score))
    cheating = max(0, min(100, cheating))

    if not grading or "correctness" not in grading or "completeness" not in grading:
        grading = _fallback_grading_from_output(score, feedback, ai_analysis)

    correctness = grading.get("correctness")
    completeness = grading.get("completeness")
    misconceptions = grading.get("misconceptions", []) or []
    missing_points = grading.get("missing_points", []) or []

    answer_word_count = len((answer or "").split())

    if correctness == "incorrect":
        score = min(score, 3)
    elif correctness == "partial":
        score = min(score, 6)
    elif correctness == "correct" and completeness == "medium":
        score = min(score, 7)
    elif correctness == "correct" and completeness == "low":
        score = min(score, 6)

    if misconceptions:
        score = min(score, 3)

    if correctness == "correct" and len(missing_points) >= 1:
        score = min(score, 7)

    if correctness == "partial" and len(missing_points) >= 2:
        score = min(score, 6)
    elif correctness == "correct" and len(missing_points) >= 2:
        score = min(score, 7)

    if answer_mode != "code" and correctness == "correct" and completeness == "high" and answer_word_count < 14:
        score = min(score, 8)

    voice_penalty = _compute_voice_integrity_penalty(meta)
    if voice_penalty > 0:
        cheating = min(100, cheating + voice_penalty)
        ai_analysis["voice_integrity_penalty"] = voice_penalty
        ai_analysis["answer_mode"] = str(meta.get("answerMode", "text"))

    print("\n===== INTERVIEW EVAL DEBUG =====")
    print("MODE:", answer_mode)
    print("QUESTION:", question)
    print("ANSWER:", answer)
    print("RAW OUT:", out)
    print("FINAL SCORE:", score)
    print("GRADING:", grading)
    print("CHEATING:", cheating)
    print("================================\n")

    return {
        "score": round(score, 2),
        "feedback": str(feedback)[:1200],
        "grading": grading,
        "aiAnalysis": ai_analysis,
        "cheatingRisk": cheating,
    }