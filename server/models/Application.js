// // server/models/Application.js

const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema(
  {
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },

    resumeSource: {
      type: String,
      enum: ["default", "upload"],
      default: "default",
    },
    resumeFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
    resumeName: { type: String, default: null },
    resumePath: { type: String, default: null },
    submittedResume: {
      sourceType: {
        type: String,
        enum: ["builder", "upload"],
        default: null,
      },

      originalName: { type: String, default: null },

      storageProvider: { type: String, default: "local" },
      filePath: { type: String, default: null },
      fileUrl: { type: String, default: null },

      cloudinaryPublicId: { type: String, default: null },
      cloudinaryAssetId: { type: String, default: null },
      resourceType: { type: String, default: "raw" },

      mimeType: { type: String, default: "application/pdf" },
      size: { type: Number, default: 0 },

      templateId: { type: String, default: null },
      themeColor: { type: String, default: null },
      fontFamily: { type: String, default: null },
      spacing: { type: String, default: null },

      sourceResumeId: { type: String, default: null },
      sourceUploadedFileId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },

      submittedAt: { type: Date, default: null },
    },

    matchScore: { type: Number, default: null },
    semanticScore: { type: Number, default: null },
    ruleScore: { type: Number, default: null },
    similarity: { type: Number, default: null },
    matchBreakdown: { type: Object, default: null },

    matchingStatus: {
      type: String,
      enum: ["not_started", "pending", "completed", "failed"],
      default: "not_started",
    },
    matchingStartedAt: { type: Date, default: null },
    matchingCompletedAt: { type: Date, default: null },
    matchingError: { type: String, default: null },
    matchingJobId: { type: String, default: null },

    screeningAnswers: { type: [String], default: [] },

    inviteDates: [{ type: Date, default: undefined }],
    invitedAt: { type: Date, default: null },

    chosenDate: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },

    interviewStatus: {
      type: String,
      enum: ["none", "in_progress", "completed"],
      default: "none",
    },
    interviewCompletedAt: { type: Date, default: null },

    reschedule: {
      status: {
        type: String,
        enum: ["none", "requested", "approved", "declined"],
        default: "none",
      },
      requestedDate: { type: Date, default: null },
      requestedAt: { type: Date, default: null },
      recruiterReplyAt: { type: Date, default: null },
      recruiterNote: { type: String, default: null },
    },

    status: {
      type: String,
      enum: [
        "Applied",
        "Reviewed",
        "Shortlisted",
        "Rejected",
        "Hired",
        "Invited, not yet confirmed",
        "InterviewConfirmed",
      ],
      default: "Applied",
    },
  },
  { timestamps: true },
);

ApplicationSchema.index({ candidate: 1, job: 1 }, { unique: true });

module.exports = mongoose.model("Application", ApplicationSchema);
