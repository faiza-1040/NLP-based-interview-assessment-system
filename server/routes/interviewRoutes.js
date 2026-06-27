// server/routes/interviewRoutes.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const ctrl = require("../controllers/interviewController");

// ── Recruiter interview report routes ──────────────────────────────────────
router.get("/job/:jobId/interview-details", protect, authorize("recruiter", "admin"), ctrl.getJobInterviewDetails);

// ── Candidate real interview performance dashboard ─────────────────────────
// Keep this route above "/:appId/..." routes so Express does not treat
// "candidate" as an application id.
router.get("/candidate/performance-dashboard", protect, authorize("candidate", "admin"), ctrl.getCandidatePerformanceDashboard);

// ── Existing interview routes ──────────────────────────────────────────────
router.get("/:appId/status", protect, authorize("candidate", "admin"), ctrl.getStatus);
router.get("/:appId/result", protect, authorize("candidate", "admin"), ctrl.getResult);
router.post("/:appId/start", protect, authorize("candidate", "admin"), ctrl.startInterview);
router.post(
  "/:interviewId/heartbeat",
  protect,
  authorize("candidate", "admin"),
  ctrl.heartbeatInterview
);
router.post("/:interviewId/answer", protect, authorize("candidate", "admin"), ctrl.submitAnswer);
router.get("/:interviewId/answer-status/:questionId", protect, authorize("candidate", "admin"), ctrl.getAnswerStatus);
router.post("/:interviewId/complete", protect, authorize("candidate", "admin"), ctrl.completeInterview);

// ── Camera monitoring routes ───────────────────────────────────────────────
router.post("/:interviewId/camera/frame", protect, authorize("candidate", "admin"), ctrl.analyzeFrame);
router.post("/:interviewId/camera/snapshot", protect, authorize("candidate", "admin"), ctrl.saveSnapshot);
router.post("/:interviewId/camera/off", protect, authorize("candidate", "admin"), ctrl.cameraOff);
router.get("/:interviewId/camera/report", protect, authorize("recruiter", "admin"), ctrl.getCameraReport);
router.get("/snapshot/:filePath", protect, authorize("recruiter", "admin"), ctrl.serveSnapshot);

module.exports = router;
