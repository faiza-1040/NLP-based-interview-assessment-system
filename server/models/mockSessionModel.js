// server/models/mockSessionModel.js
const mongoose = require("mongoose");

const mockQuestionSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    questionId: { type: Number, default: 0 },

    question: { type: String, required: true },
    skillTag: { type: String, default: "General" },
    type: { type: String, default: "technical" },
    difficulty: { type: String, default: "medium" },

    answer: { type: String, default: "" },
    answerMode: {
      type: String,
      enum: ["text", "voice", "video"],
      default: "text",
    },

    evaluation: {
      score: { type: Number, default: null }, // 0..10
      feedback: { type: String, default: "" },

      strengths: { type: [String], default: [] },
      weaknesses: { type: [String], default: [] },
      missingKeywords: { type: [String], default: [] },

      suggestion: { type: String, default: "" },
      idealAnswer: { type: String, default: "" },

      technicalScore: { type: Number, default: null },
      communicationScore: { type: Number, default: null },
      sentiment: { type: String, default: "" },
      intent: { type: String, default: "" },

      cheatingRisk: { type: Number, default: 0 },
      aiAnalysis: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
  },
  { _id: false },
);

const mockSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    role: { type: String, required: true },
    level: { type: String, required: true },
    interviewType: { type: String, required: true },
    skills: { type: [String], default: [] },
    difficulty: { type: String, default: "medium" },
    mode: { type: String, enum: ["text", "voice", "video"], default: "text" },

    status: { type: String, enum: ["active", "completed"], default: "active" },
    currentIndex: { type: Number, default: 0 },

    questions: { type: [mockQuestionSchema], default: [] },

    cameraMonitoring: {
      cameraOffCount: { type: Number, default: 0 },
      totalSnapshots: { type: Number, default: 0 },
      // snapshots: {
      //   type: [
      //     {
      //       capturedAt: { type: Date, default: Date.now },
      //       filePath: { type: String, default: "" },
      //       flagged: { type: Boolean, default: false },
      //       violationReason: { type: String, default: "" },
      //     },
      //   ],
      //   default: [],
      // },
      snapshots: {
        type: [
          {
            capturedAt: { type: Date, default: Date.now },

            // Old local fallback field
            filePath: { type: String, default: null },

            // New Cloudinary fields
            storageProvider: { type: String, default: "" },
            fileUrl: { type: String, default: "" },
            cloudinaryPublicId: { type: String, default: "" },
            cloudinaryAssetId: { type: String, default: "" },
            resourceType: { type: String, default: "image" },

            flagged: { type: Boolean, default: false },
            violationReason: { type: String, default: "" },
          },
        ],
        default: [],
      },
      events: {
        type: [
          {
            recordedAt: { type: Date, default: Date.now },
            type: { type: String, default: "" },
            reason: { type: String, default: "" },
          },
        ],
        default: [],
      },
    },
    overallScore: { type: Number, default: null }, // 0..100
    skillBreakdown: { type: Object, default: {} },
    communicationScore: { type: Number, default: null }, // 0..100
    technicalScore: { type: Number, default: null }, // 0..100
  },
  { timestamps: true },
);

module.exports = mongoose.model("MockSession", mockSessionSchema);
