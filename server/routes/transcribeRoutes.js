
// server/routes/transcribeRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const os = require("os");
const { protect, authorize } = require("../middleware/authMiddleware");
const { transcribe } = require("../controllers/transcribeController");

const audioStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const original = file.originalname || "audio.webm";
    const ext = original.includes(".") ? original.split(".").pop() : "webm";

    cb(
      null,
      `interview_audio_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.${ext}`
    );
  },
});

const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 26 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();

    const allowed =
      mime.startsWith("audio/webm") ||
      mime.startsWith("video/webm") ||
      mime.startsWith("audio/ogg") ||
      mime.startsWith("audio/wav") ||
      mime.startsWith("audio/mp4") ||
      mime.startsWith("audio/mpeg") ||
      mime.startsWith("audio/x-wav");

    if (allowed) {
      return cb(null, true);
    }

    return cb(
      new Error(
        `Unsupported audio format: ${file.mimetype}. Please use webm, ogg, wav, mp4, or mpeg.`
      )
    );
  },
});

router.post(
  "/",
  protect,
  authorize("candidate", "admin"),
  (req, res, next) => {
    audioUpload.single("audio")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          message: err.message || "Audio upload failed.",
        });
      }

      next();
    });
  },
  transcribe
);

module.exports = router;