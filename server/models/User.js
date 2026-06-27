//server/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const authSessionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true, trim: true },
    password: String,

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    avatarUrl: {
      type: String,
      default: "",
    },

    role: {
      type: String,
      enum: ["candidate", "recruiter", "admin", "pending"],
      default: "pending",
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "declined"],
      default: "pending",
    },

    onboardingStep: {
      type: String,
      enum: [
        "choose-role",
        "candidate-verification",
        "recruiter-onboarding",
        "done",
      ],
      default: "choose-role",
    },

    declineReason: { type: String, default: null },

    emailVerified: { type: Boolean, default: false },
    verificationToken: String,
    verificationTokenExpires: Date,

    resetPasswordToken: String,
    resetPasswordExpires: Date,

    passwordChangedAt: Date,

    authSessions: [authSessionSchema],

    phone: String,
    whatsapp: String,
    maritalStatus: String,
    gender: String,
    age: Number,
    city: String,
    address: String,
    languages: [String],
    skills: [String],
    employmentStatus: String,

    companyName: String,
    recruiterName: String,
    officialEmail: String,
    contactNumber: String,
    website: String,
    description: String,
  },
  { timestamps: true },
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();

  this.password = await bcrypt.hash(this.password, 12);

  if (!this.isNew) {
    this.passwordChangedAt = new Date();
    this.authSessions = [];
  }

  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
