// server/models/CandidateProfile.js
const mongoose = require("mongoose");

const aiInterviewSchema = new mongoose.Schema(
  {
    date: Date,
    jobRole: String,
    score: String,
    feedback: String,
  },
  { _id: false },
);

const jobMatchInsightSchema = new mongoose.Schema(
  {
    jobTitle: String,
    matchPercent: String,
    location: String,
    skillsToImprove: String,
  },
  { _id: false },
);

const candidateProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },

    // Profile Overview
    fullName: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    city: { type: String, default: "" },
    bio: { type: String, default: "" },
    skills: { type: [String], default: [] },
    // photoUrl: { type: String, default: '' }, // e.g. /uploads/profile-photos/xyz.jpg

    photoUrl: { type: String, default: "" },

    photoStorageProvider: { type: String, default: "" },
    photoCloudinaryPublicId: { type: String, default: "" },
    photoCloudinaryAssetId: { type: String, default: "" },
    photoResourceType: { type: String, default: "image" },

    // Preferences
    jobTitle: { type: String, default: "" }, // NEW
    targetRole: { type: String, default: "" }, // NEW
    jobType: { type: String, default: "" }, // Full-time / Remote / Internship etc.
    preferredLocations: { type: String, default: "" },
    expectedSalary: { type: String, default: "" },
    willingToRelocate: { type: String, default: "" }, // Yes / No / Maybe

    // Social Links
    linkedin: { type: String, default: "" },
    github: { type: String, default: "" },
    portfolio: { type: String, default: "" },

    // AI Interview History
    aiInterviewHistory: { type: [aiInterviewSchema], default: [] },

    // Job Match Insights
    jobMatchInsights: { type: [jobMatchInsightSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CandidateProfile", candidateProfileSchema);
