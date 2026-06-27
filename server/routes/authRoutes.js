// server/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authCtrl = require("../controllers/authController");
const { sendMail } = require("../utils/mailer");
const { protect } = require("../middleware/authMiddleware");
const {
  authLimiter,
  loginLimiter,
  refreshLimiter,
} = require("../middleware/rateLimitMiddleware");

const User = require("../models/User");

/* ---------- Public auth ---------- */
router.post("/signup", authLimiter, authCtrl.signup);
router.post("/login", loginLimiter, authCtrl.login);
router.post("/google", authLimiter, authCtrl.googleAuth);

/* ---------- Email verification ---------- */
/*
  Supports both:
  /api/auth/verify-email?token=xxxxx
  /api/auth/verify-email/xxxxx
*/
router.get("/verify-email", authCtrl.verifyEmail);
router.get("/verify-email/:token", authCtrl.verifyEmail);

router.post("/resend-verification", authLimiter, authCtrl.resendVerification);

/* ---------- Dev/Test: quick test email ----------
   Usage: GET /api/auth/test-email?to=you@example.com */
router.get("/test-email", async (req, res) => {
  try {
    const to = String(req.query.to || "").trim();

    if (!to) {
      return res.status(400).json({
        ok: false,
        message: "Missing ?to=",
      });
    }

    const ok = await sendMail(
      to,
      "MCVPARSER Test Email",
      "<b>It works!</b>",
    );

    return res.json({ ok });
  } catch (e) {
    console.error("test-email error:", e);

    return res.status(500).json({
      ok: false,
      message: "Failed to send test email",
    });
  }
});

router.post("/refresh", refreshLimiter, authCtrl.refresh);
router.post("/logout", authCtrl.logout);
router.get("/me", protect, authCtrl.me);

/* ---------- Onboarding / role selection protected ---------- */
router.put("/recruiter-info", protect, authCtrl.updateRecruiterInfo);
router.put("/user-info", protect, authCtrl.updateUserInfo);
router.put("/select-recruiter-role", protect, authCtrl.selectRecruiterRole);

/* ---------- Admin helpers used by UI ---------- */
router.get("/recruiters", async (req, res) => {
  try {
    const recruiters = await User.find({ role: "recruiter" });
    res.status(200).json(recruiters);
  } catch (error) {
    console.error("Error fetching recruiters:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/recruiters/:id/status", authCtrl.updateRecruiterStatus);

router.post("/recruiters/:id/decline", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const recruiter = await User.findById(id);

    if (!recruiter) {
      return res.status(404).json({ message: "Recruiter not found" });
    }

    recruiter.status = "declined";
    recruiter.declineReason = reason;
    await recruiter.save();

    res.json({
      message: "Recruiter declined with reason",
      declineReason: reason,
    });
  } catch (err) {
    console.error("Decline error:", err);
    res.status(500).json({ message: "Server error during decline" });
  }
});

/* ---------- Password reset ---------- */
router.post("/forgot-password", authLimiter, authCtrl.forgotPassword);
router.post("/forgot-password/resend", authLimiter, authCtrl.resendReset);
router.post("/reset-password", authCtrl.resetPassword);

module.exports = router;