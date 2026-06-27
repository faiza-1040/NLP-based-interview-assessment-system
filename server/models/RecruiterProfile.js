// server/models/RecruiterProfile.js
const mongoose = require("mongoose");

const recruiterProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },

    // Legacy/personal recruiter details - kept for compatibility and contact preferences
    recruiterName: { type: String, default: "" },
    recruiterTitle: { type: String, default: "" },
    recruiterEmail: { type: String, default: "" },
    recruiterPhone: { type: String, default: "" },
    recruiterBio: { type: String, default: "" },
    // recruiterPhotoUrl: { type: String, default: '' },

    recruiterPhotoUrl: { type: String, default: "" },

    recruiterPhotoStorageProvider: { type: String, default: "" },
    recruiterPhotoCloudinaryPublicId: { type: String, default: "" },
    recruiterPhotoCloudinaryAssetId: { type: String, default: "" },
    recruiterPhotoResourceType: { type: String, default: "image" },

    // 1) Public Company Profile
    companyName: { type: String, default: "" },
    // companyLogoUrl: { type: String, default: "" },

    companyLogoUrl: { type: String, default: "" },

    companyLogoStorageProvider: { type: String, default: "" },
    companyLogoCloudinaryPublicId: { type: String, default: "" },
    companyLogoCloudinaryAssetId: { type: String, default: "" },
    companyLogoResourceType: { type: String, default: "image" },

    companyWebsite: { type: String, default: "" },
    companyIndustry: { type: String, default: "" },
    companySize: { type: String, default: "" },
    companyType: { type: String, default: "" },
    companyHeadOffice: { type: String, default: "" },
    aboutCompany: { type: String, default: "" },

    // 2) Why Work With Us
    tagline: { type: String, default: "" },
    whyWorkWithUs: { type: String, default: "" },
    workCulture: { type: String, default: "" },
    coreValues: { type: String, default: "" },
    perksBenefits: { type: String, default: "" },
    growthOpportunities: { type: String, default: "" },
    remoteWorkPolicy: { type: String, default: "" },
    learningOpportunities: { type: String, default: "" },
    diversityStatement: { type: String, default: "" },

    // 3) Hiring Process
    hiringProcessSteps: { type: String, default: "" },
    screeningProcess: { type: String, default: "" },
    interviewStages: { type: String, default: "" },
    expectedResponseTime: { type: String, default: "" },
    candidateInstructions: { type: String, default: "" },

    // 4) Company Verification Badge
    registrationNumber: { type: String, default: "" },
    // registrationDocUrl: { type: String, default: "" },

    registrationDocUrl: { type: String, default: "" },

    registrationDocStorageProvider: { type: String, default: "" },
    registrationDocCloudinaryPublicId: { type: String, default: "" },
    registrationDocCloudinaryAssetId: { type: String, default: "" },
    registrationDocResourceType: { type: String, default: "raw" },
    registrationDocOriginalName: { type: String, default: "" },
    registrationDocMimeType: { type: String, default: "" },
    registrationDocSize: { type: Number, default: 0 },

    businessEmailDomain: { type: String, default: "" },
    companyLinkedin: { type: String, default: "" },
    verificationBadgeVisible: { type: String, default: "Yes" },
    verificationNote: { type: String, default: "" },

    // Approval Status (for admin UI)
    approvalStatus: {
      type: String,
      default: "Pending",
    },
    reviewedBy: { type: String, default: "" },
    lastReviewedOn: { type: Date },
    rejectionReason: { type: String, default: "" },

    // 5) Recruiter Contact Preferences
    showRecruiterEmail: { type: String, default: "No" },
    showRecruiterPhone: { type: String, default: "No" },
    allowCandidateMessages: { type: String, default: "Yes" },
    preferredContactMethod: { type: String, default: "" },
    averageResponseTime: { type: String, default: "" },
    contactInstructions: { type: String, default: "" },

    // 6) Team / Hiring Focus
    hiringDepartments: { type: String, default: "" },
    typicalRoles: { type: String, default: "" },
    hiringLocations: { type: String, default: "" },
    seniorityLevels: { type: String, default: "" },
    teamOverview: { type: String, default: "" },
    hiringFrequency: { type: String, default: "" },

    // 7) Job Post Defaults
    defaultJobDescription: { type: String, default: "" },
    defaultBenefits: { type: String, default: "" },
    defaultHiringProcess: { type: String, default: "" },
    defaultWorkArrangement: { type: String, default: "" },
    defaultApplicationInstructions: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("RecruiterProfile", recruiterProfileSchema);
