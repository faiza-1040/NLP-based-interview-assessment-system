
//server/routes/resumeRoutes.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");

const {
  submitResume,
  getResume,
  getPDF,
  deleteResume,
  getBuilderProcessingStatus,
  getUploadedProcessingStatus,
} = require("../controllers/resumeController");

const {
  uploadResume,
  deleteResume: deleteUploadedFile,
} = require("../controllers/resumeUploadController");

const { renderResume } = require("../controllers/resumeRenderController");
const upload = require("../middleware/uploadMiddleware");

router.use(protect, authorize("candidate", "admin"));

router.post("/render", renderResume);

router.post("/me", submitResume);
router.get("/me", getResume);
router.get("/me/pdf", getPDF);
router.delete("/me", deleteResume);

router.get("/me/processing-status", getBuilderProcessingStatus);

router.post("/me/upload", upload.single("resume"), uploadResume);
router.delete("/me/upload/:fileId", deleteUploadedFile);
router.get("/me/upload/:fileId/processing-status", getUploadedProcessingStatus);

module.exports = router;