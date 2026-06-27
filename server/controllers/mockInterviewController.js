// server/controllers/mockInterviewController.js
const mongoose = require("mongoose");
const MockSession = require("../models/MockSessionModel");
const {
  generateMockQuestions,
  evaluateMockAnswer,
} = require("../utils/nlpMockInterviewClient");

const { uploadImageBuffer } = require("../utils/fileStorage");

function normalizeMode(value = "text") {
  const v = String(value).trim().toLowerCase();
  if (["text", "voice", "video"].includes(v)) return v;
  return "text";
}

function normalizeDifficulty(value = "medium") {
  const v = String(value).trim().toLowerCase();
  if (["easy", "medium", "hard", "adaptive"].includes(v)) return v;
  return "medium";
}

function mapAdaptiveDifficulty(score) {
  const n = Number(score || 0);
  if (n >= 8) return "hard";
  if (n >= 5) return "medium";
  return "easy";
}

function calcOverallScore10(questions = []) {
  const scores = questions
    .map((q) => q?.evaluation?.score)
    .filter((x) => typeof x === "number");

  if (!scores.length) return null;

  const avg10 = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Number(avg10.toFixed(2));
}

function calcSkillBreakdown(questions = []) {
  const bucket = {};

  for (const q of questions) {
    const skill = q?.skillTag || "General";
    const score = q?.evaluation?.score;
    if (typeof score !== "number") continue;

    if (!bucket[skill]) bucket[skill] = [];
    bucket[skill].push(score);
  }

  const out = {};
  for (const [skill, arr] of Object.entries(bucket)) {
    const avg10 = arr.reduce((a, b) => a + b, 0) / arr.length;
    out[skill] = Math.round((avg10 / 10) * 100);
  }

  return out;
}

function calcDimensionPercent(questions = [], key) {
  const values = questions
    .map((q) => q?.evaluation?.[key])
    .filter((x) => typeof x === "number");

  if (!values.length) return null;

  const avg10 = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round((avg10 / 10) * 100);
}

// POST /api/mock/start
exports.startMock = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.body.userId;
    const {
      role,
      level,
      interviewType,
      skills = [],
      difficulty = "medium",
      mode = "text",
    } = req.body;

    if (!userId || !role || !level || !interviewType) {
      return res.status(400).json({
        message: "role, level, and interviewType are required.",
      });
    }

    const normalizedDifficulty = normalizeDifficulty(difficulty);
    const questionCount = 8;

    const ai = await generateMockQuestions({
      role,
      level,
      interviewType,
      skills: Array.isArray(skills) ? skills : [],
      difficulty: normalizedDifficulty,
      questionCount,
      mode,
    });

    const questions = (ai.questions || []).slice(0, questionCount).map((q, idx) => ({
      index: idx,
      questionId: Number(q.questionId || idx + 1),
      question: String(q.question || "").trim(),
      skillTag: String(q.skill || "General").trim(),
      type: String(q.type || "technical").trim(),
      difficulty:
        normalizedDifficulty === "adaptive"
          ? String(q.difficulty || "medium").trim().toLowerCase()
          : normalizedDifficulty,
      answer: "",
      answerMode: normalizeMode(mode),
    }));

    const session = await MockSession.create({
      userId,
      role: String(role).trim(),
      level: String(level).trim(),
      interviewType: String(interviewType).trim(),
      skills: Array.isArray(skills) ? skills : [],
      difficulty: normalizedDifficulty,
      mode: normalizeMode(mode),
      status: "active",
      currentIndex: 0,
      questions,
    });

    return res.status(201).json({
      sessionId: session._id.toString(),
      session,
    });
  } catch (err) {
    console.error("startMock error:", err);
    return res.status(500).json({ message: "Failed to start mock session." });
  }
};

// GET /api/mock/session/:sessionId
exports.getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ message: "Invalid session id." });
    }

    const session = await MockSession.findById(sessionId).lean();

    if (!session) {
      return res.status(404).json({ message: "Session not found." });
    }

    return res.json(session);
  } catch (err) {
    console.error("getSession error:", err);
    return res.status(500).json({ message: "Failed to fetch session." });
  }
};

// POST /api/mock/answer
exports.submitAnswer = async (req, res) => {
  try {
    const {
      sessionId,
      index,
      answer,
      answerMode,
      timeTakenSec,
      tabSwitchCount,
      pasteCount,
      hiddenTimeMs,
      voiceEditRatio,
      voiceWordsPerSec,
    } = req.body;

    if (!sessionId || typeof index !== "number" || !String(answer || "").trim()) {
      return res.status(400).json({
        message: "sessionId, index(number), and answer are required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ message: "Invalid session id." });
    }

    const session = await MockSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found." });
    if (session.status !== "active") {
      return res.status(400).json({ message: "Session is not active." });
    }

    const q = session.questions.find((x) => x.index === index);
    if (!q) return res.status(404).json({ message: "Question not found." });

    q.answer = String(answer).trim();
    q.answerMode = normalizeMode(answerMode);

    const evalResp = await evaluateMockAnswer({
      role: session.role,
      level: session.level,
      interviewType: session.interviewType,
      difficulty: q.difficulty || session.difficulty,
      skillTag: q.skillTag,
      question: q.question,
      answer: q.answer,
      mode: q.answerMode,
      meta: {
        timeTakenSec,
        tabSwitchCount,
        pasteCount,
        hiddenTimeMs,
        answerMode: q.answerMode,
        voiceEditRatio: voiceEditRatio ?? null,
        voiceWordsPerSec: voiceWordsPerSec ?? null,
      },
    });

    const aiAnalysis = evalResp.aiAnalysis || {};

    q.evaluation = {
      score: Math.max(0, Math.min(10, Number(evalResp.score ?? 0))),
      feedback: String(evalResp.feedback || ""),
      strengths: Array.isArray(evalResp.strengths) ? evalResp.strengths : [],
      weaknesses: Array.isArray(evalResp.weaknesses) ? evalResp.weaknesses : [],
      missingKeywords: Array.isArray(evalResp.missingKeywords)
        ? evalResp.missingKeywords
        : [],
      suggestion: String(evalResp.suggestion || ""),
      idealAnswer: String(evalResp.idealAnswer || ""),
      technicalScore:
        typeof aiAnalysis.technical_score === "number" ? aiAnalysis.technical_score : null,
      communicationScore:
        typeof aiAnalysis.communication_score === "number"
          ? aiAnalysis.communication_score
          : null,
      sentiment: String(aiAnalysis.sentiment || ""),
      intent: String(aiAnalysis.intent || ""),
      cheatingRisk: Number(evalResp.cheatingRisk || 0),
      aiAnalysis,
    };

    const nextDifficultyHint =
      session.difficulty === "adaptive"
        ? mapAdaptiveDifficulty(q.evaluation.score)
        : (evalResp.nextDifficultyHint || q.difficulty || "medium");

    if (session.difficulty === "adaptive") {
      const next = session.questions.find((x) => x.index === index + 1);
      if (next) next.difficulty = nextDifficultyHint;
    }

    if (index < session.questions.length - 1) {
      session.currentIndex = index + 1;
    }

    await session.save();

    return res.json({
      ok: true,
      evaluation: q.evaluation,
      nextDifficultyHint,
      session,
    });
  } catch (err) {
    console.error("submitAnswer error:", err);
    return res.status(500).json({ message: "Failed to evaluate answer." });
  }
};

// POST /api/mock/finish
exports.finishMock = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ message: "Invalid session id." });
    }

    const session = await MockSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found." });

    session.status = "completed";
    session.overallScore = calcOverallScore10(session.questions);
    session.skillBreakdown = calcSkillBreakdown(session.questions);
    session.communicationScore = calcDimensionPercent(session.questions, "communicationScore");
    session.technicalScore = calcDimensionPercent(session.questions, "technicalScore");

    await session.save();

    return res.json({ ok: true, session });
  } catch (err) {
    console.error("finishMock error:", err);
    return res.status(500).json({ message: "Failed to finish session." });
  }
};

// GET /api/mock/analytics
exports.getMockAnalytics = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.query.userId;

    if (!userId) {
      return res.status(400).json({ message: "userId is required." });
    }

    const sessions = await MockSession.find({
      userId,
      status: "completed",
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const roleBucket = {};
    for (const s of sessions) {
      if (typeof s.overallScore !== "number") continue;
      const key = `${s.role}__${s.level}`;
      if (!roleBucket[key]) roleBucket[key] = [];
      roleBucket[key].push(s.overallScore);
    }

    const roleAverages = Object.entries(roleBucket).map(([k, arr]) => {
      const [role, level] = k.split("__");
      const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
      return { role, level, avgScore: avg };
    });

    return res.json({ sessions, roleAverages });
  } catch (err) {
    console.error("getMockAnalytics error:", err);
    return res.status(500).json({ message: "Failed to load analytics." });
  }
};


exports.saveMockSnapshot = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;
    const { imageBase64, flagged, violationReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ message: "Invalid session id." });
    }

    if (!imageBase64) {
      return res.status(400).json({ message: "imageBase64 is required." });
    }

    const session = await MockSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found." });
    }

    if (String(session.userId) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden." });
    }

    if (!session.cameraMonitoring) {
      session.cameraMonitoring = {};
    }

    if (!Array.isArray(session.cameraMonitoring.snapshots)) {
      session.cameraMonitoring.snapshots = [];
    }

    const base64Data = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    const buffer = Buffer.from(base64Data, "base64");

    if (!buffer.length) {
      return res.status(400).json({ message: "Invalid snapshot image data." });
    }

    const uniqueName = `mock-snapshot-${sessionId}-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}.jpg`;

    const uploaded = await uploadImageBuffer({
      buffer,
      folder: `nlpias/mock-snapshots/${sessionId}`,
      originalName: uniqueName,
      publicIdPrefix: "mock-snapshot",
    });

    session.cameraMonitoring.snapshots.push({
      capturedAt: new Date(),

      // Old local field
      filePath: null,

      // New Cloudinary fields
      storageProvider: uploaded.storageProvider,
      fileUrl: uploaded.fileUrl,
      cloudinaryPublicId: uploaded.cloudinaryPublicId,
      cloudinaryAssetId: uploaded.cloudinaryAssetId,
      resourceType: uploaded.resourceType || "image",

      flagged: !!flagged,
      violationReason: violationReason || "",
    });

    session.cameraMonitoring.totalSnapshots =
      (session.cameraMonitoring.totalSnapshots || 0) + 1;

    await session.save();

    return res.json({
      saved: true,
      storageProvider: uploaded.storageProvider,
      fileUrl: uploaded.fileUrl,
    });
  } catch (err) {
    console.error("saveMockSnapshot error:", err);
    return res.status(500).json({ message: "Failed to save mock snapshot." });
  }
};

exports.mockCameraOff = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ message: "Invalid session id." });
    }

    const session = await MockSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found." });

    if (String(session.userId) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden." });
    }

    if (!session.cameraMonitoring) session.cameraMonitoring = {};
    if (!Array.isArray(session.cameraMonitoring.events)) {
      session.cameraMonitoring.events = [];
    }

    session.cameraMonitoring.cameraOffCount =
      (session.cameraMonitoring.cameraOffCount || 0) + 1;

    session.cameraMonitoring.events.push({
      recordedAt: new Date(),
      type: "camera_off",
      reason: "User camera stopped or permission removed.",
    });

    await session.save();

    return res.json({ recorded: true });
  } catch (err) {
    console.error("mockCameraOff error:", err);
    return res.status(500).json({ message: "Failed to record camera event." });
  }
};
