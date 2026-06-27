// server/workers/interviewWorker.js
require("dotenv").config();

const mongoose = require("mongoose");
const { Worker } = require("bullmq");
const { connection } = require("../queue/redis");

const Interview = require("../models/Interview");
const {
  generateQuestions,
  evaluateAnswer,
} = require("../utils/nlpInterviewClient");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Interview worker DB connected"))
  .catch((err) => {
    console.error("❌ Interview worker DB connection error:", err);
    process.exit(1);
  });

const worker = new Worker(
  "interview-processing",
  async (job) => {
    const { type, interviewId, payload, answerPayload, answerMeta } = job.data;

    if (!interviewId) {
      throw new Error("interviewId is required");
    }

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      throw new Error("Interview not found");
    }

    if (type === "generate_questions") {
      try {
        interview.generationStatus = "pending";
        interview.generationJobId = String(job.id);
        await interview.save();

        const aiResult = await generateQuestions(payload);

        const questions = Array.isArray(aiResult?.questions)
          ? aiResult.questions
          : [];

        if (!questions.length) {
          throw new Error("No questions returned from NLP service");
        }

        // interview.questions = questions.map((q, index) => ({
        //   questionId: Number(q.questionId || index + 1),
        //   question: q.question || "",
        //   skill: q.skill || "General",
        //   type: q.type || "technical",
        //   difficulty: q.difficulty || "medium",
        // }));
        interview.questions = questions.map((q, index) => ({
          questionId: Number(q.questionId || index + 1),
          question: q.question || "",
          skill: q.skill || "General",
          type: q.type || "technical",
          difficulty: q.difficulty || "medium",
          answerFormat: q.answerFormat === "code" ? "code" : "text",
          language: q.language || "general",
          starterCode: q.starterCode || "",
        }));

        interview.status = "in_progress";
        interview.startedAt = interview.startedAt || new Date();
        interview.generationStatus = "completed";
        await interview.save();

        return {
          ok: true,
          interviewId: String(interview._id),
          questionCount: interview.questions.length,
        };
      } catch (err) {
        interview.generationStatus = "failed";
        await interview.save();
        throw err;
      }
    }

    if (type === "evaluate_answer") {
      try {
        const questionId = Number(answerPayload?.questionId);
        // const answerText = String(answerPayload?.answerText || "").trim();
        const rawAnswerText = String(answerPayload?.answerText ?? "");

        const answerText =
          answerMeta?.answerMode === "code"
            ? rawAnswerText
            : rawAnswerText.trim();

        if (!questionId) {
          throw new Error("questionId is required");
        }

        if (!answerText) {
          throw new Error("answerText is required");
        }

        const q = interview.questions.find(
          (item) => Number(item.questionId) === questionId,
        );

        if (!q) {
          throw new Error("Question not found");
        }

        const alreadyAnswered = interview.answers.some(
          (a) => Number(a.questionId) === questionId,
        );

        if (alreadyAnswered) {
          interview.lastAnswerEvaluationStatus = "completed";
          await interview.save();

          return {
            ok: true,
            message: "Question already answered",
          };
        }

        interview.lastAnswerEvaluationStatus = "pending";
        interview.lastAnswerEvaluationJobId = String(job.id);
        interview.lastAnswerEvaluationError = null;
        await interview.save();

        const evalResp = await evaluateAnswer({
          question: q.question,
          skill: q.skill,
          jobTitle: interview.contextSnapshot?.jobTitle,
          jobDescription: interview.contextSnapshot?.jobDescription,
          mustHaveSkills: interview.contextSnapshot?.mustHaveSkills || [],
          candidateSkills: interview.contextSnapshot?.candidateSkills || [],
          answer: answerText,
          meta: answerMeta || {},
        });

        // interview.answers.push({
        //   questionId: q.questionId,
        //   question: q.question,
        //   skill: q.skill,
        //   type: q.type,
        //   difficulty: q.difficulty,
        //   answerText,
        //   timeTakenSec: answerMeta?.timeTakenSec,
        //   tabSwitchCount: answerMeta?.tabSwitchCount || 0,
        //   pasteCount: answerMeta?.pasteCount || 0,
        //   hiddenTimeMs: answerMeta?.hiddenTimeMs || 0,
        //   answerMode: answerMeta?.answerMode || "text",
        //   score: evalResp.score,
        //   feedback: evalResp.feedback,
        //   grading: evalResp.grading || {},
        //   aiAnalysis: evalResp.aiAnalysis || evalResp,
        //   cheatingRisk: evalResp.cheatingRisk || 0,
        // });
        interview.answers.push({
          questionId: q.questionId,
          question: q.question,
          skill: q.skill,
          type: q.type,
          difficulty: q.difficulty,

          answerText,

          codeAnswer: answerMeta?.answerMode === "code" ? answerText : null,
          codeLanguage:
            answerMeta?.answerMode === "code"
              ? answerMeta?.codeLanguage || "javascript"
              : null,

          timeTakenSec: answerMeta?.timeTakenSec,
          tabSwitchCount: answerMeta?.tabSwitchCount || 0,
          pasteCount: answerMeta?.pasteCount || 0,
          hiddenTimeMs: answerMeta?.hiddenTimeMs || 0,
          answerMode: answerMeta?.answerMode || "text",

          score: evalResp.score,
          feedback: evalResp.feedback,
          grading: evalResp.grading || {},
          aiAnalysis: evalResp.aiAnalysis || evalResp,
          cheatingRisk: evalResp.cheatingRisk || 0,
        });

        // interview.lastAnswerEvaluationStatus = "completed";
        // interview.lastAnswerEvaluationError = null;
        interview.lastAnswerEvaluationStatus = "completed";
        interview.lastAnswerEvaluationError = null;
        interview.lastPendingQuestionId = null;

        await interview.save();

        return {
          ok: true,
          interviewId: String(interview._id),
          questionId,
          score: evalResp.score,
        };
      } catch (err) {
        // interview.lastAnswerEvaluationStatus = "failed";
        // interview.lastAnswerEvaluationError =
        //   err?.response?.data?.detail ||
        //   err?.response?.data?.message ||
        //   err.message ||
        //   "Answer evaluation failed";

        // await interview.save();
        // throw err;
        interview.lastAnswerEvaluationStatus = "failed";
        interview.lastAnswerEvaluationError =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err.message ||
          "Answer evaluation failed";

        interview.lastPendingQuestionId = null;

        await interview.save();
        throw err;
      }
    }

    throw new Error(`Unknown interview job type: ${type}`);
  },
  { connection },
);

worker.on("completed", (job) => {
  console.log(`✅ Interview worker completed job ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Interview worker failed job ${job?.id}:`, err.message);
});
