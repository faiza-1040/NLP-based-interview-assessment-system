const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    action: String,
    date: { type: Date, default: Date.now },
    ip: String,
  },
  { _id: false }
);

const adminProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },

    // Personal Info
    fullName: { type: String, default: "" },
    email: { type: String, default: "" }, // read-only
    phone: { type: String, default: "" },
    photoUrl: { type: String, default: "" },

    // Role Info (Read-only)
    role: { type: String, default: "Admin" },
    permissionLevel: { type: String, default: "Super Admin" },

    // Logs
    activityLogs: { type: [activitySchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminProfile", adminProfileSchema);
