// server/routes/accountRoutes.js
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { changePassword } = require("../controllers/accountController");
const CandidateProfile = require("../models/CandidateProfile");
const User = require("../models/User");
const Application = require("../models/Application");
const Resume = require("../models/Resume");


// Helper: get user id from different token shapes
function getUserId(req) {
  return req.user?._id || req.user?.id || req.user?.userId || null;
}


// PUT /api/account/change-password
router.put("/change-password", protect, changePassword);
// DELETE /api/account/me
// Permanently delete logged-in user's account and related candidate data
router.delete("/me", protect, async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload. No user id found.",
      });
    }

    // 1) Delete candidate profile if exists
    await CandidateProfile.findOneAndDelete({ user: userId });

    // 2) Delete all applications created by this user (if your schema uses `candidate`)
    await Application.deleteMany({ candidate: userId }).catch(() => {});

    // 3) Delete all resumes created by this user
    await Resume.deleteMany({ user: userId }).catch(() => {});

    // 4) Delete the actual user document
    await User.findByIdAndDelete(userId);

    return res.json({
      success: true,
      message: "Account and candidate data deleted permanently.",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete account.",
    });
  }
});

module.exports = router;
