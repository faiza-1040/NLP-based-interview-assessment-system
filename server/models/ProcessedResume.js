// // server/models/ProcessedResume.js
const mongoose = require("mongoose");

const ProcessedResumeSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    resumeDocId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      required: false,
      index: true,
    },

    uploadedFileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      index: true,
    },

    sourceType: {
      type: String,
      enum: ["builder_form", "uploaded_pdf"],
      required: true,
    },

    scoringText: {
      type: String,
      default: "",
    },

    structured: {
      type: Object,
      default: {},
    },

    markdown: {
      type: String,
      default: "",
    },

    fileUrl: { type: String, default: null },
    rawText: { type: String, default: "" },

    processingStatus: {
      type: String,
      enum: ["not_started", "pending", "completed", "failed"],
      default: "not_started",
    },
    processingStartedAt: { type: Date, default: null },
    processingCompletedAt: { type: Date, default: null },
    processingError: { type: String, default: null },
    processingJobId: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

ProcessedResumeSchema.index(
  { userId: 1, sourceType: 1, uploadedFileId: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model("ProcessedResume", ProcessedResumeSchema);