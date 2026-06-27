
// server/models/Job.js
const mongoose = require('mongoose');

const remoteSchema = new mongoose.Schema(
  {
    mustReside: { type: Boolean, default: false },
    location: { type: String, default: '' }, // e.g., "Pakistan" or "Lahore"
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },

    // Rich text HTML allowed; server validates plain-text length >= 300
    description: { type: String, required: true },

    skillsRequired: { type: [String], required: true },

    rateSkills: {
      type: Map,
      of: { type: String, enum: ['Must Have', 'Nice to Have'] },
      required: true,
    },

    careerLevel: {
      type: String,
      enum: [
        'Intern/Student',
        'Entry Level',
        'Experienced Professional',
        'Department Head',
        'Senior Management',
      ],
      required: true,
    },

    numberOfPositions: { type: Number, required: true, min: 1 },

    // NEW: work arrangement (replaces old strict location requirement)
    workArrangement: {
      type: String,
      enum: ['On-site', 'Hybrid', 'Remote'],
      required: true,
    },

    // NEW: Job location (for On-site/Hybrid); optional for Remote
    jobLocation: { type: String, default: '' },

    // NEW: Remote residence restriction
    remote: { type: remoteSchema, default: () => ({}) },

    // Kept for backward compatibility with any old data
    location: { type: String, default: '' },

    qualification: {
      type: String,
      enum: ['Matric', 'Intermediate', 'Diploma', 'Bachelors', 'Masters', 'MPhil', 'PhD'],
      required: true,
    },

    experience: {
      type: String,
      enum: ['Fresh', 'Less than 1 Year', '1-2 Years', '3-5 Years', '5-10 Years', '10+ Years'],
      required: true,
    },

    salaryMin: { type: Number, required: true, min: 0 },
    salaryMax: { type: Number, required: true, min: 0 },
    salaryVisible: { type: String, enum: ['Yes', 'No'], default: 'Yes' },

    gender: {
      type: String,
      enum: ['Male', 'Female', 'No Preference'],
      default: 'No Preference',
    },

    customQuestions: { type: Boolean, default: false },
    // NEW FIELD: Array to store the actual questions
    screeningQuestions: { type: [String], default: [] },

    // NEW: deadline + auto-close
    applicationDeadline: { type: Date, required: true },
    isClosed: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Helper: mark closed if deadline passed
jobSchema.methods.autoCloseIfExpired = async function () {
  if (!this.isClosed && this.applicationDeadline && new Date() > this.applicationDeadline) {
    this.isClosed = true;
    await this.save();
  }
};

module.exports = mongoose.model('Job', jobSchema);
