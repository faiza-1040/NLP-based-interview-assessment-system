

// //// //server/routes/applicationRoutes.js

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/applicationController');

router.post('/', protect, authorize('candidate', 'admin'), ctrl.create);
router.get('/mine', protect, authorize('candidate', 'admin'), ctrl.mine);
router.put('/:appId/confirm', protect, authorize('candidate', 'admin'), ctrl.confirm);
router.put('/:appId/reschedule-request', protect, authorize('candidate', 'admin'), ctrl.rescheduleRequest);
router.get('/job/:jobId/mine', protect, authorize('candidate', 'admin'), ctrl.mineForJob);

router.get('/job/:jobId', protect, authorize('recruiter', 'admin'), ctrl.listForJob);
router.get('/recruiter/all', protect, authorize('recruiter', 'admin'), ctrl.listForRecruiterAll);
router.put('/:appId/invite', protect, authorize('recruiter', 'admin'), ctrl.invite);
router.put('/:appId/reschedule-approve', protect, authorize('recruiter', 'admin'), ctrl.rescheduleApprove);
router.put('/:appId/reschedule-decline', protect, authorize('recruiter', 'admin'), ctrl.rescheduleDecline);

//For decision
router.put(
  '/:appId/decision',
  protect,
  authorize('recruiter', 'admin'),
  ctrl.updateDecision
);

router.get('/:appId/matching-status', protect, ctrl.getMatchingStatus);
router.get('/:appId/resume', protect, ctrl.getApplicationResume);
router.get('/:appId', protect, ctrl.getOne);



module.exports = router;