from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent / ".env")

from services.interview_service import evaluate_answer

payload_base = {
    "jobTitle": "Frontend Developer",
    "jobDescription": "Need strong HTML, CSS, JavaScript and React fundamentals.",
    "mustHaveSkills": ["HTML", "CSS", "JavaScript", "React"],
    "candidateSkills": ["HTML", "CSS", "JavaScript", "React"],
    "skill": "HTML",
    "meta": {
        "timeTakenSec": 20,
        "tabSwitchCount": 0,
        "pasteCount": 0,
        "hiddenTimeMs": 0,
        "answerMode": "text",
    },
}

tests = [
    {
        "label": "WRONG ANSWER",
        "question": "What is the difference between tags and elements in HTML?",
        "answer": "tags are elements",
    },
    {
        "label": "PARTIAL ANSWER",
        "question": "What is the difference between tags and elements in HTML?",
        "answer": "Tags are the markup symbols, while elements are the full structure with content.",
    },
    {
        "label": "GOOD ANSWER",
        "question": "What is the difference between tags and elements in HTML?",
        "answer": "A tag is the markup syntax like <p> or </p>, while an element is the complete HTML unit including opening tag, content, and closing tag.",
    },
    {
        "label": "OFF TOPIC",
        "question": "What is the difference between tags and elements in HTML?",
        "answer": "HTML is used to make websites and CSS is used for styling.",
    },
    {
        "label": "SHORT BUT CORRECT",
        "question": "What is the difference between tags and elements in HTML?",
        "answer": "Tags are markup parts. Elements are the full HTML structure.",
    },
]

for t in tests:
    payload = {
        **payload_base,
        "question": t["question"],
        "answer": t["answer"],
    }

    result = evaluate_answer(payload)

    print("\n" + "=" * 70)
    print(t["label"])
    print("QUESTION:", t["question"])
    print("ANSWER:", t["answer"])
    print("SCORE:", result.get("score"))
    print("FEEDBACK:", result.get("feedback"))
    print("GRADING:", result.get("grading"))
    print("AI ANALYSIS:", result.get("aiAnalysis"))
    print("CHEATING RISK:", result.get("cheatingRisk"))