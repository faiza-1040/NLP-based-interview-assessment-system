// server/services/mockGroqService.js
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function safeJsonParse(text) {
  try {
    // remove code fences if any
    const cleaned = String(text || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

exports.generateMockQuestionsWithGroq = async ({
  role,
  level,
  interviewType,
  skills,
  difficulty,
  questionCount = 8,
}) => {
  const system = `
You are an expert interviewer and interview coach.

Return ONLY valid JSON (no markdown fences, no commentary).

You will generate interview questions based on:
Role: ${role}
Level: ${level}
Interview Type: ${interviewType}
Skills Focus: ${Array.isArray(skills) ? skills.join(", ") : ""}
Difficulty: ${difficulty}
Question Count: ${questionCount}

Rules:
- Return an array of exactly ${questionCount} items.
- Each item must contain: question, skillTag, difficulty
- skillTag must be one of the provided skills if skills were provided; otherwise infer a relevant skill tag for the role.
- Keep questions realistic and job-relevant.
- For Junior: simpler fundamentals; Senior: more depth, tradeoffs, architecture.
- For System Design: include scenario-based design questions.
`.trim();

  const resp = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: "Generate the questions now as JSON array.",
      },
    ],
    temperature: 0.5,
    max_tokens: 1200,
  });

  const content = resp.choices?.[0]?.message?.content || "";
  const parsed = safeJsonParse(content);

  if (!Array.isArray(parsed)) {
    // fallback: minimal safe output
    return [
      { question: `Tell me about your experience related to ${role}.`, skillTag: "General", difficulty },
    ];
  }

  return parsed;
};

exports.evaluateMockAnswerWithGroq = async ({
  role,
  level,
  interviewType,
  difficulty,
  skillTag,
  question,
  answer,
  adaptiveHint, // optional: can change next difficulty
}) => {
  const system = `
You are an expert interview evaluator for training (MOCK MODE).

Return ONLY valid JSON with exactly these keys:
{
  "score": number (0-10),
  "strengths": string[],
  "weaknesses": string[],
  "missingKeywords": string[],
  "suggestion": string,
  "idealAnswer": string,
  "nextDifficultyHint": "Easy" | "Medium" | "Hard"
}

Context:
Role: ${role}
Level: ${level}
Interview Type: ${interviewType}
Current Difficulty: ${difficulty}
Skill Tag: ${skillTag}

Adaptive rule:
- If score <= 3 => nextDifficultyHint = "Easy"
- If score 4-7 => nextDifficultyHint = "Medium"
- If score >= 8 => nextDifficultyHint = "Hard"
`.trim();

  const user = `
Question: ${question}

Candidate Answer:
${answer}

${adaptiveHint ? `Adaptive hint: ${adaptiveHint}` : ""}
`.trim();

  const resp = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.4,
    max_tokens: 800,
  });

  const content = resp.choices?.[0]?.message?.content || "";
  const parsed = safeJsonParse(content);

  if (!parsed || typeof parsed !== "object") {
    return {
      score: 5,
      strengths: ["Attempted to answer the question."],
      weaknesses: ["Answer lacked detail or structure."],
      missingKeywords: [],
      suggestion: "Add structure and provide a concrete example.",
      idealAnswer: "A strong answer would explain the concept, then show an example, then discuss tradeoffs.",
      nextDifficultyHint: "Medium",
    };
  }

  return parsed;
};
