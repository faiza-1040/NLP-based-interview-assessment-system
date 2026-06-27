// server/controllers/jobController.js
const Job = require('../models/Job');
const RecruiterProfile = require('../models/RecruiterProfile');

const {
  bm25RankJobs,
  bm25RebuildIndex,
} = require('../utils/nlpMatchClient');

const { preprocessQuery } = require('../utils/queryPreprocess');
const { JSDOM } = require('jsdom');

function htmlToText(html = '') {
  try {
    const dom = new JSDOM(`<body>${html}</body>`);
    return dom.window.document.body.textContent || '';
  } catch {
    return String(html).replace(/<[^>]*>/g, ' ');
  }
}

function escapeRegex(s = '') {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasSearchIntent(processedQuery) {
  const q = String(processedQuery || '').trim().toLowerCase();

  if (!q) return false;

  const aliasShort = new Set(['js', 'wp', 'ui', 'ux', 'db', 'ts', 'py']);

  if (aliasShort.has(q)) return true;

  const tokens = q.split(/\s+/).filter(Boolean);

  return tokens.length > 0 && tokens.join('').length >= 3;
}

function getSearchTokens(text = '') {
  return String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function buildJobSearchText(job) {
  return [
    job.title,
    htmlToText(job.description || ''),
    Array.isArray(job.skillsRequired) ? job.skillsRequired.join(' ') : '',
    job.companyName,
    job.createdBy?.companyName,
    job.createdBy?.name,
    job.workArrangement,
    job.jobLocation,
    job.location,
    job.remote?.location,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function buildJobForBm25(job) {
  return {
    id: String(job._id),
    title: job.title || '',
    description: job.description || '',
    skillsRequired: Array.isArray(job.skillsRequired) ? job.skillsRequired : [],
    companyName:
      job.companyName ||
      job.createdBy?.companyName ||
      job.createdBy?.name ||
      '',
    workArrangement: job.workArrangement || '',
    jobLocation: job.jobLocation || job.location || '',
    remoteLocation: job.remote?.location || '',
  };
}

function validateJobPayload(body) {
  const errors = [];

  const plain = htmlToText(body.description || '');

  if (plain.trim().length < 300) {
    errors.push('Description must be at least 300 characters.');
  }

  if (!['On-site', 'Hybrid', 'Remote'].includes(body.workArrangement)) {
    errors.push('Invalid work arrangement.');
  } else {
    if (['On-site', 'Hybrid'].includes(body.workArrangement)) {
      if (!body.jobLocation || !String(body.jobLocation).trim()) {
        errors.push('Job location is required for On-site or Hybrid roles.');
      }
    }

    if (body.workArrangement === 'Remote') {
      const mustReside = Boolean(body?.remote?.mustReside);

      if (mustReside && !body?.remote?.location) {
        errors.push('Remote roles with residence restriction require a location.');
      }
    }
  }

  const deadline = new Date(body.applicationDeadline);

  if (isNaN(deadline.getTime())) {
    errors.push('Application deadline is required.');
  }

  if (deadline < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
    errors.push('Application deadline cannot be in the past.');
  }

  if (body.customQuestions) {
    if (
      !Array.isArray(body.screeningQuestions) ||
      body.screeningQuestions.length === 0
    ) {
      errors.push(
        'Custom screening questions are enabled but no questions were provided.'
      );
    }

    body.screeningQuestions.forEach((q, index) => {
      if (typeof q !== 'string' || q.trim().length < 5) {
        errors.push(
          `Screening Question #${index + 1} must be at least 5 characters long.`
        );
      }
    });
  }

  return errors;
}

function buildPublicCompanyProfile(profile, recruiterUser = {}) {
  const showEmail = profile?.showRecruiterEmail === 'Yes';
  const showPhone = profile?.showRecruiterPhone === 'Yes';
  const badgeVisible = profile?.verificationBadgeVisible !== 'No';
  const profileApproved =
    String(profile?.approvalStatus || '').toLowerCase() === 'approved';
  const userApproved =
    String(recruiterUser?.status || '').toLowerCase() === 'approved';

  const contactParts = [];

  if (profile?.preferredContactMethod) {
    contactParts.push(`Preferred: ${profile.preferredContactMethod}`);
  }

  if (profile?.allowCandidateMessages === 'Yes') {
    contactParts.push('Candidate messages allowed');
  }

  if (profile?.averageResponseTime) {
    contactParts.push(`Response: ${profile.averageResponseTime}`);
  }

  return {
    companyLogoUrl: profile?.companyLogoUrl || '',
    companyName:
      profile?.companyName ||
      recruiterUser?.companyName ||
      recruiterUser?.name ||
      '',
    isVerified: badgeVisible && (profileApproved || userApproved),
    companyIndustry: profile?.companyIndustry || '',
    companyType: profile?.companyType || '',
    companySize: profile?.companySize || '',
    companyHeadOffice: profile?.companyHeadOffice || '',
    companyWebsite: profile?.companyWebsite || '',
    companyLinkedin: profile?.companyLinkedin || '',
    aboutCompany: profile?.aboutCompany || '',
    tagline: profile?.tagline || '',
    whyWorkWithUs: profile?.whyWorkWithUs || '',
    workCulture: profile?.workCulture || '',
    coreValues: profile?.coreValues || '',
    perksBenefits: profile?.perksBenefits || '',
    growthOpportunities: profile?.growthOpportunities || '',
    remoteWorkPolicy: profile?.remoteWorkPolicy || '',
    learningOpportunities: profile?.learningOpportunities || '',
    diversityStatement: profile?.diversityStatement || '',
    hiringProcessSteps: profile?.hiringProcessSteps || '',
    screeningProcess: profile?.screeningProcess || '',
    interviewStages: profile?.interviewStages || '',
    expectedResponseTime: profile?.expectedResponseTime || '',
    candidateInstructions: profile?.candidateInstructions || '',
    hiringDepartments: profile?.hiringDepartments || '',
    typicalRoles: profile?.typicalRoles || '',
    hiringLocations: profile?.hiringLocations || '',
    recruiterContactPreference: contactParts.join(' • '),
    allowCandidateMessages: profile?.allowCandidateMessages || 'No',
    averageResponseTime: profile?.averageResponseTime || '',
    contactInstructions: profile?.contactInstructions || '',
    recruiterEmail: showEmail ? profile?.recruiterEmail || '' : '',
    recruiterPhone: showPhone ? profile?.recruiterPhone || '' : '',
    defaultHiringProcess: profile?.defaultHiringProcess || '',
  };
}

async function rebuildBm25OpenJobsIndex() {
  const now = new Date();

  const openJobs = await Job.find({
    $and: [
      { $or: [{ isClosed: { $exists: false } }, { isClosed: { $ne: true } }] },
      { applicationDeadline: { $gte: now } },
    ],
  })
    .populate({
      path: 'createdBy',
      select: 'role name companyName',
      match: { role: 'recruiter' },
    })
    .lean();

  const recruiterJobs = openJobs.filter((j) => j.createdBy);
  const bm25Jobs = recruiterJobs.map(buildJobForBm25);

  await bm25RebuildIndex(bm25Jobs);
}

function buildJobSearchQuery(filters = {}) {
  const q = {};

  if (filters.onlyOpen) {
    const now = new Date();

    q.$and = [
      { $or: [{ isClosed: { $exists: false } }, { isClosed: { $ne: true } }] },
      { applicationDeadline: { $gte: now } },
    ];
  }

  const wa = String(filters.workArrangement || '').trim();

  if (['Remote', 'Hybrid', 'On-site'].includes(wa)) {
    q.workArrangement = wa;
  }

  if (filters.location) {
    const re = new RegExp(escapeRegex(String(filters.location).trim()), 'i');

    const locationOr = [
      { jobLocation: re },
      { location: re },
      { 'remote.location': re },
    ];

    if (q.$and) {
      q.$and.push({ $or: locationOr });
    } else {
      q.$or = locationOr;
    }
  }

  if (filters.minSalary && Number(filters.minSalary) > 0) {
    q.salaryVisible = 'Yes';
    q.salaryMax = { $gte: Number(filters.minSalary) };
  }

  return q;
}

exports.getPublicJobs = async (req, res) => {
  try {
    const now = new Date();

    const jobs = await Job.find({
      $and: [
        { $or: [{ isClosed: { $exists: false } }, { isClosed: { $ne: true } }] },
        { applicationDeadline: { $gte: now } },
      ],
    })
      .sort({ createdAt: -1 })
      .populate({
        path: 'createdBy',
        select: 'role name companyName',
        match: { role: 'recruiter' },
      });

    const recruiterJobs = jobs.filter((j) => j.createdBy);

    return res.json(recruiterJobs);
  } catch (err) {
    console.error('getPublicJobs error:', err);
    return res.status(500).json({ error: 'Failed to fetch public jobs' });
  }
};

exports.searchJobs = async (req, res) => {
  try {
    const {
      queryText = '',
      filters = {},
      page = 1,
      limit = 10,
    } = req.body || {};

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 10);

    const start = (pageNum - 1) * limitNum;
    const end = pageNum * limitNum;

    const mongoQuery = buildJobSearchQuery(filters);

    let jobs = await Job.find(mongoQuery)
      .sort({ createdAt: -1 })
      .populate({
        path: 'createdBy',
        select: 'role name companyName',
        match: { role: 'recruiter' },
      })
      .lean();

    jobs = jobs.filter((j) => j.createdBy);

    if (jobs.length === 0) {
      return res.json({
        total: 0,
        page: pageNum,
        limit: limitNum,
        jobs: [],
      });
    }

    const qTextRaw = String(queryText || '').trim();

    let qTextProcessed = '';

    if (qTextRaw) {
      try {
        qTextProcessed = await preprocessQuery(qTextRaw, {
          enableExpansion: true,
        });
      } catch (e) {
        console.warn('preprocessQuery failed, fallback raw:', e.message);
        qTextProcessed = qTextRaw.toLowerCase().trim();
      }
    }

    console.log('RAW QUERY:', qTextRaw);
    console.log('PROCESSED QUERY:', qTextProcessed);

    const searchActive = hasSearchIntent(qTextProcessed);

    if (searchActive) {
      const bm25InputJobs = jobs.map(buildJobForBm25);

      let bm25 = { ranked: [] };

      try {
        console.log('Calling BM25 API with current filtered jobs');

        bm25 = await bm25RankJobs(qTextProcessed, bm25InputJobs);
      } catch (e) {
        console.error('BM25 API failed:', e.message);
      }

      console.log('BM25 RESPONSE:', JSON.stringify(bm25, null, 2));

      const rankedList = Array.isArray(bm25?.ranked)
        ? bm25.ranked
        : Array.isArray(bm25)
          ? bm25
          : [];

      const rankedMatches = rankedList.filter((r) => {
        return (
          r &&
          r.id != null &&
          Number.isFinite(Number(r.score)) &&
          Number(r.score) > 0
        );
      });

      const scoreMap = new Map(
        rankedMatches.map((r) => [String(r.id), Number(r.score)])
      );

      let matchedJobs = jobs
        .filter((job) => scoreMap.has(String(job._id)))
        .map((job) => ({
          ...job,
          bm25Score: scoreMap.get(String(job._id)) || 0,
        }));

      /*
        Extra strict check:
        For "data engineer", result must contain both "data" and "engineer".
        So "Data Analyst" and "Software Engineer" will not appear.
      */
      const rawTokens = getSearchTokens(qTextRaw);

      if (rawTokens.length > 0) {
        matchedJobs = matchedJobs.filter((job) => {
          const jobText = buildJobSearchText(job);

          return rawTokens.every((token) => jobText.includes(token));
        });
      }

      /*
        Fallback:
        If BM25 gives no positive result, use normal keyword matching.
        Important: do NOT return all jobs during search.
      */
      if (matchedJobs.length === 0 && rawTokens.length > 0) {
        matchedJobs = jobs.filter((job) => {
          const jobText = buildJobSearchText(job);

          return rawTokens.every((token) => jobText.includes(token));
        });
      }

      matchedJobs.sort((a, b) => {
        const scoreA = Number(a.bm25Score || 0);
        const scoreB = Number(b.bm25Score || 0);

        if (scoreB !== scoreA) return scoreB - scoreA;

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return res.json({
        total: matchedJobs.length,
        page: pageNum,
        limit: limitNum,
        jobs: matchedJobs.slice(start, end),
      });
    }

    const sortMode = filters.sort || 'latest';

    jobs.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();

      return sortMode === 'oldest' ? da - db : db - da;
    });

    return res.json({
      total: jobs.length,
      page: pageNum,
      limit: limitNum,
      jobs: jobs.slice(start, end),
    });
  } catch (err) {
    console.error('searchJobs error:', err);

    return res.status(500).json({
      error: 'Failed to search jobs',
    });
  }
};

exports.postJob = async (req, res) => {
  try {
    const recruiterId = req.user?.id || req.user?._id;

    if (!recruiterId) {
      return res.status(401).json({
        error: 'Unauthorized: Recruiter ID missing.',
      });
    }

    const errors = validateJobPayload(req.body);

    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const doc = new Job({
      ...req.body,
      createdBy: recruiterId,
      location: req.body.jobLocation || '',
    });

    await doc.save();

    try {
      await rebuildBm25OpenJobsIndex();
    } catch (e) {
      console.warn('BM25 index rebuild failed (postJob):', e.message);
    }

    return res.status(201).json({
      message: 'Job posted successfully',
      job: doc,
    });
  } catch (err) {
    console.error('postJob error:', err.message, err.stack);

    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map((e) => e.message);

      return res.status(400).json({
        error: 'Validation Failed',
        errors: validationErrors,
      });
    }

    if (err.name === 'CastError' && err.path === 'rateSkills') {
      return res.status(400).json({
        error:
          "Cast to Map failed for path 'rateSkills'. Keys cannot contain '.', '$', or be otherwise malformed. Please check your skill entries.",
      });
    }

    if (err.name === 'CastError' && err.path === 'createdBy') {
      return res.status(400).json({
        error: 'Invalid User ID format (CastError).',
      });
    }

    return res.status(500).json({
      error: 'Failed to post job due to server issue.',
    });
  }
};

exports.getMyJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'companyName');

    await Promise.all(jobs.map((j) => j.autoCloseIfExpired()));

    return res.json(jobs);
  } catch (err) {
    console.error('getMyJobs error:', err);

    return res.status(500).json({
      error: 'Failed to fetch jobs',
    });
  }
};

exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
    }).populate('createdBy', 'companyName');

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
      });
    }

    await job.autoCloseIfExpired();

    return res.json(job);
  } catch (err) {
    console.error('getJobById error:', err);

    return res.status(500).json({
      error: 'Failed to fetch job',
    });
  }
};

exports.updateJob = async (req, res) => {
  try {
    const errors = validateJobPayload(req.body);

    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const job = await Job.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
      });
    }

    Object.assign(job, req.body, {
      location: req.body.jobLocation || '',
    });

    await job.save();
    await job.autoCloseIfExpired();

    try {
      await rebuildBm25OpenJobsIndex();
    } catch (e) {
      console.warn('BM25 index rebuild failed (updateJob):', e.message);
    }

    return res.json({
      message: 'Job updated',
      job,
    });
  } catch (err) {
    console.error('updateJob error:', err);

    return res.status(500).json({
      error: 'Failed to update job',
    });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user.id,
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
      });
    }

    try {
      await rebuildBm25OpenJobsIndex();
    } catch (e) {
      console.warn('BM25 index rebuild failed (deleteJob):', e.message);
    }

    return res.json({
      message: 'Job deleted',
    });
  } catch (err) {
    console.error('deleteJob error:', err);

    return res.status(500).json({
      error: 'Failed to delete job',
    });
  }
};

exports.getPublicJobById = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findById(id).populate({
      path: 'createdBy',
      select: 'role name companyName status',
      match: { role: 'recruiter' },
    });

    if (!job || !job.createdBy) {
      return res.status(404).json({
        error: 'Job not found',
      });
    }

    await job.autoCloseIfExpired();

    const recruiterId = job.createdBy?._id || job.createdBy;
    const recruiterProfile = await RecruiterProfile.findOne({
      user: recruiterId,
    }).lean();

    const jobObj = job.toObject();

    jobObj.companyProfile = buildPublicCompanyProfile(
      recruiterProfile,
      job.createdBy
    );

    return res.json(jobObj);
  } catch (err) {
    console.error('getPublicJobById error:', err);

    return res.status(500).json({
      error: 'Failed to fetch job',
    });
  }
};