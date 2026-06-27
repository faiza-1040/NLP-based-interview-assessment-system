// // server/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Interview = require('../models/Interview');
const CandidateProfile = require('../models/CandidateProfile');
const RecruiterProfile = require('../models/RecruiterProfile');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect, authorize('admin'));

// GET /api/admin/users
router.get("/users", async (req, res) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .select("name email role status emailVerified onboardingStep createdAt")
      .lean();

    res.json(users);
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ message: "Failed to load users" });
  }
});
// GET /api/admin/jobs
router.get("/jobs", async (req, res) => {
  try {
    const jobs = await Job.find()
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email companyName status")
      .select(
        "title workArrangement jobLocation location salaryMin salaryMax salaryVisible applicationDeadline isClosed createdAt createdBy"
      )
      .lean();

    res.json(jobs);
  } catch (error) {
    console.error("Admin jobs error:", error);
    res.status(500).json({ message: "Failed to load jobs" });
  }
});
// GET /api/admin/reports-summary
router.get("/reports-summary", async (req, res) => {
  try {
    const now = new Date();

    const [
      users,
      candidates,
      recruiters,
      admins,
      jobs,
      openJobs,
      closedJobs,
      applications,
      interviews,
      completedInterviews,
      pendingRecruiters,
      approvedRecruiters,
      declinedRecruiters,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "candidate" }),
      User.countDocuments({ role: "recruiter" }),
      User.countDocuments({ role: "admin" }),

      Job.countDocuments(),
      Job.countDocuments({
        $and: [
          {
            $or: [
              { isClosed: { $exists: false } },
              { isClosed: { $ne: true } },
            ],
          },
          { applicationDeadline: { $gte: now } },
        ],
      }),
      Job.countDocuments({
        $or: [{ isClosed: true }, { applicationDeadline: { $lt: now } }],
      }),

      Application.countDocuments(),
      Interview.countDocuments(),
      Interview.countDocuments({ status: "completed" }),

      User.countDocuments({ role: "recruiter", status: "pending" }),
      User.countDocuments({ role: "recruiter", status: "approved" }),
      User.countDocuments({
        role: "recruiter",
        status: { $in: ["declined", "rejected"] },
      }),
    ]);

    res.json({
      users,
      candidates,
      recruiters,
      admins,
      jobs,
      openJobs,
      closedJobs,
      applications,
      interviews,
      completedInterviews,
      pendingRecruiters,
      approvedRecruiters,
      declinedRecruiters,
    });
  } catch (error) {
    console.error("Admin reports error:", error);
    res.status(500).json({ message: "Failed to load reports summary" });
  }
});

// GET /api/admin/dashboard-stats
router.get('/dashboard-stats', async (req, res) => {
  try {
    const now = new Date();

    const [
      totalUsers,
      totalCandidates,
      totalRecruiters,
      totalAdmins,
      pendingRecruiters,
      approvedRecruiters,
      declinedRecruiters,
      totalJobs,
      openJobs,
      closedJobs,
      totalApplications,
      totalInterviews,
      completedInterviews,
      candidateProfiles,
      recruiterProfiles,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'candidate' }),
      User.countDocuments({ role: 'recruiter' }),
      User.countDocuments({ role: 'admin' }),

      User.countDocuments({ role: 'recruiter', status: 'pending' }),
      User.countDocuments({ role: 'recruiter', status: 'approved' }),
      User.countDocuments({
        role: 'recruiter',
        status: { $in: ['declined', 'rejected'] },
      }),

      Job.countDocuments(),
      Job.countDocuments({
        $and: [
          { $or: [{ isClosed: { $exists: false } }, { isClosed: { $ne: true } }] },
          { applicationDeadline: { $gte: now } },
        ],
      }),
      Job.countDocuments({
        $or: [{ isClosed: true }, { applicationDeadline: { $lt: now } }],
      }),

      Application.countDocuments(),
      Interview.countDocuments(),
      Interview.countDocuments({ status: 'completed' }),

      CandidateProfile.countDocuments(),
      RecruiterProfile.countDocuments(),
    ]);

    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          name: '$_id',
          value: '$count',
          _id: 0,
        },
      },
    ]);

    const recruitersByStatus = await User.aggregate([
      { $match: { role: 'recruiter' } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          name: '$_id',
          value: '$count',
          _id: 0,
        },
      },
    ]);

    const applicationsByStatus = await Application.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          name: '$_id',
          value: '$count',
          _id: 0,
        },
      },
    ]);

    const interviewsByStatus = await Interview.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          name: '$_id',
          value: '$count',
          _id: 0,
        },
      },
    ]);

    const jobsByWorkArrangement = await Job.aggregate([
      {
        $group: {
          _id: '$workArrangement',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          name: '$_id',
          value: '$count',
          _id: 0,
        },
      },
    ]);

    const monthlyUsers = await User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          users: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
      {
        $project: {
          month: {
            $concat: [
              { $toString: '$_id.month' },
              '/',
              { $toString: '$_id.year' },
            ],
          },
          users: 1,
          _id: 0,
        },
      },
    ]);

    const monthlyApplications = await Application.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          applications: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
      {
        $project: {
          month: {
            $concat: [
              { $toString: '$_id.month' },
              '/',
              { $toString: '$_id.year' },
            ],
          },
          applications: 1,
          _id: 0,
        },
      },
    ]);

    const avgMatchScoreResult = await Application.aggregate([
      {
        $match: {
          matchScore: { $type: 'number' },
        },
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$matchScore' },
        },
      },
    ]);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .select('name email role status createdAt')
      .lean();

    const recentJobs = await Job.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .select('title workArrangement applicationDeadline isClosed createdAt')
      .populate('createdBy', 'name companyName email')
      .lean();

    const recentApplications = await Application.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .select('candidate job status matchScore createdAt')
      .populate('candidate', 'name email')
      .populate('job', 'title')
      .lean();

    res.json({
      cards: {
        totalUsers,
        totalCandidates,
        totalRecruiters,
        totalAdmins,
        pendingRecruiters,
        approvedRecruiters,
        declinedRecruiters,
        totalJobs,
        openJobs,
        closedJobs,
        totalApplications,
        totalInterviews,
        completedInterviews,
        candidateProfiles,
        recruiterProfiles,
        avgMatchScore: avgMatchScoreResult[0]
          ? Math.round(avgMatchScoreResult[0].avgScore)
          : 0,
      },
      charts: {
        usersByRole,
        recruitersByStatus,
        applicationsByStatus,
        interviewsByStatus,
        jobsByWorkArrangement,
        monthlyUsers,
        monthlyApplications,
      },
      recent: {
        users: recentUsers,
        jobs: recentJobs,
        applications: recentApplications,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Failed to load dashboard stats' });
  }
});

// Get all recruiters
router.get('/recruiters', async (req, res) => {
  try {
    const recruiters = await User.find({ role: 'recruiter' });
    res.status(200).json(recruiters);
  } catch (error) {
    console.error('Error fetching recruiters:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update recruiter status
router.put('/recruiters/:id/status', authController.updateRecruiterStatus);

// Decline recruiter
router.post('/recruiters/:id/decline', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const recruiter = await User.findById(id);

    if (!recruiter) {
      return res.status(404).json({ message: 'Recruiter not found' });
    }

    recruiter.status = 'declined';
    recruiter.declineReason = reason;
    await recruiter.save();

    res.json({ message: 'Recruiter declined with reason', declineReason: reason });
  } catch (err) {
    console.error('Decline error:', err);
    res.status(500).json({ message: 'Server error during decline' });
  }
});

module.exports = router;
