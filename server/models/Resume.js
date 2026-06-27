// server/models/Resume.js
const mongoose = require("mongoose");

const educationSchema = new mongoose.Schema({
  level: String,
  field: String,
  institution: String,
  fromYear: String,
  toYear: String,
  currentlyEnrolled: Boolean,
  grade: String,
});

const experienceSchema = new mongoose.Schema({
  jobTitle: String,
  company: String,
  description: String,
  fromMonth: String,
  fromYear: String,
  toMonth: String,
  toYear: String,
  currentlyWorking: Boolean,
});

const certificationSchema = new mongoose.Schema({
  name: String,
  issuedBy: String,
  date: String,
});

const projectSchema = new mongoose.Schema({
  name: String,
  description: String,
  link: String,
  technologies: [String],
});

const languageSchema = new mongoose.Schema({
  language: String,
  level: String,
});

const skillItemSchema = new mongoose.Schema(
  {
    name: String,
    level: String,
  },
  { _id: false },
);

const customSectionSchema = new mongoose.Schema(
  {
    title: String,
    content: String,
  },
  { _id: false },
);

const resumeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },

    personalDetails: {
      fullName: String,
      jobTitle: String,
      email: String,
      phone: String,
      address: String,
      photoUrl: String,
    },

    summary: String,

    education: [educationSchema],
    experience: [experienceSchema],
    certifications: [certificationSchema],
    projects: [projectSchema],
    languages: [languageSchema],

    skills: [String],
    skillItems: { type: [skillItemSchema], default: [] },

    customSections: { type: [customSectionSchema], default: [] },

    templateId: { type: String, default: "modern" },
    themeColor: { type: String, default: "#2563eb" },
    fontFamily: { type: String, default: "Inter" },
    spacing: { type: String, default: "normal" },

    sectionOrder: {
      type: [String],
      default: [
        "summary",
        "experience",
        "education",
        "skills",
        "projects",
        "certifications",
        "languages",
        "customSections",
      ],
    },

    viewModel: { type: mongoose.Schema.Types.Mixed, default: null },

    builderPdf: {
      storageProvider: { type: String, default: "local" },
      filePath: { type: String, default: null },
      fileUrl: { type: String, default: null },
      originalName: { type: String, default: null },
      cloudinaryPublicId: { type: String, default: null },
      cloudinaryAssetId: { type: String, default: null },
      resourceType: { type: String, default: "raw" },
      mimeType: { type: String, default: "application/pdf" },
      size: { type: Number, default: 0 },
      templateId: { type: String, default: "modern" },
      themeColor: { type: String, default: "#2563eb" },
      fontFamily: { type: String, default: "Inter" },
      spacing: { type: String, default: "normal" },
      generatedAt: { type: Date, default: null },
    },

    uploadedFiles: [
      {
        originalName: String,
        filePath: String,
        fileUrl: String,
        mimeType: String,
        size: Number,
        storageProvider: { type: String, default: "local" },
        cloudinaryPublicId: String,
        cloudinaryAssetId: String,
        resourceType: { type: String, default: "raw" },
        isDeleted: { type: Boolean, default: false },
        deletedAt: { type: Date, default: null },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Resume", resumeSchema);
