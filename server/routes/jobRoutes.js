// // // server/routes/jobRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  postJob,
  getMyJobs,
  getJobById,
  updateJob,
  deleteJob,
  getPublicJobs,
  searchJobs,
  getPublicJobById,
} = require('../controllers/jobController');

// Recruiter/Admin only
router.post('/post', protect, authorize('recruiter', 'admin'), postJob);
router.get('/mine', protect, authorize('recruiter', 'admin'), getMyJobs);
router.put('/:id', protect, authorize('recruiter', 'admin'), updateJob);
router.delete('/:id', protect, authorize('recruiter', 'admin'), deleteJob);

// Public
router.get('/', getPublicJobs);
router.post('/search', searchJobs);

router.get('/public/:id', protect, authorize('candidate', 'admin', 'recruiter'), getPublicJobById);

// Protected detail
router.get('/:id', protect, authorize('recruiter', 'admin'), getJobById);

module.exports = router;