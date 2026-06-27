// server/services/mockInterviewGroqService.js
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function safeJsonParse(text) {
  try {
    const cleaned = String(text || "")
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "");

    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function normalizeDifficulty(value, fallback = "Medium") {
  const v = String(value || fallback).trim().toLowerCase();
  if (v === "easy") return "Easy";
  if (v === "hard") return "Hard";
  if (v === "adaptive") return "Adaptive";
  return "Medium";
}

function normalizeQuestionItem(item, fallbackDifficulty = "Medium") {
  return {
    question: String(item?.question || "").trim(),
    skillTag: String(item?.skillTag || "General").trim(),
    difficulty: normalizeDifficulty(item?.difficulty, fallbackDifficulty),
  };
}

function normalizeEvaluation(result) {
  const scoreNum = Number(result?.score);
  const score =
    Number.isFinite(scoreNum) ? Math.max(0, Math.min(10, scoreNum)) : 5;

  let nextDifficultyHint = String(result?.nextDifficultyHint || "Medium").trim();
  if (!["Easy", "Medium", "Hard"].includes(nextDifficultyHint)) {
    if (score <= 3) nextDifficultyHint = "Easy";
    else if (score >= 8) nextDifficultyHint = "Hard";
    else nextDifficultyHint = "Medium";
  }

  return {
    score,
    strengths: Array.isArray(result?.strengths)
      ? result.strengths.map((x) => String(x).trim()).filter(Boolean)
      : [],
    weaknesses: Array.isArray(result?.weaknesses)
      ? result.weaknesses.map((x) => String(x).trim()).filter(Boolean)
      : [],
    missingKeywords: Array.isArray(result?.missingKeywords)
      ? result.missingKeywords.map((x) => String(x).trim()).filter(Boolean)
      : [],
    suggestion: String(result?.suggestion || "").trim(),
    idealAnswer: String(result?.idealAnswer || "").trim(),
    nextDifficultyHint,
  };
}

exports.generateMockQuestionsWithGroq = async ({
  role,
  level,
  interviewType,
  skills,
  difficulty,
  questionCount = 8,
}) => {
  const normalizedDifficulty = normalizeDifficulty(difficulty, "Medium");
  const safeSkills = Array.isArray(skills) ? skills : [];

  const system = `
You are an expert mock interviewer and interview coach.

Return ONLY valid JSON.
Do not return markdown fences.
Do not return explanation text.

Generate mock interview questions using:
Role: ${role}
Level: ${level}
Interview Type: ${interviewType}
Skills Focus: ${safeSkills.length ? safeSkills.join(", ") : "None provided"}
Difficulty: ${normalizedDifficulty}
Question Count: ${questionCount}

Return exactly this JSON shape:
[
  {
    "question": "string",
    "skillTag": "string",
    "difficulty": "Easy | Medium | Hard"
  }
]

Rules:
- Return exactly ${questionCount} questions.
- Make every question realistic and job-relevant.
- Avoid duplicate questions.
- If skills are provided, prefer those skills for skillTag.
- If no skills are provided, infer relevant skill tags from the role.
- Junior level should focus more on fundamentals and simple scenarios.
- Mid level should mix fundamentals with applied thinking.
- Senior level should include tradeoffs, architecture, debugging, leadership, and decision-making where relevant.
- For HR / Behavioral, ask behavior and communication-focused questions.
- For Technical, ask skill-focused implementation and concept questions.
- For Mixed, combine technical and behavioral.
- For System Design, include scenario-based design and scaling questions.
- difficulty must only be one of: Easy, Medium, Hard.
`.trim();

  try {
    const resp = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: system },
        { role: "user", content: "Generate the mock interview questions now as a JSON array." },
      ],
      temperature: 0.5,
      max_tokens: 1200,
    });

    const content = resp.choices?.[0]?.message?.content || "";
    const parsed = safeJsonParse(content);

    if (!Array.isArray(parsed)) {
      throw new Error("Groq did not return a valid JSON array");
    }

    const normalized = parsed
      .map((item) => normalizeQuestionItem(item, normalizedDifficulty))
      .filter((item) => item.question);

    if (!normalized.length) {
      throw new Error("No valid mock questions generated");
    }

    while (normalized.length < questionCount) {
      normalized.push({
        question: `Explain a core concept related to ${role}.`,
        skillTag: safeSkills[0] || "General",
        difficulty: normalizedDifficulty === "Adaptive" ? "Medium" : normalizedDifficulty,
      });
    }

    return normalized.slice(0, questionCount);
  } catch (err) {
    console.error("generateMockQuestionsWithGroq error:", err?.message || err);

    const fallbackDifficulty =
      normalizedDifficulty === "Adaptive" ? "Medium" : normalizedDifficulty;

    return Array.from({ length: questionCount }, (_, i) => ({
      question:
        i === 0
          ? `Tell me about your experience related to ${role}.`
          : `Answer a ${interviewType.toLowerCase()} question related to ${role}.`,
      skillTag: safeSkills[i % (safeSkills.length || 1)] || "General",
      difficulty: fallbackDifficulty,
    }));
  }
};

exports.evaluateMockAnswerWithGroq = async ({
  role,
  level,
  interviewType,
  difficulty,
  skillTag,
  question,
  answer,
  adaptiveHint,
}) => {
  const normalizedDifficulty = normalizeDifficulty(difficulty, "Medium");

  const system = `
You are an expert mock interview evaluator for training mode.

Return ONLY valid JSON.
Do not return markdown fences.
Do not return commentary.

Return exactly this JSON shape:
{
  "score": number,
  "strengths": ["string"],
  "weaknesses": ["string"],
  "missingKeywords": ["string"],
  "suggestion": "string",
  "idealAnswer": "string",
  "nextDifficultyHint": "Easy | Medium | Hard"
}

Evaluation Context:
Role: ${role}
Level: ${level}
Interview Type: ${interviewType}
Current Difficulty: ${normalizedDifficulty}
Skill Tag: ${skillTag}

Scoring Rules:
- score must be between 0 and 10.
- strengths should mention what the candidate did well.
- weaknesses should mention what is lacking in the answer.
- missingKeywords should contain important missed concepts, if any.
- suggestion should tell the candidate how to improve the answer.
- idealAnswer should be a concise example of what a strong answer would include.
- nextDifficultyHint must follow:
  - score <= 3 => Easy
  - score 4 to 7 => Medium
  - score >= 8 => Hard
`.trim();

  const user = `
Question:
${question}

Candidate Answer:
${answer}

${adaptiveHint ? `Adaptive hint: ${adaptiveHint}` : ""}
`.trim();

  try {
    const resp = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 900,
    });

    const content = resp.choices?.[0]?.message?.content || "";
    const parsed = safeJsonParse(content);

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Groq did not return valid mock evaluation JSON");
    }

    return normalizeEvaluation(parsed);
  } catch (err) {
    console.error("evaluateMockAnswerWithGroq error:", err?.message || err);

    return {
      score: 5,
      strengths: ["Attempted to answer the question."],
      weaknesses: ["Answer lacked enough depth, clarity, or structure."],
      missingKeywords: [],
      suggestion: "Add a clearer structure, explain your reasoning, and include one practical example.",
      idealAnswer:
        "A strong answer would define the concept, explain how it works, and support it with a relevant real-world example.",
      nextDifficultyHint: "Medium",
    };
  }
};
