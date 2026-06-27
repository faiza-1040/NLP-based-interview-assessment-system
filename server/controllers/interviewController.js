
// server/controllers/interviewController.js
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { uploadImageBuffer } = require("../utils/fileStorage");

const Application = require("../models/Application");
const ProcessedResume = require("../models/ProcessedResume");
const Interview = require("../models/Interview");
const Job = require("../models/Job");
const { interviewQueue } = require("../queue/interviewQueue");

const NLP_BASE = process.env.NLP_SERVICE_URL || "http://127.0.0.1:8000";

const START_BEFORE_MINUTES = 2;
const START_AFTER_MINUTES = 2;
const ACTIVE_INTERVIEW_MINUTES = 20;
const CONTINUE_ALLOWED_MINUTES = 20;

const ACTIVE_INTERVIEW_MS = ACTIVE_INTERVIEW_MINUTES * 60 * 1000;
const CONTINUE_ALLOWED_MS = CONTINUE_ALLOWED_MINUTES * 60 * 1000;
const HEARTBEAT_MAX_DELTA_MS = 20 * 1000;

const SNAPSHOTS_DIR = path.join(__dirname, "../uploads/snapshots");
if (!fs.existsSync(SNAPSHOTS_DIR)) {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

function cleanHtmlToText(html = "") {
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canStartServer(chosenDate) {
  const scheduledAt = chosenDate ? new Date(chosenDate) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return false;

  const now = Date.now();
  const scheduledMs = scheduledAt.getTime();

  return (
    now >= scheduledMs - START_BEFORE_MINUTES * 60 * 1000 &&
    now <= scheduledMs + START_AFTER_MINUTES * 60 * 1000
  );
}

function isStartWindowExpired(chosenDate) {
  const scheduledAt = chosenDate ? new Date(chosenDate) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return false;

  return Date.now() > scheduledAt.getTime() + START_AFTER_MINUTES * 60 * 1000;
}

function getActiveRemainingMs(interview) {
  const limit = Number(interview.activeTimeLimitMs || ACTIVE_INTERVIEW_MS);
  const used = Number(interview.activeTimeUsedMs || 0);
  return Math.max(0, limit - used);
}

function getTimingPayload(interview) {
  return {
    startedAt: interview.startedAt || null,
    activeTimeLimitMs: interview.activeTimeLimitMs || ACTIVE_INTERVIEW_MS,
    activeTimeUsedMs: interview.activeTimeUsedMs || 0,
    activeTimeRemainingMs: getActiveRemainingMs(interview),
    continueAllowedUntil: interview.continueAllowedUntil || null,
    completionReason: interview.completionReason || null,
  };
}

function defaultCameraMonitoring() {
  return {
    cameraOffCount: 0,
    noFaceCount: 0,
    multipleFacesCount: 0,
    lookingAwayCount: 0,
    movementViolationCount: 0,
    totalFramesAnalyzed: 0,
    warningCount: 0,
    cameraRiskScore: 0,
    snapshots: [],
    events: [],
  };
}

async function markApplicationInterviewInProgress(appId) {
  if (!mongoose.Types.ObjectId.isValid(appId)) return;

  await Application.findByIdAndUpdate(appId, {
    interviewStatus: "in_progress",
  });
}

function computeCameraRisk(cam) {
  if (!cam) return 0;

  let risk = 0;
  risk += Math.min((cam.cameraOffCount || 0) * 15, 30);
  risk += Math.min((cam.noFaceCount || 0) * 3, 25);
  risk += Math.min((cam.multipleFacesCount || 0) * 10, 30);
  risk += Math.min((cam.lookingAwayCount || 0) * 2, 15);
  risk += Math.min((cam.movementViolationCount || 0) * 2, 10);

  return Math.min(Math.round(risk), 100);
}

async function finalizeInterview(interview, reason = "submitted") {
  if (!interview) return null;

  if (interview.status === "completed") {
    return interview;
  }

  const questionsCount = Array.isArray(interview.questions)
    ? interview.questions.length
    : 0;

  const answeredCount = Array.isArray(interview.answers)
    ? interview.answers.length
    : 0;

  const scoreSum = (interview.answers || []).reduce(
    (sum, a) => sum + Number(a.score || 0),
    0,
  );

  // If timeout/abandoned, unanswered questions count as 0.
  // If submitted normally, all questions should already be answered.
  const denominator =
    reason === "submitted"
      ? Math.max(answeredCount, 1)
      : Math.max(questionsCount, answeredCount, 1);

  const overallScore = scoreSum / denominator;

  const answerCheatingRisk = answeredCount
    ? (interview.answers || []).reduce(
        (acc, a) => acc + Number(a.cheatingRisk || 0),
        0,
      ) / answeredCount
    : 0;

  const camRisk = computeCameraRisk(interview.cameraMonitoring);

  if (interview.cameraMonitoring) {
    interview.cameraMonitoring.cameraRiskScore = camRisk;
  }

  const blendedRisk = Math.round(answerCheatingRisk * 0.7 + camRisk * 0.3);
  const completedAt = new Date();

  interview.overallScore = Number(overallScore.toFixed(2));
  interview.finalCheatingRisk = Math.min(blendedRisk, 100);
  interview.status = "completed";
  interview.completedAt = completedAt;
  interview.completionReason = reason;

  if (reason !== "submitted") {
    interview.timedOutAt = completedAt;
  }

  interview.activeSessionStartedAt = null;

  await interview.save();

  await Application.findByIdAndUpdate(interview.applicationId, {
    interviewCompletedAt: completedAt,
    interviewStatus: "completed",
  });

  return interview;
}

function normalizeScoreToPercent(value) {
  if (value === null || value === undefined || value === "") return null;

  const num = Number(value);
  if (!Number.isFinite(num)) return null;

  // Some AI evaluators return scores out of 10, while profile UI needs percentage.
  const percent = num <= 10 ? num * 10 : num;
  return Math.max(0, Math.min(100, Number(percent.toFixed(2))));
}

function averageNumbers(values) {
  const clean = values.filter(
    (v) => typeof v === "number" && Number.isFinite(v),
  );
  if (!clean.length) return 0;
  const avg = clean.reduce((sum, item) => sum + item, 0) / clean.length;
  return Number(avg.toFixed(2));
}

async function generateQuestionsDirect(payload) {
  const { data } = await axios.post(
    `${NLP_BASE}/interview/generate-questions`,
    payload,
    { timeout: 120000 },
  );
  return Array.isArray(data?.questions) ? data.questions : [];
}

function buildContextSnapshot(app, job, candidateSkills) {
  const jobDescription = cleanHtmlToText(job.description || "");
  const jobSkills = job.skillsRequired || [];
  const rateSkills = job.rateSkills || {};
  const mustHaveSkills = [];
  const niceToHaveSkills = [];

  jobSkills.forEach((skill) => {
    const keyVariants = [
      skill,
      skill.replace(/\s+/g, "_"),
      skill.replace(/[^a-zA-Z0-9]/g, "_"),
    ];

    let rating = "Nice to Have";
    for (const k of keyVariants) {
      if (rateSkills[k]) {
        rating = rateSkills[k];
        break;
      }
    }

    (rating === "Must Have" ? mustHaveSkills : niceToHaveSkills).push(skill);
  });

  const jobLower = jobSkills.map((s) => String(s).toLowerCase());
  const candLower = candidateSkills.map((s) => String(s).toLowerCase());

  const matchedSkills = candidateSkills.filter((s) =>
    jobLower.some(
      (js) =>
        js.includes(String(s).toLowerCase()) ||
        String(s).toLowerCase().includes(js),
    ),
  );

  const missingSkills = jobSkills.filter(
    (s) =>
      !candLower.some(
        (cs) =>
          cs.includes(String(s).toLowerCase()) ||
          String(s).toLowerCase().includes(cs),
      ),
  );

  return {
    jobTitle: job.title,
    jobDescription,
    mustHaveSkills,
    niceToHaveSkills,
    candidateSkills,
    matchedSkills,
    missingSkills,
    weights: {
      jobDescriptionAndRequirements: 0.7,
      candidateSkills: 0.3,
    },
  };
}

async function getCandidateSkills(app) {
  let candidateSkills = [];

  if (
    app.matchBreakdown?.candidate_skills &&
    typeof app.matchBreakdown.candidate_skills === "object"
  ) {
    candidateSkills = Object.keys(app.matchBreakdown.candidate_skills);
  }

  if (candidateSkills.length === 0) {
    const processed = await ProcessedResume.findOne({
      userId: String(app.candidate),
    })
      .sort({ createdAt: -1 })
      .lean();

    if (processed?.structured?.skills?.length) {
      candidateSkills = processed.structured.skills;
    }
  }

  return candidateSkills;
}

exports.getStatus = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { appId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ message: "Invalid application id" });
    }

    const interview = await Interview.findOne({
      applicationId: appId,
      candidateId: userId,
    })
      .sort({ createdAt: -1 })
      .select(
        "status answers questions overallScore finalCheatingRisk startedAt completedAt activeTimeLimitMs activeTimeUsedMs continueAllowedUntil completionReason timedOutAt generationStatus generationJobId lastAnswerEvaluationStatus lastAnswerEvaluationError cameraMonitoring",
      );

    if (!interview) {
      return res.json({
        status: "none",
        generationStatus: "not_started",
        interviewId: null,
        questions: [],
        answers: [],
      });
    }

    if (interview.status !== "completed") {
      if (
        interview.continueAllowedUntil &&
        Date.now() > new Date(interview.continueAllowedUntil).getTime()
      ) {
        await finalizeInterview(interview, "continue_window_expired");
      } else if (getActiveRemainingMs(interview) <= 0) {
        await finalizeInterview(interview, "active_time_expired");
      }
    }

    return res.json({
      interviewId: interview._id,
      status: interview.status,
      generationStatus: interview.generationStatus || "idle",
      generationJobId: interview.generationJobId || null,
      lastAnswerEvaluationStatus:
        interview.lastAnswerEvaluationStatus || "idle",
      lastAnswerEvaluationError: interview.lastAnswerEvaluationError || null,
      answeredCount: (interview.answers || []).length,
      totalCount: (interview.questions || []).length,
      questions: interview.questions || [],
      answers: interview.answers || [],
      overallScore: interview.overallScore ?? null,
      finalCheatingRisk: interview.finalCheatingRisk ?? null,
      completedAt: interview.completedAt ?? null,
      cameraMonitoring: interview.cameraMonitoring || null,
      ...getTimingPayload(interview),
    });
  } catch (err) {
    console.error("getStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getResult = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { appId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ message: "Invalid application id" });
    }

    const interview = await Interview.findOne({
      applicationId: appId,
      candidateId: userId,
      status: "completed",
    })
      .select(
        "overallScore finalCheatingRisk completedAt status cameraMonitoring",
      )
      .lean();

    if (!interview) {
      return res.status(404).json({ message: "No completed interview found." });
    }

    return res.json({
      overallScore: interview.overallScore,
      finalCheatingRisk: interview.finalCheatingRisk,
      completedAt: interview.completedAt,
      cameraMonitoring: interview.cameraMonitoring || null,
    });
  } catch (err) {
    console.error("getResult error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getCandidatePerformanceDashboard = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    const interviews = await Interview.find({
      candidateId: userId,
      status: "completed",
    })
      .sort({ completedAt: -1, createdAt: -1 })
      .populate({ path: "jobId", select: "title companyName" })
      .populate({
        path: "applicationId",
        select: "chosenDate confirmedAt interviewCompletedAt status",
      })
      .select(
        "applicationId jobId contextSnapshot answers overallScore finalCheatingRisk completedAt startedAt status cameraMonitoring questions",
      )
      .lean();

    if (!interviews.length) {
      return res.json({
        completedInterviews: 0,
        averageScore: 0,
        averageIntegrityScore: 100,
        strongSkills: [],
        weakAreas: [],
        progressLastFive: [],
        recentInterviews: [],
        recommendations: [
          "Complete your first recruiter-scheduled real interview to generate performance insights.",
        ],
      });
    }

    const normalizedScores = interviews
      .map((interview) => normalizeScoreToPercent(interview.overallScore))
      .filter((score) => score !== null);

    const averageScore = averageNumbers(normalizedScores);

    const integrityScores = interviews.map((interview) => {
      const cam = interview.cameraMonitoring || {};
      const cameraRisk =
        typeof cam.cameraRiskScore === "number"
          ? cam.cameraRiskScore
          : computeCameraRisk(cam);

      const finalRisk =
        typeof interview.finalCheatingRisk === "number"
          ? interview.finalCheatingRisk
          : cameraRisk;

      return Math.max(0, 100 - Number(finalRisk || 0));
    });

    const averageIntegrityScore = averageNumbers(integrityScores);

    const skillStats = {};
    const missingSkillSet = new Set();

    interviews.forEach((interview) => {
      (interview.contextSnapshot?.missingSkills || []).forEach((skill) => {
        if (skill) missingSkillSet.add(String(skill).trim());
      });

      (interview.answers || []).forEach((answer) => {
        const skill = String(answer.skill || "General Communication").trim();
        if (!skill) return;

        const score = normalizeScoreToPercent(answer.score);
        if (score === null) return;

        if (!skillStats[skill]) {
          skillStats[skill] = {
            skill,
            totalScore: 0,
            attempts: 0,
          };
        }

        skillStats[skill].totalScore += score;
        skillStats[skill].attempts += 1;
      });
    });

    const skillAverages = Object.values(skillStats).map((item) => ({
      skill: item.skill,
      averageScore: Number((item.totalScore / item.attempts).toFixed(2)),
      attempts: item.attempts,
    }));

    let strongSkills = skillAverages
      .filter((item) => item.averageScore >= 70)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 6);

    let weakAreas = skillAverages
      .filter((item) => item.averageScore < 70)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 6);

    if (!strongSkills.length && skillAverages.length) {
      strongSkills = [...skillAverages]
        .sort((a, b) => b.averageScore - a.averageScore)
        .slice(0, 3);
    }

    const existingWeakNames = new Set(
      weakAreas.map((item) => String(item.skill).toLowerCase()),
    );

    Array.from(missingSkillSet)
      .slice(0, 4)
      .forEach((skill) => {
        if (!existingWeakNames.has(String(skill).toLowerCase())) {
          weakAreas.push({
            skill,
            averageScore: null,
            attempts: 0,
            reason:
              "Required skill was missing from interview/job matching context.",
          });
        }
      });

    weakAreas = weakAreas.slice(0, 6);

    const progressLastFive = interviews
      .slice(0, 5)
      .reverse()
      .map((interview) => {
        const cam = interview.cameraMonitoring || {};
        const cameraRisk =
          typeof cam.cameraRiskScore === "number"
            ? cam.cameraRiskScore
            : computeCameraRisk(cam);

        const finalRisk =
          typeof interview.finalCheatingRisk === "number"
            ? interview.finalCheatingRisk
            : cameraRisk;

        return {
          interviewId: interview._id,
          jobTitle:
            interview.contextSnapshot?.jobTitle ||
            interview.jobId?.title ||
            "Real Interview",
          completedAt:
            interview.completedAt ||
            interview.applicationId?.interviewCompletedAt ||
            interview.startedAt,
          score: normalizeScoreToPercent(interview.overallScore) || 0,
          integrityScore: Math.max(0, 100 - Number(finalRisk || 0)),
        };
      });

    const recentInterviews = interviews.slice(0, 5).map((interview) => {
      const cam = interview.cameraMonitoring || {};
      const cameraRisk =
        typeof cam.cameraRiskScore === "number"
          ? cam.cameraRiskScore
          : computeCameraRisk(cam);

      const finalRisk =
        typeof interview.finalCheatingRisk === "number"
          ? interview.finalCheatingRisk
          : cameraRisk;

      return {
        interviewId: interview._id,
        applicationId: interview.applicationId?._id || interview.applicationId,
        applicationStatus: interview.applicationId?.status || null,
        jobTitle:
          interview.contextSnapshot?.jobTitle ||
          interview.jobId?.title ||
          "Real Interview",
        completedAt:
          interview.completedAt ||
          interview.applicationId?.interviewCompletedAt ||
          interview.startedAt,
        overallScore: normalizeScoreToPercent(interview.overallScore) || 0,
        integrityScore: Math.max(0, 100 - Number(finalRisk || 0)),
        answeredQuestions: Array.isArray(interview.answers)
          ? interview.answers.length
          : 0,
        totalQuestions: Array.isArray(interview.questions)
          ? interview.questions.length
          : 0,
        status: interview.status,
      };
    });

    const recommendations = [];

    if (weakAreas.length) {
      weakAreas.slice(0, 3).forEach((item) => {
        recommendations.push(
          item.averageScore === null
            ? `Practice ${item.skill} because it appears as a missing required skill in your real interview/job context.`
            : `Improve ${item.skill}; your current average in this area is ${Math.round(
                item.averageScore,
              )}%.`,
        );
      });
    }

    if (averageScore < 70) {
      recommendations.push(
        "Focus on structured answers: explain the concept, give an example, then connect it with the job role.",
      );
    } else {
      recommendations.push(
        "Your real interview performance is improving. Keep practicing weak areas to increase your final score.",
      );
    }

    if (averageIntegrityScore < 80) {
      recommendations.push(
        "Improve interview integrity by keeping your camera stable, face visible, and attention focused on the screen.",
      );
    }

    return res.json({
      completedInterviews: interviews.length,
      averageScore,
      averageIntegrityScore,
      strongSkills,
      weakAreas,
      progressLastFive,
      recentInterviews,
      recommendations,
    });
  } catch (err) {
    console.error("getCandidatePerformanceDashboard error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.startInterview = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { appId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ message: "Invalid application id" });
    }

    const app = await Application.findById(appId)
      .populate({
        path: "job",
        select:
          "title description skillsRequired rateSkills experience qualification careerLevel",
      })
      .lean();

    if (!app) return res.status(404).json({ message: "Application not found" });
    if (String(app.candidate) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (app.interviewStatus === "completed") {
      const completedInterview = await Interview.findOne({
        applicationId: appId,
        candidateId: userId,
        status: "completed",
      })
        .sort({ completedAt: -1, createdAt: -1 })
        .select(
          "status overallScore finalCheatingRisk startedAt completedAt activeTimeLimitMs activeTimeUsedMs continueAllowedUntil completionReason timedOutAt cameraMonitoring",
        );

      return res.json({
        interviewId: completedInterview?._id || null,
        status: "completed",
        generationStatus: "completed",
        questions: [],
        answers: [],
        overallScore: completedInterview?.overallScore ?? null,
        finalCheatingRisk: completedInterview?.finalCheatingRisk ?? null,
        cameraRiskScore:
          completedInterview?.cameraMonitoring?.cameraRiskScore || 0,
        completedAt:
          completedInterview?.completedAt ?? app.interviewCompletedAt,
        ...(completedInterview ? getTimingPayload(completedInterview) : {}),
      });
    }

    if (app.status !== "InterviewConfirmed" || !app.chosenDate) {
      return res.status(400).json({ message: "Interview not confirmed yet." });
    }

    let existing = await Interview.findOne({
      applicationId: appId,
      candidateId: userId,
      status: { $ne: "completed" },
    }).sort({ createdAt: -1 });

    // If no interview exists yet, candidate must be inside start window.
    if (!existing && !canStartServer(app.chosenDate)) {
      const diffMs = new Date().getTime() - new Date(app.chosenDate).getTime();

      if (diffMs > START_AFTER_MINUTES * 60 * 1000) {
        return res.status(403).json({
          message: "Interview start window has expired.",
          expired: true,
        });
      }

      return res.status(403).json({
        message: `Interview can only start ${START_BEFORE_MINUTES} minutes before and ${START_AFTER_MINUTES} minutes after scheduled time.`,
      });
    }

    if (existing) {
      if (
        (!Array.isArray(existing.questions) ||
          existing.questions.length === 0) &&
        ["pending", "not_started", "failed"].includes(
          existing.generationStatus || "pending",
        )
      ) {
        try {
          const job = app.job;
          if (!job) return res.status(404).json({ message: "Job not found" });

          const payload = {
            ...(existing.contextSnapshot || {}),
            jobRequirements: {
              experience: job.experience,
              qualification: job.qualification,
              careerLevel: job.careerLevel,
            },
            questionCount: 8,
          };

          const questions = await generateQuestionsDirect(payload);
          existing.questions = questions;
          existing.status = "in_progress";
          existing.startedAt = existing.startedAt || new Date();
          existing.generationStatus = "completed";
          if (!existing.cameraMonitoring)
            existing.cameraMonitoring = defaultCameraMonitoring();
          await existing.save();
        } catch (directErr) {
          console.error(
            "Direct question generation for existing interview failed:",
            directErr?.message || directErr,
          );
        }
      }

      const now = new Date();

          if (!existing.startedAt) {
        existing.startedAt = now;
      }

      if (
        !existing.activeTimeLimitMs ||
        existing.activeTimeLimitMs < ACTIVE_INTERVIEW_MS
      ) {
        existing.activeTimeLimitMs = ACTIVE_INTERVIEW_MS;
      }

      existing.activeTimeUsedMs = existing.activeTimeUsedMs || 0;

      const desiredContinueUntil = new Date(
        new Date(existing.startedAt).getTime() + CONTINUE_ALLOWED_MS,
      );

      if (
        !existing.continueAllowedUntil ||
        new Date(existing.continueAllowedUntil).getTime() <
          desiredContinueUntil.getTime()
      ) {
        existing.continueAllowedUntil = desiredContinueUntil;
      }

      if (!existing.lastHeartbeatAt) {
        existing.lastHeartbeatAt = now;
      }

      if (!existing.activeSessionStartedAt) {
        existing.activeSessionStartedAt = now;
      }

      await existing.save();

      await markApplicationInterviewInProgress(appId);

      if (
        existing.continueAllowedUntil &&
        Date.now() > new Date(existing.continueAllowedUntil).getTime()
      ) {
        const completed = await finalizeInterview(
          existing,
          "continue_window_expired",
        );

        return res.json({
          interviewId: completed._id,
          questions: [],
          answers: completed.answers || [],
          status: "completed",
          generationStatus: completed.generationStatus,
          overallScore: completed.overallScore ?? null,
          finalCheatingRisk: completed.finalCheatingRisk ?? null,
          cameraRiskScore: completed.cameraMonitoring?.cameraRiskScore || 0,
          ...getTimingPayload(completed),
        });
      }

      if (getActiveRemainingMs(existing) <= 0) {
        const completed = await finalizeInterview(
          existing,
          "active_time_expired",
        );

        return res.json({
          interviewId: completed._id,
          questions: [],
          answers: completed.answers || [],
          status: "completed",
          generationStatus: completed.generationStatus,
          overallScore: completed.overallScore ?? null,
          finalCheatingRisk: completed.finalCheatingRisk ?? null,
          cameraRiskScore: completed.cameraMonitoring?.cameraRiskScore || 0,
          ...getTimingPayload(completed),
        });
      }

      return res.json({
        interviewId: existing._id,
        questions: existing.questions || [],
        answers: existing.answers || [],
        status: existing.status,
        generationStatus: existing.generationStatus,
        ...getTimingPayload(existing),
      });
    }

    const job = app.job;
    if (!job) return res.status(404).json({ message: "Job not found" });

    const candidateSkills = await getCandidateSkills(app);
    const contextSnapshot = buildContextSnapshot(app, job, candidateSkills);

    let interview;

    try {
      interview = await Interview.create({
        applicationId: appId,
        jobId: job._id,
        candidateId: userId,
        contextSnapshot,
        questions: [],
        answers: [],
        status: "generated",
        generationStatus: "pending",
        cameraMonitoring: defaultCameraMonitoring(),
      });
    } catch (createErr) {
      if (createErr?.code === 11000) {
        const existingAfterRace = await Interview.findOne({
          applicationId: appId,
          candidateId: userId,
        }).sort({ createdAt: -1 });

        if (existingAfterRace) {
          return res.json({
            interviewId: existingAfterRace._id,
            questions: existingAfterRace.questions || [],
            answers: existingAfterRace.answers || [],
            status: existingAfterRace.status,
            generationStatus: existingAfterRace.generationStatus,
            ...getTimingPayload(existingAfterRace),
          });
        }
      }

      throw createErr;
    }
    const payload = {
      ...contextSnapshot,
      jobRequirements: {
        experience: job.experience,
        qualification: job.qualification,
        careerLevel: job.careerLevel,
      },
      questionCount: 8,
    };

    try {
      const questions = await generateQuestionsDirect(payload);
      interview.questions = questions;
      // interview.status = "in_progress";
      // interview.startedAt = new Date();
      // interview.generationStatus = "completed";

      const startedAt = new Date();

      interview.status = "in_progress";
      interview.startedAt = interview.startedAt || startedAt;
      interview.activeTimeLimitMs = ACTIVE_INTERVIEW_MS;
      interview.activeTimeUsedMs = 0;
      interview.activeSessionStartedAt =
        interview.activeSessionStartedAt || startedAt;
      interview.lastHeartbeatAt = interview.lastHeartbeatAt || startedAt;
      interview.continueAllowedUntil =
        interview.continueAllowedUntil ||
        new Date(interview.startedAt.getTime() + CONTINUE_ALLOWED_MS);
      interview.generationStatus = "completed";
      await interview.save();

      await markApplicationInterviewInProgress(appId);

      return res.json({
        interviewId: interview._id,
        questions: interview.questions,
        answers: [],
        status: interview.status,
        generationStatus: interview.generationStatus,
        ...getTimingPayload(interview),
      });
    } catch (directErr) {
      console.error(
        "Direct question generation failed, falling back to queue:",
        directErr?.message || directErr,
      );

      try {
        const queueJob = await interviewQueue.add("generate_questions", {
          type: "generate_questions",
          interviewId: String(interview._id),
          payload,
        });

        interview.generationJobId = String(queueJob.id);
        await interview.save();
      } catch (queueErr) {
        interview.generationStatus = "failed";
        await interview.save();
        console.error("Question generation queue failed:", queueErr);
        return res.status(500).json({ message: "Question generation failed." });
      }

      await markApplicationInterviewInProgress(appId);

      return res.json({
        interviewId: interview._id,
        questions: [],
        answers: [],
        status: interview.status,
        generationStatus: interview.generationStatus,
        ...getTimingPayload(interview),
      });
    }
  } catch (err) {
    console.error("startInterview error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.submitAnswer = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { interviewId } = req.params;
    const {
      questionId,
      answerText,
      timeTakenSec,
      tabSwitchCount,
      pasteCount,
      hiddenTimeMs,
      answerMode,
      voiceEditRatio,
      voiceWordsPerSec,
      codeLanguage,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      return res.status(400).json({ message: "Invalid interview id" });
    }

    const interview = await Interview.findById(interviewId);
    if (!interview)
      return res.status(404).json({ message: "Interview not found" });

    if (String(interview.candidateId) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (interview.status === "completed") {
      return res.status(400).json({ message: "Interview already completed" });
    }

    if (
      interview.continueAllowedUntil &&
      Date.now() > new Date(interview.continueAllowedUntil).getTime()
    ) {
      const completed = await finalizeInterview(
        interview,
        "continue_window_expired",
      );

      return res.status(400).json({
        message: "Interview continue window has expired.",
        status: "completed",
        completionReason: completed.completionReason,
        ...getTimingPayload(completed),
      });
    }

    if (getActiveRemainingMs(interview) <= 0) {
      const completed = await finalizeInterview(
        interview,
        "active_time_expired",
      );

      return res.status(400).json({
        message: "Interview time has expired.",
        status: "completed",
        completionReason: completed.completionReason,
        ...getTimingPayload(completed),
      });
    }

    const q = interview.questions.find(
      (x) => Number(x.questionId) === Number(questionId),
    );
    if (!q) return res.status(404).json({ message: "Question not found" });

    const alreadyAnswered = interview.answers.some(
      (a) => Number(a.questionId) === Number(questionId),
    );

    if (alreadyAnswered) {
      return res.status(409).json({ message: "Question already answered." });
    }

    const safeAnswerMode = ["text", "voice", "code"].includes(answerMode)
      ? answerMode
      : "text";

    const rawAnswerText = typeof answerText === "string" ? answerText : "";

    // For code, preserve exact formatting. For text/voice, trim is okay.
    const finalAnswerText =
      safeAnswerMode === "code" ? rawAnswerText : rawAnswerText.trim();

    if (!rawAnswerText.trim()) {
      return res.status(400).json({
        message:
          safeAnswerMode === "code"
            ? "Code answer is required."
            : "Answer is required.",
      });
    }

    // Prevent duplicate queue jobs for same question.
    if (
      interview.lastAnswerEvaluationStatus === "pending" &&
      Number(interview.lastPendingQuestionId) === Number(questionId)
    ) {
      return res.json({
        queued: true,
        questionId: Number(questionId),
        evaluationStatus: "pending",
        message: "Evaluation already in progress for this question.",
      });
    }

    const answerMeta = {
      timeTakenSec,
      tabSwitchCount,
      pasteCount,
      hiddenTimeMs,
      answerMode: safeAnswerMode,
      voiceEditRatio: voiceEditRatio ?? null,
      voiceWordsPerSec: voiceWordsPerSec ?? null,
      codeLanguage:
        safeAnswerMode === "code" ? codeLanguage || "javascript" : null,
    };

    interview.lastAnswerEvaluationStatus = "pending";
    interview.lastAnswerEvaluationError = null;
    interview.lastPendingQuestionId = Number(questionId);
    await interview.save();

    const queueJob = await interviewQueue.add(
      "evaluate_answer",
      {
        type: "evaluate_answer",
        interviewId: String(interview._id),
        answerPayload: {
          questionId,
          answerText: finalAnswerText,
        },
        answerMeta,
      },
      {
        jobId: `evaluate:${String(interview._id)}:${Number(questionId)}`,
      },
    );

    interview.lastAnswerEvaluationJobId = String(queueJob.id);
    await interview.save();

    return res.json({
      queued: true,
      questionId: Number(questionId),
      evaluationStatus: "pending",
      jobId: String(queueJob.id),
    });
  } catch (err) {
    console.error("submitAnswer error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getAnswerStatus = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { interviewId, questionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      return res.status(400).json({ message: "Invalid interview id" });
    }

    const interview = await Interview.findById(interviewId).lean();
    if (!interview)
      return res.status(404).json({ message: "Interview not found" });
    if (String(interview.candidateId) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const answer = (interview.answers || []).find(
      (a) => Number(a.questionId) === Number(questionId),
    );

        if (answer) {
      return res.json({
        status: "completed",
        score: answer.score,
      });
    }

    return res.json({
      status: interview.lastAnswerEvaluationStatus || "idle",
      error: interview.lastAnswerEvaluationError || null,
    });
  } catch (err) {
    console.error("getAnswerStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// exports.completeInterview = async (req, res) => {
//   try {
//     const userId = req.user?.id || req.user?._id;
//     const { interviewId } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(interviewId)) {
//       return res.status(400).json({ message: "Invalid interview id" });
//     }

//     const interview = await Interview.findById(interviewId);
//     if (!interview)
//       return res.status(404).json({ message: "Interview not found" });
//     if (String(interview.candidateId) !== String(userId)) {
//       return res.status(403).json({ message: "Forbidden" });
//     }

//     if (interview.status === "completed") {
//       return res.json({
//         alreadyCompleted: true,
//         overallScore: interview.overallScore,
//         finalCheatingRisk: interview.finalCheatingRisk,
//         cameraRiskScore: interview.cameraMonitoring?.cameraRiskScore || 0,
//         status: interview.status,
//       });
//     }

//     const scores = interview.answers.map((a) => Number(a.score || 0));
//     const overallScore = scores.length
//       ? scores.reduce((x, y) => x + y, 0) / scores.length
//       : 0;

//     const answerCheatingRisk = interview.answers.length
//       ? interview.answers.reduce(
//           (acc, a) => acc + Number(a.cheatingRisk || 0),
//           0,
//         ) / interview.answers.length
//       : 0;

//     const camRisk = computeCameraRisk(interview.cameraMonitoring);
//     if (interview.cameraMonitoring) {
//       interview.cameraMonitoring.cameraRiskScore = camRisk;
//     }

//     const blendedRisk = Math.round(answerCheatingRisk * 0.7 + camRisk * 0.3);

//     const completedAt = new Date();

//     interview.overallScore = Number(overallScore.toFixed(2));
//     interview.finalCheatingRisk = Math.min(blendedRisk, 100);
//     interview.status = "completed";
//     interview.completedAt = completedAt;

//     await interview.save();

//     await Application.findByIdAndUpdate(interview.applicationId, {
//       interviewCompletedAt: completedAt,
//       interviewStatus: "completed",
//     });

//     return res.json({
//       overallScore: interview.overallScore,
//       finalCheatingRisk: interview.finalCheatingRisk,
//       cameraRiskScore: camRisk,
//       status: interview.status,
//     });
//   } catch (err) {
//     console.error("completeInterview error:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

exports.completeInterview = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { interviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      return res.status(400).json({ message: "Invalid interview id" });
    }

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (String(interview.candidateId) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (interview.status === "completed") {
      return res.json({
        alreadyCompleted: true,
        overallScore: interview.overallScore,
        finalCheatingRisk: interview.finalCheatingRisk,
        cameraRiskScore: interview.cameraMonitoring?.cameraRiskScore || 0,
        status: interview.status,
        completionReason: interview.completionReason || null,
        ...getTimingPayload(interview),
      });
    }

    if (
      interview.continueAllowedUntil &&
      Date.now() > new Date(interview.continueAllowedUntil).getTime()
    ) {
      const completed = await finalizeInterview(
        interview,
        "continue_window_expired",
      );

      return res.json({
        overallScore: completed.overallScore,
        finalCheatingRisk: completed.finalCheatingRisk,
        cameraRiskScore: completed.cameraMonitoring?.cameraRiskScore || 0,
        status: completed.status,
        completionReason: completed.completionReason,
        ...getTimingPayload(completed),
      });
    }

    if (getActiveRemainingMs(interview) <= 0) {
      const completed = await finalizeInterview(
        interview,
        "active_time_expired",
      );

      return res.json({
        overallScore: completed.overallScore,
        finalCheatingRisk: completed.finalCheatingRisk,
        cameraRiskScore: completed.cameraMonitoring?.cameraRiskScore || 0,
        status: completed.status,
        completionReason: completed.completionReason,
        ...getTimingPayload(completed),
      });
    }

    const completed = await finalizeInterview(interview, "submitted");

    return res.json({
      overallScore: completed.overallScore,
      finalCheatingRisk: completed.finalCheatingRisk,
      cameraRiskScore: completed.cameraMonitoring?.cameraRiskScore || 0,
      status: completed.status,
      completionReason: completed.completionReason,
      ...getTimingPayload(completed),
    });
  } catch (err) {
    console.error("completeInterview error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  analyzeFrame — FIXED violation reason matching + mediapipe_unavailable handling
// ─────────────────────────────────────────────────────────────────────────────
exports.analyzeFrame = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { interviewId } = req.params;
    const { imageBase64 } = req.body;

    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      return res.status(400).json({ message: "Invalid interview id" });
    }
    if (!imageBase64)
      return res.status(400).json({ message: "imageBase64 is required" });

    const interview = await Interview.findById(interviewId);
    if (!interview)
      return res.status(404).json({ message: "Interview not found" });
    if (String(interview.candidateId) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (interview.status === "completed") return res.json({ skipped: true });

    if (!interview.cameraMonitoring)
      interview.cameraMonitoring = defaultCameraMonitoring();

    // Default — safe values used if NLP service is unreachable
    let analysis = {
      face_detected: true,
      face_count: 1,
      head_direction: "center",
      eye_direction: "center",
      violation: false,
      violation_reason: null,
      risk_delta: 0,
      mediapipe_available: false,
    };

    try {
      const nlpRes = await axios.post(
        `${NLP_BASE}/interview/analyze-frame`,
        { interviewId: String(interviewId), imageBase64 },
        { timeout: 5000 },
      );
      analysis = nlpRes.data || analysis;

      // Log when mediapipe is unavailable so you can diagnose quickly
      if (analysis.mediapipe_available === false) {
        console.warn(
          `[analyzeFrame] MediaPipe not available in NLP service. Error: ${analysis.error || "unknown"}. ` +
            `Run: pip install mediapipe opencv-python-headless --break-system-packages`,
        );
      }
    } catch (nlpErr) {
      console.warn(
        "Camera NLP service error (non-fatal):",
        nlpErr?.message || nlpErr,
      );
    }

    const cam = interview.cameraMonitoring;
    cam.totalFramesAnalyzed = (cam.totalFramesAnalyzed || 0) + 1;

    // Only increment counts when MediaPipe is actually running and returned real data
    if (analysis.mediapipe_available !== false && analysis.violation) {
      const reason = (analysis.violation_reason || "").toLowerCase();

      if (["no_face", "empty_frame", "decode_error"].includes(reason)) {
        // Face missing
        cam.noFaceCount = (cam.noFaceCount || 0) + 1;
      } else if (reason === "multiple_faces") {
        // Multiple people detected
        cam.multipleFacesCount = (cam.multipleFacesCount || 0) + 1;
      } else if (
        reason.includes("looking_away") ||
        reason.includes("head_turned") ||
        reason.includes("eye")
      ) {
        // Head turned or eyes looking away — both map to lookingAwayCount
        cam.lookingAwayCount = (cam.lookingAwayCount || 0) + 1;
      } else {
        // Any other movement violation
        cam.movementViolationCount = (cam.movementViolationCount || 0) + 1;
      }

      cam.warningCount = (cam.warningCount || 0) + 1;
    }

    if (!Array.isArray(cam.events)) cam.events = [];
    if (cam.events.length < 200) {
      cam.events.push({
        recordedAt: new Date(),
        faceDetected: analysis.face_detected,
        faceCount: analysis.face_count,
        headDirection: analysis.head_direction,
        eyeDirection: analysis.eye_direction,
        violation: analysis.violation,
        violationReason: analysis.violation_reason || null,
      });
    }

    await interview.save();

    const warningLevel =
      cam.warningCount >= 3
        ? "high"
        : cam.warningCount === 2
          ? "recorded"
          : cam.warningCount === 1
            ? "warning"
            : "ok";

    return res.json({
      ...analysis,
      warningLevel,
      warningCount: cam.warningCount || 0,
    });
  } catch (err) {
    console.error("analyzeFrame error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.saveSnapshot = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { interviewId } = req.params;
    const { imageBase64, flagged, violationReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      return res.status(400).json({ message: "Invalid interview id" });
    }

    if (!imageBase64) {
      return res.status(400).json({ message: "imageBase64 is required" });
    }

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (String(interview.candidateId) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (interview.status === "completed") {
      return res.json({ skipped: true });
    }

    if (!interview.cameraMonitoring) {
      interview.cameraMonitoring = defaultCameraMonitoring();
    }

    if (!Array.isArray(interview.cameraMonitoring.snapshots)) {
      interview.cameraMonitoring.snapshots = [];
    }

    const base64Data = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    const buffer = Buffer.from(base64Data, "base64");

    if (!buffer.length) {
      return res.status(400).json({ message: "Invalid snapshot image data" });
    }

    const uploaded = await uploadImageBuffer({
      buffer,
      folder: `nlpias/interview-snapshots/${interviewId}`,
      originalName: `snapshot-${Date.now()}.jpg`,
      publicIdPrefix: "snapshot",
    });

    interview.cameraMonitoring.snapshots.push({
      capturedAt: new Date(),

      // New cloud fields
      storageProvider: uploaded.storageProvider,
      fileUrl: uploaded.fileUrl,
      cloudinaryPublicId: uploaded.cloudinaryPublicId,
      cloudinaryAssetId: uploaded.cloudinaryAssetId,
      resourceType: uploaded.resourceType || "image",

      // Old field kept for backward compatibility
      filePath: null,

      flagged: !!flagged,
      violationReason: violationReason || null,
    });

    await interview.save();

    return res.json({
      saved: true,
      storageProvider: uploaded.storageProvider,
      fileUrl: uploaded.fileUrl,
    });
  } catch (err) {
    console.error("saveSnapshot error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.cameraOff = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { interviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      return res.status(400).json({ message: "Invalid interview id" });
    }

    const interview = await Interview.findById(interviewId);
    if (!interview)
      return res.status(404).json({ message: "Interview not found" });
    if (String(interview.candidateId) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (interview.status === "completed") return res.json({ skipped: true });

    if (!interview.cameraMonitoring)
      interview.cameraMonitoring = defaultCameraMonitoring();
    const cam = interview.cameraMonitoring;

    cam.cameraOffCount = (cam.cameraOffCount || 0) + 1;
    cam.warningCount = (cam.warningCount || 0) + 1;

    if (!Array.isArray(cam.events)) cam.events = [];
    if (cam.events.length < 200) {
      cam.events.push({
        recordedAt: new Date(),
        faceDetected: false,
        faceCount: 0,
        headDirection: "unknown",
        eyeDirection: "unknown",
        violation: true,
        violationReason: "camera_off",
      });
    }

    await interview.save();

    const warningLevel =
      cam.warningCount >= 3
        ? "high"
        : cam.warningCount === 2
          ? "recorded"
          : "warning";

    return res.json({ recorded: true, warningLevel });
  } catch (err) {
    console.error("cameraOff error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getJobInterviewDetails = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const userRole = req.user?.role;
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job id" });
    }

    const jobQuery =
      userRole === "admin" ? { _id: jobId } : { _id: jobId, createdBy: userId };
    const job = await Job.findOne(jobQuery)
      .select("title createdBy")
      .populate({ path: "createdBy", select: "companyName name email" })
      .lean();

    if (!job) {
      return res
        .status(404)
        .json({ message: "Job not found or you are not allowed to view it." });
    }

    const interviews = await Interview.find({ jobId, status: "completed" })
      .sort({ completedAt: -1, createdAt: -1 })
      .populate({ path: "candidateId", select: "name email" })
      .populate({
        path: "applicationId",
        select: "chosenDate confirmedAt interviewCompletedAt status",
      })
      .select(
        "applicationId candidateId answers overallScore finalCheatingRisk completedAt startedAt cameraMonitoring status",
      )
      .lean();

    const candidates = interviews.map((interview) => {
      const cam = interview.cameraMonitoring || {};
      const computedCameraRisk = computeCameraRisk(cam);
      const cameraRiskScore =
        typeof cam.cameraRiskScore === "number"
          ? cam.cameraRiskScore
          : computedCameraRisk;
      const integrityRisk =
        typeof interview.finalCheatingRisk === "number"
          ? interview.finalCheatingRisk
          : cameraRiskScore;
      const integrityScore = Math.max(0, 100 - Number(integrityRisk || 0));

      return {
        interviewId: interview._id,
        applicationId: interview.applicationId?._id || interview.applicationId,
        candidateId: interview.candidateId?._id || interview.candidateId,
        candidateName: interview.candidateId?.name || "Candidate",
        candidateEmail: interview.candidateId?.email || "—",
        interviewDate:
          interview.completedAt ||
          interview.applicationId?.interviewCompletedAt ||
          interview.applicationId?.chosenDate ||
          interview.startedAt,
        overallScore:
          typeof interview.overallScore === "number"
            ? interview.overallScore
            : null,
        integrityRisk,
        integrityScore,
        answers: (interview.answers || []).map((a) => ({
          questionId: a.questionId,
          question: a.question,
          skill: a.skill,
          type: a.type,
          difficulty: a.difficulty,
          answerText: a.answerText,
          transcriptText: a.transcriptText,
          answerMode: a.answerMode,
          codeLanguage: a.codeLanguage,
          codeAnswer: a.codeAnswer,
          score: a.score,
          feedback: a.feedback,
          grading: a.grading || {},
          cheatingRisk: a.cheatingRisk || 0,
        })),
        cameraSummary: {
          cameraOffCount: cam.cameraOffCount || 0,
          noFaceCount: cam.noFaceCount || 0,
          multipleFacesCount: cam.multipleFacesCount || 0,
          lookingAwayCount: cam.lookingAwayCount || 0,
          movementViolationCount: cam.movementViolationCount || 0,
          totalFramesAnalyzed: cam.totalFramesAnalyzed || 0,
          warningCount: cam.warningCount || 0,
          snapshotsCount: Array.isArray(cam.snapshots)
            ? cam.snapshots.length
            : 0,
          cameraRiskScore,
        },
      };
    });

    return res.json({
      job: {
        _id: job._id,
        title: job.title,
        companyName:
          job.createdBy?.companyName || job.createdBy?.name || "Company",
      },
      candidates,
    });
  } catch (err) {
    console.error("getJobInterviewDetails error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getCameraReport = async (req, res) => {
  try {
    const { interviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      return res.status(400).json({ message: "Invalid interview id" });
    }

    const interview = await Interview.findById(interviewId)
      .select(
        "cameraMonitoring candidateId finalCheatingRisk overallScore status",
      )
      .lean();

    if (!interview)
      return res.status(404).json({ message: "Interview not found" });

    // const baseUrl = process.env.SERVER_BASE_URL || "http://localhost:5000";
    // const snapshots = (interview.cameraMonitoring?.snapshots || []).map(
    //   (snap) => ({
    //     capturedAt: snap.capturedAt,
    //     flagged: snap.flagged,
    //     violationReason: snap.violationReason,
    //     url: `${baseUrl}/api/interview/snapshot/${encodeURIComponent(snap.filePath)}`,
    //   }),
    // );

    const baseUrl = process.env.SERVER_BASE_URL || "http://localhost:5000";

    const snapshots = (interview.cameraMonitoring?.snapshots || []).map(
      (snap) => {
        const url = snap.fileUrl
          ? snap.fileUrl
          : `${baseUrl}/api/interview/snapshot/${encodeURIComponent(snap.filePath)}`;

        return {
          capturedAt: snap.capturedAt,
          flagged: snap.flagged,
          violationReason: snap.violationReason,
          storageProvider:
            snap.storageProvider || (snap.fileUrl ? "cloudinary" : "local"),
          url,
        };
      },
    );

    return res.json({
      candidateId: interview.candidateId,
      status: interview.status,
      overallScore: interview.overallScore,
      finalCheatingRisk: interview.finalCheatingRisk,
      cameraMonitoring: {
        ...(interview.cameraMonitoring || {}),
        snapshots,
      },
    });
  } catch (err) {
    console.error("getCameraReport error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// exports.serveSnapshot = async (req, res) => {
//   try {
//     const { filePath } = req.params;
//     const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
//     const fullPath = path.join(__dirname, "../uploads", safePath);

//     if (!fs.existsSync(fullPath)) {
//       return res.status(404).json({ message: "Snapshot not found" });
//     }

//     res.setHeader("Content-Type", "image/jpeg");
//     res.setHeader("Cache-Control", "private, max-age=3600");
//     fs.createReadStream(fullPath).pipe(res);
//   } catch (err) {
//     console.error("serveSnapshot error:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

exports.serveSnapshot = async (req, res) => {
  try {
    const { filePath } = req.params;

    if (!filePath) {
      return res
        .status(400)
        .json({ message: "Snapshot file path is required" });
    }

    const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");

    const fullPath = path.join(__dirname, "../uploads", safePath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: "Snapshot not found" });
    }

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");

    return fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    console.error("serveSnapshot error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.heartbeatInterview = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { interviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      return res.status(400).json({ message: "Invalid interview id" });
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (String(interview.candidateId) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (interview.status === "completed") {
      return res.json({
        status: "completed",
        alreadyCompleted: true,
        overallScore: interview.overallScore,
        finalCheatingRisk: interview.finalCheatingRisk,
        cameraRiskScore: interview.cameraMonitoring?.cameraRiskScore || 0,
        ...getTimingPayload(interview),
      });
    }

    const now = new Date();

    if (
      interview.continueAllowedUntil &&
      now.getTime() > new Date(interview.continueAllowedUntil).getTime()
    ) {
      const completed = await finalizeInterview(
        interview,
        "continue_window_expired",
      );

      return res.json({
        status: "completed",
        timedOut: true,
        message: "Continue window expired.",
        overallScore: completed.overallScore,
        finalCheatingRisk: completed.finalCheatingRisk,
        cameraRiskScore: completed.cameraMonitoring?.cameraRiskScore || 0,
        ...getTimingPayload(completed),
      });
    }

    if (!interview.activeSessionStartedAt) {
      interview.activeSessionStartedAt = now;
    }

    if (interview.lastHeartbeatAt) {
      const delta =
        now.getTime() - new Date(interview.lastHeartbeatAt).getTime();

      if (delta > 0) {
        interview.activeTimeUsedMs =
          Number(interview.activeTimeUsedMs || 0) +
          Math.min(delta, HEARTBEAT_MAX_DELTA_MS);
      }
    }

    interview.lastHeartbeatAt = now;

    if (getActiveRemainingMs(interview) <= 0) {
      const completed = await finalizeInterview(
        interview,
        "active_time_expired",
      );

      return res.json({
        status: "completed",
        timedOut: true,
        message: "Active interview time expired.",
        overallScore: completed.overallScore,
        finalCheatingRisk: completed.finalCheatingRisk,
        cameraRiskScore: completed.cameraMonitoring?.cameraRiskScore || 0,
        ...getTimingPayload(completed),
      });
    }

    await interview.save();

    return res.json({
      status: interview.status,
      ...getTimingPayload(interview),
    });
  } catch (err) {
    console.error("heartbeatInterview error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
