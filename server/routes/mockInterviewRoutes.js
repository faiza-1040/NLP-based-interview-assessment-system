// server/routes/mockInterviewRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const ctrl = require("../controllers/mockInterviewController");

router.post("/start", protect, ctrl.startMock);
router.get("/session/:sessionId", protect, ctrl.getSession);
router.post("/answer", protect, ctrl.submitAnswer);
router.post("/finish", protect, ctrl.finishMock);
router.get("/analytics", protect, ctrl.getMockAnalytics);

router.post("/session/:sessionId/camera/snapshot", protect, ctrl.saveMockSnapshot);
router.post("/session/:sessionId/camera/off", protect, ctrl.mockCameraOff);
module.exports = router;
