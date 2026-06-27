// server/models/Interview.js
const mongoose = require("mongoose");

const AnswerSchema = new mongoose.Schema(
  {
    questionId: Number,
    question: String,
    skill: String,
    type: String,
    difficulty: String,

    answerText: String,
    transcriptText: String,
    audioPath: String,

    timeTakenSec: Number,
    tabSwitchCount: { type: Number, default: 0 },
    pasteCount: { type: Number, default: 0 },
    hiddenTimeMs: { type: Number, default: 0 },

    // answerMode: { type: String, enum: ["text", "voice"], default: "text" },
    codeLanguage: { type: String, default: null },
    codeAnswer: { type: String, default: null },

    answerMode: {
      type: String,
      enum: ["text", "voice", "code"],
      default: "text",
    },

    score: Number,
    feedback: String,
    grading: mongoose.Schema.Types.Mixed,
    aiAnalysis: mongoose.Schema.Types.Mixed,
    cheatingRisk: { type: Number, default: 0 },
  },
  { _id: false },
);

// const QuestionSchema = new mongoose.Schema(
//   {
//     questionId: Number,
//     question: String,
//     skill: String,
//     type: String,
//     difficulty: String,
//   },
//   { _id: false },
// );

const QuestionSchema = new mongoose.Schema(
  {
    questionId: Number,
    question: String,
    skill: String,
    type: String,
    difficulty: String,

    answerFormat: {
      type: String,
      enum: ["text", "code"],
      default: "text",
    },

    language: {
      type: String,
      default: "javascript",
    },

    starterCode: {
      type: String,
      default: "",
    },
  },
  { _id: false },
);

// const SnapshotSchema = new mongoose.Schema(
//   {
//     capturedAt: { type: Date, default: Date.now },
//     filePath: String,
//     flagged: { type: Boolean, default: false },
//     violationReason: String,
//   },
//   { _id: false },
// );

const SnapshotSchema = new mongoose.Schema(
  {
    capturedAt: { type: Date, default: Date.now },

    // Old local field
    filePath: { type: String, default: null },

    // New Cloudinary fields
    storageProvider: { type: String, default: "" },
    fileUrl: { type: String, default: "" },
    cloudinaryPublicId: { type: String, default: "" },
    cloudinaryAssetId: { type: String, default: "" },
    resourceType: { type: String, default: "image" },

    flagged: { type: Boolean, default: false },
    violationReason: { type: String, default: null },
  },
  { _id: false },
);

const CameraEventSchema = new mongoose.Schema(
  {
    recordedAt: { type: Date, default: Date.now },
    faceDetected: Boolean,
    faceCount: Number,
    headDirection: String,
    eyeDirection: String,
    violation: Boolean,
    violationReason: String,
  },
  { _id: false },
);

const InterviewSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      index: true,
    },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    contextSnapshot: {
      jobTitle: String,
      jobDescription: String,
      mustHaveSkills: [String],
      niceToHaveSkills: [String],
      candidateSkills: [String],
      matchedSkills: [String],
      missingSkills: [String],
      weights: {
        jobDescriptionAndRequirements: Number,
        candidateSkills: Number,
      },
    },

    questions: [QuestionSchema],
    answers: [AnswerSchema],

    overallScore: Number,
    finalCheatingRisk: Number,

    status: {
      type: String,
      enum: ["generated", "in_progress", "completed"],
      default: "generated",
    },
    // startedAt: Date,
    // completedAt: Date,

    startedAt: Date,
    completedAt: Date,

    // Total actual interview screen time allowed
    activeTimeLimitMs: {
      type: Number,
      default: 20 * 60 * 1000,
    },

    // Actual screen-active time used
    activeTimeUsedMs: {
      type: Number,
      default: 0,
    },

    // Current active screen session start
    activeSessionStartedAt: {
      type: Date,
      default: null,
    },

    // Last heartbeat received from frontend
    lastHeartbeatAt: {
      type: Date,
      default: null,
    },

    // Candidate can continue only until this time
    continueAllowedUntil: {
      type: Date,
      default: null,
    },

    completionReason: {
      type: String,
      enum: [
        "submitted",
        "active_time_expired",
        "continue_window_expired",
        "abandoned",
        null,
      ],
      default: null,
    },

    timedOutAt: {
      type: Date,
      default: null,
    },

    generationStatus: {
      type: String,
      enum: ["not_started", "pending", "completed", "failed"],
      default: "not_started",
    },
    generationJobId: { type: String, default: null },

    lastAnswerEvaluationStatus: {
      type: String,
      enum: ["idle", "pending", "completed", "failed"],
      default: "idle",
    },
    // lastAnswerEvaluationJobId: { type: String, default: null },
    // lastAnswerEvaluationError: { type: String, default: null },
    lastAnswerEvaluationJobId: { type: String, default: null },
    lastPendingQuestionId: { type: Number, default: null },
    lastAnswerEvaluationError: { type: String, default: null },

    cameraMonitoring: {
      cameraOffCount: { type: Number, default: 0 },
      noFaceCount: { type: Number, default: 0 },
      multipleFacesCount: { type: Number, default: 0 },
      lookingAwayCount: { type: Number, default: 0 },
      movementViolationCount: { type: Number, default: 0 },
      totalFramesAnalyzed: { type: Number, default: 0 },
      warningCount: { type: Number, default: 0 },
      cameraRiskScore: { type: Number, default: 0 },
      snapshots: [SnapshotSchema],
      events: [CameraEventSchema],
    },
  },
  { timestamps: true },
);


InterviewSchema.index(
  { applicationId: 1, candidateId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Interview", InterviewSchema);
