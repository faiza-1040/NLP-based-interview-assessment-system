// server/routes/recruiterProfileRoutes.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const RecruiterProfile = require('../models/RecruiterProfile');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  uploadImageBuffer,
  uploadRawFileBuffer,
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

const docFileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  return cb(new Error('Only PDF/JPG/PNG verification documents are allowed'));
};

// const uploadPhoto = multer({ storage: photoStorage, fileFilter: imageFileFilter });
// const uploadLogo = multer({ storage: logoStorage, fileFilter: imageFileFilter });
// const uploadDoc = multer({ storage: docStorage, fileFilter: docFileFilter });

const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadLogo = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadDoc = multer({
  storage: multer.memoryStorage(),
  fileFilter: docFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* ---------- Helpers ---------- */

function pick(value, fallback = '') {
  return value === undefined || value === null ? fallback : value;
}

function empty(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function buildProfileFromUser(userId, user) {
  return {
    user: userId,
    recruiterName: user?.recruiterName || user?.name || '',
    recruiterEmail: user?.officialEmail || user?.email || '',
    recruiterPhone: user?.contactNumber || '',
    companyName: user?.companyName || '',
    companyWebsite: user?.website || '',
    companyHeadOffice: user?.address || '',
    aboutCompany: user?.description || '',
  };
}

function backfillProfileWithOnboarding(profile, user) {
  if (!profile || !user) return profile;

  let changed = false;

  const mappings = [
    ['recruiterName', user.recruiterName || user.name],
    ['recruiterEmail', user.officialEmail || user.email],
    ['recruiterPhone', user.contactNumber],
    ['companyName', user.companyName],
    ['companyWebsite', user.website],
    ['companyHeadOffice', user.address],
    ['aboutCompany', user.description],
  ];

  mappings.forEach(([field, value]) => {
    if (empty(profile[field]) && !empty(value)) {
      profile[field] = value;
      changed = true;
    }
  });

  return changed;
}

/**
 * Merge frontend payload into the structure expected by the schema.
 * Kept old fields and added practical public-company profile fields.
 */
function mergeRecruiterPayload(userId, body) {
  const b = body || {};

  return {
    user: userId,

    // Legacy/personal recruiter details
    recruiterName: pick(b.recruiterName),
    recruiterTitle: pick(b.recruiterTitle),
    recruiterEmail: pick(b.recruiterEmail),
    recruiterPhone: pick(b.recruiterPhone),
    recruiterBio: pick(b.recruiterBio),
    recruiterPhotoUrl: pick(b.recruiterPhotoUrl),

    // Public Company Profile
    companyName: pick(b.companyName),
    companyLogoUrl: pick(b.companyLogoUrl),
    companyWebsite: pick(b.companyWebsite),
    companyIndustry: pick(b.companyIndustry),
    companySize: pick(b.companySize),
    companyType: pick(b.companyType),
    companyHeadOffice: pick(b.companyHeadOffice),
    aboutCompany: pick(b.aboutCompany),

    // Why Work With Us
    tagline: pick(b.tagline),
    whyWorkWithUs: pick(b.whyWorkWithUs),
    workCulture: pick(b.workCulture),
    coreValues: pick(b.coreValues),
    perksBenefits: pick(b.perksBenefits),
    growthOpportunities: pick(b.growthOpportunities),
    remoteWorkPolicy: pick(b.remoteWorkPolicy),
    learningOpportunities: pick(b.learningOpportunities),
    diversityStatement: pick(b.diversityStatement),

    // Hiring Process
    hiringProcessSteps: pick(b.hiringProcessSteps),
    screeningProcess: pick(b.screeningProcess),
    interviewStages: pick(b.interviewStages),
    expectedResponseTime: pick(b.expectedResponseTime),
    candidateInstructions: pick(b.candidateInstructions),

    // Company Verification Badge
    registrationNumber: pick(b.registrationNumber),
    registrationDocUrl: pick(b.registrationDocUrl),
    businessEmailDomain: pick(b.businessEmailDomain),
    companyLinkedin: pick(b.companyLinkedin),
    verificationBadgeVisible: pick(b.verificationBadgeVisible, 'Yes'),
    verificationNote: pick(b.verificationNote),

    // Admin approval status
    approvalStatus: pick(b.approvalStatus, 'Pending'),
    reviewedBy: pick(b.reviewedBy),
    lastReviewedOn: b.lastReviewedOn || undefined,
    rejectionReason: pick(b.rejectionReason),

    // Recruiter Contact Preferences
    showRecruiterEmail: pick(b.showRecruiterEmail, 'No'),
    showRecruiterPhone: pick(b.showRecruiterPhone, 'No'),
    allowCandidateMessages: pick(b.allowCandidateMessages, 'Yes'),
    preferredContactMethod: pick(b.preferredContactMethod),
    averageResponseTime: pick(b.averageResponseTime),
    contactInstructions: pick(b.contactInstructions),

    // Team / Hiring Focus
    hiringDepartments: pick(b.hiringDepartments),
    typicalRoles: pick(b.typicalRoles),
    hiringLocations: pick(b.hiringLocations),
    seniorityLevels: pick(b.seniorityLevels),
    teamOverview: pick(b.teamOverview),
    hiringFrequency: pick(b.hiringFrequency),

    // Job Post Defaults
    defaultJobDescription: pick(b.defaultJobDescription),
    defaultBenefits: pick(b.defaultBenefits),
    defaultHiringProcess: pick(b.defaultHiringProcess),
    defaultWorkArrangement: pick(b.defaultWorkArrangement),
    defaultApplicationInstructions: pick(b.defaultApplicationInstructions),
  };
}

/* ---------- GET /api/recruiter/profile/me ---------- */
// Load or auto-create a profile for logged-in recruiter
router.get('/me', protect, authorize('recruiter', 'admin'), async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res
      .status(401)
      .json({ message: 'Invalid token payload. No user id found.' });
  }

  try {
    const user = await User.findById(userId);
    let profile = await RecruiterProfile.findOne({ user: userId });

    if (!profile) {
      profile = await RecruiterProfile.create(buildProfileFromUser(userId, user));
    } else {
      const changed = backfillProfileWithOnboarding(profile, user);
      if (changed) await profile.save();
    }

    res.json(profile);
  } catch (err) {
    console.error('GET /api/recruiter/profile/me error:', err);
    res.status(500).json({ message: 'Failed to load recruiter profile' });
  }
});

/* ---------- PUT /api/recruiter/profile/me ---------- */
// Create or update recruiter profile
router.put('/me', protect, authorize('recruiter', 'admin'), async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res
      .status(401)
      .json({ message: 'Invalid token payload. No user id found.' });
  }

  try {
    const payload = mergeRecruiterPayload(userId, req.body);

    const profile = await RecruiterProfile.findOneAndUpdate(
      { user: userId },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(profile);
  } catch (err) {
    console.error('PUT /api/recruiter/profile/me error:', err);
    res.status(500).json({ message: 'Failed to save recruiter profile' });
  }
});

/* ---------- DELETE /api/recruiter/profile/me ---------- */
router.delete('/me', protect, authorize('recruiter', 'admin'), async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res
      .status(401)
      .json({ message: 'Invalid token payload. No user id found.' });
  }

  try {
    await RecruiterProfile.findOneAndDelete({ user: userId });
    res.json({ message: 'Recruiter profile deleted' });
  } catch (err) {
    console.error('DELETE /api/recruiter/profile/me error:', err);
    res.status(500).json({ message: 'Failed to delete recruiter profile' });
  }
});
// ////
// /* ---------- POST /api/recruiter/profile/photo ---------- */
router.post(
  '/photo',
  protect,
  authorize('recruiter', 'admin'),
  uploadPhoto.single('photo'),
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

      const existingProfile = await RecruiterProfile.findOne({ user: userId });

      const uploaded = await uploadImageBuffer({
        buffer: req.file.buffer,
        folder: `nlpias/recruiter-photos/${userId}`,
        originalName: req.file.originalname,
        publicIdPrefix: 'recruiter-photo',
      });

      if (existingProfile?.recruiterPhotoCloudinaryPublicId) {
        try {
          await deleteCloudinaryAsset(
            existingProfile.recruiterPhotoCloudinaryPublicId,
            existingProfile.recruiterPhotoResourceType || 'image'
          );
        } catch (cloudErr) {
          console.error('Failed to delete old recruiter photo:', cloudErr.message);
        }
      }

      const profile = await RecruiterProfile.findOneAndUpdate(
        { user: userId },
        {
          user: userId,
          recruiterPhotoUrl: uploaded.fileUrl,
          recruiterPhotoStorageProvider: uploaded.storageProvider,
          recruiterPhotoCloudinaryPublicId: uploaded.cloudinaryPublicId,
          recruiterPhotoCloudinaryAssetId: uploaded.cloudinaryAssetId,
          recruiterPhotoResourceType: uploaded.resourceType || 'image',
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      res.json({
        recruiterPhotoUrl: uploaded.fileUrl,
        photoUrl: uploaded.fileUrl,
        profile,
      });
    } catch (err) {
      console.error('POST /api/recruiter/profile/photo error:', err);
      res.status(500).json({ message: 'Failed to upload photo' });
    }
  }
);


router.post(
  '/logo',
  protect,
  authorize('recruiter', 'admin'),
  uploadLogo.single('logo'),
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

      const existingProfile = await RecruiterProfile.findOne({ user: userId });

      const uploaded = await uploadImageBuffer({
        buffer: req.file.buffer,
        folder: `nlpias/company-logos/${userId}`,
        originalName: req.file.originalname,
        publicIdPrefix: 'company-logo',
      });

      if (existingProfile?.companyLogoCloudinaryPublicId) {
        try {
          await deleteCloudinaryAsset(
            existingProfile.companyLogoCloudinaryPublicId,
            existingProfile.companyLogoResourceType || 'image'
          );
        } catch (cloudErr) {
          console.error('Failed to delete old company logo:', cloudErr.message);
        }
      }

      const profile = await RecruiterProfile.findOneAndUpdate(
        { user: userId },
        {
          user: userId,
          companyLogoUrl: uploaded.fileUrl,
          companyLogoStorageProvider: uploaded.storageProvider,
          companyLogoCloudinaryPublicId: uploaded.cloudinaryPublicId,
          companyLogoCloudinaryAssetId: uploaded.cloudinaryAssetId,
          companyLogoResourceType: uploaded.resourceType || 'image',
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      res.json({
        companyLogoUrl: uploaded.fileUrl,
        logoUrl: uploaded.fileUrl,
        profile,
      });
    } catch (err) {
      console.error('POST /api/recruiter/profile/logo error:', err);
      res.status(500).json({ message: 'Failed to upload logo' });
    }
  }
);

router.post(
  '/registration-doc',
  protect,
  authorize('recruiter', 'admin'),
  uploadDoc.single('registrationDoc'),
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

      const existingProfile = await RecruiterProfile.findOne({ user: userId });

      const uploaded = await uploadRawFileBuffer({
        buffer: req.file.buffer,
        folder: `nlpias/company-docs/${userId}`,
        originalName: req.file.originalname,
        publicIdPrefix: 'registration-doc',
      });

      if (existingProfile?.registrationDocCloudinaryPublicId) {
        try {
          await deleteCloudinaryAsset(
            existingProfile.registrationDocCloudinaryPublicId,
            existingProfile.registrationDocResourceType || 'raw'
          );
        } catch (cloudErr) {
          console.error('Failed to delete old registration document:', cloudErr.message);
        }
      }

      const profile = await RecruiterProfile.findOneAndUpdate(
        { user: userId },
        {
          user: userId,
          registrationDocUrl: uploaded.fileUrl,
          registrationDocStorageProvider: uploaded.storageProvider,
          registrationDocCloudinaryPublicId: uploaded.cloudinaryPublicId,
          registrationDocCloudinaryAssetId: uploaded.cloudinaryAssetId,
          registrationDocResourceType: uploaded.resourceType || 'raw',
          registrationDocOriginalName: req.file.originalname,
          registrationDocMimeType: req.file.mimetype,
          registrationDocSize: uploaded.size || req.file.size,
          approvalStatus: 'Pending',
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      res.json({
        registrationDocUrl: uploaded.fileUrl,
        docUrl: uploaded.fileUrl,
        profile,
      });
    } catch (err) {
      console.error('POST /api/recruiter/profile/registration-doc error:', err);
      res.status(500).json({ message: 'Failed to upload registration document' });
    }
  }
);

module.exports = router;
