// server/routes/profileRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const CandidateProfile = require('../models/CandidateProfile');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

const {
  uploadImageBuffer,
  deleteCloudinaryAsset,
} = require('../utils/fileStorage');

const router = express.Router();

/* ---------- Helper to get userId from token ---------- */
function getUserId(req) {
  return req.user?._id || req.user?.id || req.user?.userId || null;
}

const imageFileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowed.includes(ext)) return cb(null, true);

  return cb(new Error('Only JPG, JPEG, PNG and WEBP image files are allowed'));
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

/* ---------- Helpers ---------- */

function mergeProfilePayload(userId, body) {
  const {
    fullName,
    email,
    phone,
    city,
    bio,
    skills,
    jobTitle,
    targetRole,
    jobType,
    preferredLocations,
    expectedSalary,
    willingToRelocate,
    linkedin,
    github,
    portfolio,
    aiInterviewHistory,
    jobMatchInsights,
  } = body || {};

  return {
    user: userId,
    fullName,
    email,
    phone,
    city,
    bio,
    skills: Array.isArray(skills) ? skills : [],
    jobTitle,
    targetRole,
    jobType,
    preferredLocations,
    expectedSalary,
    willingToRelocate,
    linkedin,
    github,
    portfolio,
    aiInterviewHistory: Array.isArray(aiInterviewHistory)
      ? aiInterviewHistory
      : [],
    jobMatchInsights: Array.isArray(jobMatchInsights)
      ? jobMatchInsights
      : [],
  };
}

/* ---------- GET /api/profile/me ---------- */
// Load or auto-create a profile for logged-in candidate
router.get('/me', protect, authorize('candidate', 'admin'),async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res
      .status(401)
      .json({ message: 'Invalid token payload. No user id found.' });
  }

  try {
    let profile = await CandidateProfile.findOne({ user: userId });

    if (!profile) {
      // seed with basic user info if available
      const user = await User.findById(userId);
      profile = await CandidateProfile.create({
        user: userId,
        fullName: user?.name || '',
        email: user?.email || '',
      });
    }

    res.json(profile);
  } catch (err) {
    console.error('GET /api/profile/me error:', err);
    res.status(500).json({ message: 'Failed to load profile' });
  }
});

/* ---------- PUT /api/profile/me ---------- */
// Create or update candidate profile
router.put('/me', protect,authorize('candidate', 'admin'), async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res
      .status(401)
      .json({ message: 'Invalid token payload. No user id found.' });
  }

  try {
    const payload = mergeProfilePayload(userId, req.body);

    const profile = await CandidateProfile.findOneAndUpdate(
      { user: userId },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(profile);
  } catch (err) {
    console.error('PUT /api/profile/me error:', err);
    res.status(500).json({ message: 'Failed to save profile' });
  }
});

/* ---------- DELETE /api/profile/me ---------- */
// Clear profile data for this user
router.delete('/me',protect,authorize('candidate', 'admin'),  async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res
      .status(401)
      .json({ message: 'Invalid token payload. No user id found.' });
  }

  try {
    await CandidateProfile.findOneAndDelete({ user: userId });
    res.json({ message: 'Profile deleted' });
  } catch (err) {
    console.error('DELETE /api/profile/me error:', err);
    res.status(500).json({ message: 'Failed to delete profile' });
  }
});

/* ---------- POST /api/profile/photo ---------- */
router.post(
  '/photo',
  protect,
  authorize('candidate', 'admin'),
  upload.single('photo'),
  async (req, res) => {
    const userId = getUserId(req);

    if (!userId) {
      return res
        .status(401)
        .json({ message: 'Invalid token payload. No user id found.' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      if (!req.file.buffer) {
        return res.status(400).json({
          message: 'File buffer missing. Upload middleware must use memoryStorage.',
        });
      }

      const existingProfile = await CandidateProfile.findOne({ user: userId });

      const uploaded = await uploadImageBuffer({
        buffer: req.file.buffer,
        folder: `nlpias/profile-photos/${userId}`,
        originalName: req.file.originalname,
        publicIdPrefix: 'candidate-photo',
      });

      // Delete old cloud photo if it exists
      if (existingProfile?.photoCloudinaryPublicId) {
        try {
          await deleteCloudinaryAsset(
            existingProfile.photoCloudinaryPublicId,
            existingProfile.photoResourceType || 'image'
          );
        } catch (cloudErr) {
          console.error('Failed to delete old candidate photo:', cloudErr.message);
        }
      }

      const profile = await CandidateProfile.findOneAndUpdate(
        { user: userId },
        {
          user: userId,
          photoUrl: uploaded.fileUrl,
          photoStorageProvider: uploaded.storageProvider,
          photoCloudinaryPublicId: uploaded.cloudinaryPublicId,
          photoCloudinaryAssetId: uploaded.cloudinaryAssetId,
          photoResourceType: uploaded.resourceType || 'image',
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      res.json({ photoUrl: uploaded.fileUrl, profile });
    } catch (err) {
      console.error('POST /api/profile/photo error:', err);
      res.status(500).json({ message: 'Failed to upload photo' });
    }
  }
);

module.exports = router;
