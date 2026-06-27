// //server/controllers/applicationController.js
const Application = require("../models/Application");
const Job = require("../models/Job");
const ProcessedResume = require("../models/ProcessedResume");
const { applicationQueue } = require("../queue/applicationQueue");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const Resume = require("../models/Resume");
const { uploadBufferToCloudinary } = require("../utils/fileStorage");
const { sendMail } = require("../utils/mailer");

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getFrontendLoginUrl() {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  return `${frontendUrl.replace(/\/$/, "")}/login`;
}

function formatEmailDate(value) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true,
    });
  } catch {
    return String(value);
  }
}

function buildEmailButton(url, text, bg = "#2563eb") {
  return `
    <a href="${url}"
       style="
        display:inline-block;
        padding:12px 20px;
        background:${bg};
        color:#ffffff;
        text-decoration:none;
        border-radius:8px;
        font-weight:700;
        margin-top:14px;
       ">
      ${text}
    </a>
  `;
}

function getMimeTypeFromFilename(filename = "") {
  const lower = String(filename).toLowerCase();

  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  return "application/octet-stream";
}

function ensureApplicationResumesDir() {
  const dir = path.join(__dirname, "..", "uploads", "application-resumes");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function resolveStoredFilePath(filePathOrUrl) {
  if (!filePathOrUrl) return null;

  const value = String(filePathOrUrl);

  if (path.isAbsolute(value)) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    const fileName = path.basename(new URL(value).pathname);
    return path.join(__dirname, "..", "uploads", "resumes", fileName);
  }

  return path.join(__dirname, "..", value);
}

function copyFileToApplicationSnapshot({
  sourcePath,
  applicationId,
  originalName,
}) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error("Source resume file not found for application snapshot.");
  }

  const dir = ensureApplicationResumesDir();

  const ext = path.extname(originalName || sourcePath) || ".pdf";
  const fileName = `application_${applicationId}_resume${ext}`;
  const destinationPath = path.join(dir, fileName);

  fs.copyFileSync(sourcePath, destinationPath);

  const stat = fs.statSync(destinationPath);

  return {
    storageProvider: "local",
    filePath: path
      .join("uploads", "application-resumes", fileName)
      .replace(/\\/g, "/"),
    fileUrl: null,
    originalName: originalName || fileName,
    mimeType: getMimeTypeFromFilename(originalName || fileName),
    size: stat.size,
    cloudinaryPublicId: null,
    cloudinaryAssetId: null,
    resourceType: "raw",
  };
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function getReadableStoredFile(fileObj) {
  if (!fileObj) return null;
  return fileObj.fileUrl || fileObj.filePath || null;
}

async function downloadRemoteFileToBuffer(fileUrl) {
  const resp = await axios.get(fileUrl, {
    responseType: "arraybuffer",
    timeout: 120000,
  });

  return {
    buffer: Buffer.from(resp.data),
    contentType: resp.headers["content-type"] || "application/octet-stream",
    size:
      Number(resp.headers["content-length"] || 0) ||
      Buffer.byteLength(resp.data),
  };
}

async function copyCloudFileToApplicationSnapshot({
  sourceUrl,
  applicationId,
  originalName,
  mimeType,
}) {
  if (!sourceUrl) {
    throw new Error("Cloud source URL is missing for application snapshot.");
  }

  const { buffer, contentType, size } =
    await downloadRemoteFileToBuffer(sourceUrl);

  const ext =
    path.extname(originalName || "") ||
    path.extname(new URL(sourceUrl).pathname) ||
    ".pdf";

  const safeFormat = ext.replace(".", "").toLowerCase() || "pdf";
  const fileName = `application_${applicationId}_resume${ext}`;

  const result = await uploadBufferToCloudinary(buffer, {
    folder: `nlpias/application-resumes/${applicationId}`,
    public_id: `application_${applicationId}_resume`,
    resource_type: "raw",
    format: safeFormat,
    overwrite: true,
  });

  return {
    storageProvider: "cloudinary",
    filePath: null,
    fileUrl: result.secure_url,
    originalName: originalName || fileName,
    mimeType: mimeType || contentType || getMimeTypeFromFilename(fileName),
    size: result.bytes || size || buffer.length,
    cloudinaryPublicId: result.public_id,
    cloudinaryAssetId: result.asset_id,
    resourceType: result.resource_type || "raw",
  };
}

async function createApplicationResumeSnapshot({
  sourceFile,
  applicationId,
  originalName,
  mimeType,
}) {
  const readable = getReadableStoredFile(sourceFile);

  if (!readable) {
    throw new Error("Resume file URL/path missing for application snapshot.");
  }

  // New cloud flow
  if (isHttpUrl(readable)) {
    return await copyCloudFileToApplicationSnapshot({
      sourceUrl: readable,
      applicationId,
      originalName,
      mimeType,
    });
  }

  // Old local fallback flow
  const sourcePath = resolveStoredFilePath(readable);

  return copyFileToApplicationSnapshot({
    sourcePath,
    applicationId,
    originalName,
  });
}

// ✅ helper: ensure reschedule object exists (important for old DB records)
function ensureReschedule(appDoc) {
  if (!appDoc.reschedule) {
    appDoc.reschedule = {
      status: "none",
      requestedDate: null,
      requestedAt: null,
      recruiterReplyAt: null,
      recruiterNote: null,
    };
  } else {
    // ensure missing keys don't crash
    appDoc.reschedule.status = appDoc.reschedule.status || "none";
    if (typeof appDoc.reschedule.requestedDate === "undefined")
      appDoc.reschedule.requestedDate = null;
    if (typeof appDoc.reschedule.requestedAt === "undefined")
      appDoc.reschedule.requestedAt = null;
    if (typeof appDoc.reschedule.recruiterReplyAt === "undefined")
      appDoc.reschedule.recruiterReplyAt = null;
    if (typeof appDoc.reschedule.recruiterNote === "undefined")
      appDoc.reschedule.recruiterNote = null;
  }
}

exports.create = async (req, res) => {
  let appDoc = null;

  try {
    const candidateId = req.user?.id || req.user?._id;
    const { jobId, resumeSource, resumeFileId, resumeName, screeningAnswers } =
      req.body;

    if (!candidateId) return res.status(401).json({ message: "Unauthorized" });
    if (!jobId) return res.status(400).json({ message: "jobId is required" });

    const job = await Job.findById(jobId).select(
      "isClosed applicationDeadline title createdBy customQuestions screeningQuestions",
    );

    if (!job) return res.status(404).json({ message: "Job not found" });

    const now = new Date();

    if (job.isClosed === true) {
      return res.status(400).json({ message: "This job is closed" });
    }

    if (job.applicationDeadline && new Date(job.applicationDeadline) < now) {
      return res
        .status(400)
        .json({ message: "Application deadline has passed" });
    }

    const exists = await Application.findOne({
      candidate: candidateId,
      job: jobId,
    });

    if (exists) {
      return res
        .status(409)
        .json({ message: "You already applied to this job" });
    }

    if (
      job.customQuestions &&
      Array.isArray(job.screeningQuestions) &&
      job.screeningQuestions.length > 0
    ) {
      if (
        !Array.isArray(screeningAnswers) ||
        screeningAnswers.length !== job.screeningQuestions.length
      ) {
        return res.status(400).json({
          message: `This job requires ${job.screeningQuestions.length} screening answers.`,
        });
      }

      const allAnswered = screeningAnswers.every(
        (a) => typeof a === "string" && a.trim().length > 0,
      );

      if (!allAnswered) {
        return res.status(400).json({
          message: "All screening questions must be answered.",
        });
      }
    }

    const rSource = resumeSource || "default";

    const resumeDoc = await Resume.findOne({ userId: String(candidateId) });

    if (!resumeDoc) {
      return res.status(400).json({
        message: "Please create or upload a resume before applying.",
      });
    }

    appDoc = await Application.create({
      candidate: candidateId,
      job: jobId,
      resumeSource: rSource,
      resumeFileId: resumeFileId || null,
      resumeName:
        resumeName ||
        (rSource === "default" ? "Resume (Built in Builder)" : null),
      resumePath: null,
      screeningAnswers: Array.isArray(screeningAnswers) ? screeningAnswers : [],
      matchScore: null,
      semanticScore: null,
      ruleScore: null,
      similarity: null,
      matchBreakdown: null,
      matchingStatus: "pending",
      matchingStartedAt: new Date(),
    });

    let snapshot = null;


    if (rSource === "default") {
      const builderPdf = resumeDoc.builderPdf;

      if (!builderPdf?.fileUrl && !builderPdf?.filePath) {
        await Application.findByIdAndDelete(appDoc._id);
        return res.status(400).json({
          message: "Please save your Resume Builder PDF before applying.",
        });
      }

      snapshot = await createApplicationResumeSnapshot({
        sourceFile: builderPdf,
        applicationId: appDoc._id,
        originalName:
          builderPdf.originalName || "Resume (Built in Builder).pdf",
        mimeType: builderPdf.mimeType || "application/pdf",
      });

      appDoc.submittedResume = {
        sourceType: "builder",
        originalName: snapshot.originalName,
        storageProvider: snapshot.storageProvider,
        filePath: snapshot.filePath,
        fileUrl: snapshot.fileUrl,

        cloudinaryPublicId: snapshot.cloudinaryPublicId,
        cloudinaryAssetId: snapshot.cloudinaryAssetId,
        resourceType: snapshot.resourceType || "raw",

        mimeType: snapshot.mimeType,
        size: snapshot.size,

        templateId: resumeDoc.templateId || builderPdf.templateId || "modern",
        themeColor: resumeDoc.themeColor || builderPdf.themeColor || "#2563eb",
        fontFamily: resumeDoc.fontFamily || builderPdf.fontFamily || "Inter",
        spacing: resumeDoc.spacing || builderPdf.spacing || "normal",

        sourceResumeId: String(resumeDoc._id),
        sourceUploadedFileId: null,
        submittedAt: new Date(),
      };

      appDoc.resumeName = snapshot.originalName;
      appDoc.resumePath = snapshot.filePath || snapshot.fileUrl;
    }
    if (rSource === "upload") {
      if (!resumeFileId) {
        await Application.findByIdAndDelete(appDoc._id);
        return res.status(400).json({
          message: "Please select an uploaded resume.",
        });
      }

      const uploaded = (resumeDoc.uploadedFiles || []).find(
        (file) =>
          String(file._id) === String(resumeFileId) && file.isDeleted !== true,
      );

      if (!uploaded) {
        await Application.findByIdAndDelete(appDoc._id);
        return res.status(400).json({
          message: "Selected uploaded resume was not found.",
        });
      }
      snapshot = await createApplicationResumeSnapshot({
        sourceFile: uploaded,
        applicationId: appDoc._id,
        originalName: uploaded.originalName || resumeName || "Uploaded Resume",
        mimeType: uploaded.mimeType,
      });

      appDoc.submittedResume = {
        sourceType: "upload",
        originalName: snapshot.originalName,
        storageProvider: snapshot.storageProvider,
        filePath: snapshot.filePath,
        fileUrl: snapshot.fileUrl,

        cloudinaryPublicId: snapshot.cloudinaryPublicId,
        cloudinaryAssetId: snapshot.cloudinaryAssetId,
        resourceType: snapshot.resourceType || "raw",

        mimeType: snapshot.mimeType,
        size: snapshot.size,

        templateId: null,
        themeColor: null,
        fontFamily: null,
        spacing: null,

        sourceResumeId: String(resumeDoc._id),
        sourceUploadedFileId: uploaded._id,
        submittedAt: new Date(),
      };

      appDoc.resumeName = snapshot.originalName;
      appDoc.resumePath = snapshot.filePath || snapshot.fileUrl;
    }

    if (!appDoc.submittedResume?.filePath && !appDoc.submittedResume?.fileUrl) {
      await Application.findByIdAndDelete(appDoc._id);
      return res.status(400).json({
        message: "Unable to create submitted resume snapshot.",
      });
    }

    const queueJob = await applicationQueue.add("application_match_process", {
      applicationId: String(appDoc._id),
      candidateId: String(candidateId),
      jobId: String(jobId),
      resumeSource: rSource,
      resumeFileId: resumeFileId ? String(resumeFileId) : null,
    });

    appDoc.matchingJobId = String(queueJob.id);
    await appDoc.save();

    return res.status(201).json(appDoc);
  } catch (err) {
    console.error("create application error:", err);

    if (appDoc?._id) {
      try {
        await Application.findByIdAndDelete(appDoc._id);
      } catch {}
    }

    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/applications/mine
exports.mine = async (req, res) => {
  try {
    const candidateId = req.user?.id || req.user?._id;
    if (!candidateId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let apps = await Application.find({ candidate: candidateId })
      .sort({ createdAt: -1 })
      .select(
        "candidate job resumeSource resumeFileId resumeName resumePath " +
          "status createdAt inviteDates invitedAt chosenDate confirmedAt " +
          "interviewStatus interviewCompletedAt " +
          "matchScore semanticScore ruleScore similarity matchBreakdown " +
          "reschedule",
      )
      .populate({
        path: "job",
        select:
          "title companyName createdBy jobLocation location isRemote salaryVisible salaryMin salaryMax",
        populate: { path: "createdBy", select: "companyName name" },
      })
      .lean();

    if (!apps.length) return res.json([]);

    const { Types } = mongoose;

    const rawJobIds = apps
      .map((a) => {
        if (a.job && a.job._id) return String(a.job._id);
        if (a.job) return String(a.job);
        return null;
      })
      .filter((id) => id && id !== "null" && Types.ObjectId.isValid(id));

    const jobIds = [...new Set(rawJobIds)];
    if (!jobIds.length) return res.json(apps);

    const allAppsForJobs = await Application.find({
      job: { $in: jobIds },
    })
      .select("_id job matchScore createdAt")
      .lean();

    const groupByJob = {};
    for (const a of allAppsForJobs) {
      if (!a || !a.job) continue;
      const jId = String(a.job);
      if (!groupByJob[jId]) groupByJob[jId] = [];
      groupByJob[jId].push(a);
    }

    const rankingMap = {};
    Object.entries(groupByJob).forEach(([jobId, list]) => {
      list.sort((a, b) => {
        const sa = typeof a.matchScore === "number" ? a.matchScore : -Infinity;
        const sb = typeof b.matchScore === "number" ? b.matchScore : -Infinity;

        if (sb !== sa) return sb - sa;

        const ta = new Date(a.createdAt || 0).getTime() || 0;
        const tb = new Date(b.createdAt || 0).getTime() || 0;
        return ta - tb;
      });

      rankingMap[jobId] = {
        total: list.length,
        orderedIds: list.map((x) => String(x._id)),
      };
    });

    apps = apps.map((app) => {
      const jobId = app.job && app.job._id ? String(app.job._id) : null;
      if (!jobId) return app;

      const r = rankingMap[jobId];
      if (!r) return app;

      const idx = r.orderedIds.indexOf(String(app._id));
      if (idx === -1) return app;

      return {
        ...app,
        applicantRank: idx + 1,
        totalApplicants: r.total,
      };
    });

    return res.json(apps);
  } catch (err) {
    console.error("mine applications error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/applications/job/:jobId
exports.listForJob = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const jobId = req.params.jobId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid jobId" });
    }
    const jobObjectId = new mongoose.Types.ObjectId(jobId);

    const job = await Job.findById(jobObjectId)
      .select("createdBy title customQuestions screeningQuestions")
      .lean();
    if (!job) return res.status(404).json({ message: "Job not found" });

    if (
      job.createdBy &&
      String(job.createdBy) !== String(userId) &&
      req.user?.role !== "admin"
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const apps = await Application.find({ job: jobObjectId })
      .sort({ createdAt: -1 })
      .select(
        "candidate job resumeSource resumeFileId resumeName resumePath status createdAt inviteDates invitedAt chosenDate confirmedAt screeningAnswers matchScore semanticScore ruleScore similarity matchBreakdown reschedule",
      )
      .populate({ path: "candidate", select: "name email" })
      .lean();

    return res.json({
      job: {
        id: job._id,
        title: job.title,
        customQuestions: job.customQuestions,
        screeningQuestions: job.screeningQuestions,
      },
      applications: apps,
    });
  } catch (err) {
    if (err?.name === "CastError") {
      return res.status(400).json({ message: "Invalid jobId" });
    }
    console.error("listForJob error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/applications/recruiter/all
exports.listForRecruiterAll = async (req, res) => {
  try {
    const recruiterId = req.user?.id || req.user?._id;
    if (!recruiterId) return res.status(401).json({ message: "Unauthorized" });

    const jobs = await Job.find({ createdBy: recruiterId })
      .select("_id title")
      .lean();

    if (!jobs.length) {
      return res.json({ count: 0, applications: [], jobs: [] });
    }

    const jobIds = jobs.map((j) => j._id);
    const apps = await Application.find({ job: { $in: jobIds } })
      .sort({ createdAt: -1 })
      .populate({ path: "candidate", select: "name email" })
      .select(
        "candidate job resumeSource resumeFileId resumeName resumePath " +
          "status createdAt inviteDates invitedAt chosenDate confirmedAt " +
          "interviewStatus interviewCompletedAt " +
          "screeningAnswers matchScore semanticScore ruleScore similarity matchBreakdown reschedule",
      )
      .populate({ path: "job", select: "title createdBy" })
      .lean();

    return res.json({
      count: apps.length,
      applications: apps,
      jobs,
    });
  } catch (err) {
    console.error("listForRecruiterAll error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/applications/:appId/invite
// PUT /api/applications/:appId/invite
exports.invite = async (req, res) => {
  try {
    const recruiterId = req.user?.id || req.user?._id;

    if (!recruiterId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { appId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ message: "Invalid application id" });
    }

    const appDoc = await Application.findById(appId)
      .populate("candidate", "name email")
      .populate({
        path: "job",
        select: "title createdBy",
        populate: {
          path: "createdBy",
          select: "companyName name email",
        },
      });

    if (!appDoc) {
      return res.status(404).json({ message: "Application not found" });
    }

    const isRecruiterOwner =
      String(appDoc.job?.createdBy?._id || appDoc.job?.createdBy) ===
      String(recruiterId);

    if (!isRecruiterOwner && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const rawDates = Array.isArray(req.body?.inviteDates)
      ? req.body.inviteDates
      : [];

    const inviteDates = rawDates
      .map((date) => new Date(date))
      .filter((date) => !Number.isNaN(date.getTime()));

    if (inviteDates.length < 2 || inviteDates.length > 3) {
      return res.status(400).json({
        message: "Please provide 2 to 3 valid interview date options.",
      });
    }

    appDoc.inviteDates = inviteDates;
    appDoc.invitedAt = new Date();
    appDoc.status = "Invited, not yet confirmed";
    appDoc.chosenDate = null;
    appDoc.confirmedAt = null;

    await appDoc.save();

    const candidateName = appDoc.candidate?.name || "Candidate";
    const candidateEmail = appDoc.candidate?.email;
    const jobTitle = appDoc.job?.title || "the job position";

    const companyName =
      appDoc.job?.createdBy?.companyName ||
      appDoc.job?.createdBy?.name ||
      "the company";

    const loginUrl = getFrontendLoginUrl();

    const dateItems = inviteDates
      .map(
        (date, index) =>
          `<li><strong>Option ${index + 1}:</strong> ${escapeHtml(
            formatEmailDate(date),
          )}</li>`,
      )
      .join("");

    const subject = `Interview Invitation for ${jobTitle}`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color:#111827;">
        <h2 style="color:#2563eb;">Congratulations, ${escapeHtml(candidateName)}!</h2>

        <p>
          You have been shortlisted for the position of
          <strong>${escapeHtml(jobTitle)}</strong>
          at <strong>${escapeHtml(companyName)}</strong>.
        </p>

        <p>
          Kindly confirm your availability by logging into your account and selecting
          one of the proposed interview dates below:
        </p>

        <ul>
          ${dateItems}
        </ul>

        <p>
          Please click the button below to log in and confirm your interview availability.
        </p>

        ${buildEmailButton(loginUrl, "Login to Confirm Availability")}

        <p style="margin-top:18px;">
          Regards,<br/>
          <strong>${escapeHtml(companyName)}</strong>
        </p>
      </div>
    `;

    let emailSent = false;

    if (candidateEmail) {
      emailSent = await sendMail(candidateEmail, subject, html);
    }

    return res.json({
      ok: true,
      message: emailSent
        ? "Invitation sent and email delivered to candidate."
        : "Invitation saved, but email could not be sent.",
      application: appDoc,
      emailSent,
    });
  } catch (err) {
    console.error("invite error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/applications/:appId/confirm
exports.confirm = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { appId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ message: "Invalid application id" });
    }

    const chosenRaw = req.body?.chosenDate;
    if (!chosenRaw)
      return res.status(400).json({ message: "chosenDate is required" });
    const chosen = new Date(chosenRaw);
    if (Number.isNaN(chosen.getTime())) {
      return res.status(400).json({ message: "chosenDate is invalid" });
    }

    const appDoc = await Application.findById(appId)
      .populate("candidate", "_id name email")
      .populate("job", "title createdBy");
    if (!appDoc)
      return res.status(404).json({ message: "Application not found" });

    const isOwner = String(appDoc.candidate?._id) === String(userId);
    if (!isOwner && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!Array.isArray(appDoc.inviteDates) || appDoc.inviteDates.length < 2) {
      return res.status(400).json({
        message: "No interview options to confirm yet.",
      });
    }

    const isOneOfOptions = appDoc.inviteDates.some(
      (d) => new Date(d).getTime() === chosen.getTime(),
    );
    if (!isOneOfOptions) {
      return res.status(400).json({
        message: "Chosen date is not among proposed options.",
      });
    }

    appDoc.chosenDate = chosen;
    appDoc.confirmedAt = new Date();
    appDoc.status = "InterviewConfirmed";

    // ✅ clear reschedule safely
    ensureReschedule(appDoc);
    appDoc.reschedule = {
      status: "none",
      requestedDate: null,
      requestedAt: null,
      recruiterReplyAt: null,
      recruiterNote: null,
    };

    await appDoc.save();

    return res.json({ ok: true, application: appDoc });
  } catch (err) {
    console.error("confirm error:", err);
    if (err?.name === "ValidationError") {
      return res.status(400).json({
        message: Object.values(err.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/applications/:appId
 * Used by InterviewInvitation page
 */
exports.getOne = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { appId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ message: "Invalid application id" });
    }

    const appDoc = await Application.findById(appId)
      .populate({
        path: "job",
        select: "title companyName createdBy jobLocation location isRemote",
        populate: { path: "createdBy", select: "companyName name" },
      })
      .populate({ path: "candidate", select: "name email _id" })
      .lean();

    if (!appDoc)
      return res.status(404).json({ message: "Application not found" });

    const isCandidate = String(appDoc.candidate?._id) === String(userId);
    const isRecruiterOwner =
      String(appDoc.job?.createdBy?._id || appDoc.job?.createdBy) ===
      String(userId);

    if (!isCandidate && !isRecruiterOwner && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(appDoc);
  } catch (err) {
    console.error("getOne error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Candidate requests reschedule
 * PUT /api/applications/:appId/reschedule-request
 * body: { requestedDate, note? }
 */
exports.rescheduleRequest = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { appId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ message: "Invalid application id" });
    }

    const requestedRaw = req.body?.requestedDate;
    if (!requestedRaw) {
      return res.status(400).json({ message: "requestedDate is required" });
    }
    const requested = new Date(requestedRaw);
    if (Number.isNaN(requested.getTime())) {
      return res.status(400).json({ message: "requestedDate is invalid" });
    }

    const appDoc = await Application.findById(appId)
      .populate("candidate", "_id")
      .populate("job", "createdBy title");
    if (!appDoc)
      return res.status(404).json({ message: "Application not found" });

    const isOwner = String(appDoc.candidate?._id) === String(userId);
    if (!isOwner && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (
      appDoc.status !== "Invited, not yet confirmed" &&
      appDoc.status !== "InterviewConfirmed"
    ) {
      return res.status(400).json({
        message: "Reschedule is only allowed for invited/confirmed interviews.",
      });
    }

    // ✅ critical fix: old DB records may not have reschedule object
    ensureReschedule(appDoc);

    appDoc.reschedule.status = "requested";
    appDoc.reschedule.requestedDate = requested;
    appDoc.reschedule.requestedAt = new Date();
    appDoc.reschedule.recruiterReplyAt = null;
    appDoc.reschedule.recruiterNote = req.body?.note
      ? String(req.body.note).slice(0, 500)
      : null;

    await appDoc.save();
    return res.json({ ok: true, application: appDoc });
  } catch (err) {
    console.error("rescheduleRequest error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Recruiter approves reschedule (also updates chosenDate)
 * PUT /api/applications/:appId/reschedule-approve
 * body: { newDate, note? }
 */
exports.rescheduleApprove = async (req, res) => {
  try {
    const recruiterId = req.user?.id || req.user?._id;
    if (!recruiterId) return res.status(401).json({ message: "Unauthorized" });

    const { appId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ message: "Invalid application id" });
    }

    const newRaw = req.body?.newDate;
    if (!newRaw)
      return res.status(400).json({ message: "newDate is required" });
    const newDate = new Date(newRaw);
    if (Number.isNaN(newDate.getTime())) {
      return res.status(400).json({ message: "newDate is invalid" });
    }

    const appDoc = await Application.findById(appId).populate(
      "job",
      "createdBy title",
    );
    if (!appDoc)
      return res.status(404).json({ message: "Application not found" });

    const isOwner = String(appDoc.job?.createdBy) === String(recruiterId);
    if (!isOwner && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    // ✅ critical fix: old DB records may not have reschedule object
    ensureReschedule(appDoc);

    if (appDoc.reschedule?.status !== "requested") {
      return res
        .status(400)
        .json({ message: "No reschedule request pending." });
    }

    appDoc.chosenDate = newDate;
    appDoc.confirmedAt = new Date();
    appDoc.status = "InterviewConfirmed";

    appDoc.reschedule.status = "approved";
    appDoc.reschedule.recruiterReplyAt = new Date();
    appDoc.reschedule.recruiterNote = req.body?.note
      ? String(req.body.note).slice(0, 500)
      : null;

    await appDoc.save();
    return res.json({ ok: true, application: appDoc });
  } catch (err) {
    console.error("rescheduleApprove error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Recruiter declines reschedule
 * PUT /api/applications/:appId/reschedule-decline
 * body: { note? }
 */
exports.rescheduleDecline = async (req, res) => {
  try {
    const recruiterId = req.user?.id || req.user?._id;
    if (!recruiterId) return res.status(401).json({ message: "Unauthorized" });

    const { appId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ message: "Invalid application id" });
    }

    const appDoc = await Application.findById(appId).populate(
      "job",
      "createdBy title",
    );
    if (!appDoc)
      return res.status(404).json({ message: "Application not found" });

    const isOwner = String(appDoc.job?.createdBy) === String(recruiterId);
    if (!isOwner && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    // ✅ critical fix: old DB records may not have reschedule object
    ensureReschedule(appDoc);

    if (appDoc.reschedule?.status !== "requested") {
      return res
        .status(400)
        .json({ message: "No reschedule request pending." });
    }

    appDoc.reschedule.status = "declined";
    appDoc.reschedule.recruiterReplyAt = new Date();
    appDoc.reschedule.recruiterNote = req.body?.note
      ? String(req.body.note).slice(0, 500)
      : null;

    await appDoc.save();
    return res.json({ ok: true, application: appDoc });
  } catch (err) {
    console.error("rescheduleDecline error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getApplicationResume = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { appId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ message: "Invalid application id" });
    }

    const appDoc = await Application.findById(appId)
      .populate({
        path: "job",
        select: "createdBy title",
      })
      .populate({
        path: "candidate",
        select: "_id name email",
      });

    if (!appDoc) {
      return res.status(404).json({ message: "Application not found" });
    }

    const isCandidate = String(appDoc.candidate?._id) === String(userId);
    const isRecruiterOwner =
      String(appDoc.job?.createdBy?._id || appDoc.job?.createdBy) ===
      String(userId);
    const isAdmin = req.user?.role === "admin";

    if (!isCandidate && !isRecruiterOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const submitted = appDoc.submittedResume;

    if (!submitted?.filePath && !submitted?.fileUrl) {
      return res.status(404).json({
        message:
          "Submitted resume snapshot not found for this application. Please re-apply after saving your resume.",
      });
    }

    const filename =
      submitted.originalName || appDoc.resumeName || "submitted-resume.pdf";

    res.setHeader(
      "Content-Type",
      submitted.mimeType || getMimeTypeFromFilename(filename),
    );

    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    // New cloud snapshot flow
    if (submitted.fileUrl) {
      const cloudResp = await axios.get(submitted.fileUrl, {
        responseType: "stream",
        timeout: 120000,
      });

      return cloudResp.data.pipe(res);
    }

    // Old local snapshot fallback
    const absolutePath = resolveStoredFilePath(submitted.filePath);

    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).json({
        message: "Submitted resume file is missing from server.",
      });
    }

    return fs.createReadStream(absolutePath).pipe(res);
  } catch (err) {
    console.error("getApplicationResume error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.mineForJob = async (req, res) => {
  try {
    const candidateId = req.user?.id || req.user?._id;
    const { jobId } = req.params;

    if (!candidateId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid jobId" });
    }

    const app = await Application.findOne({
      candidate: candidateId,
      job: jobId,
    })
      .populate({
        path: "job",
        select:
          "title companyName createdBy jobLocation location isRemote salaryVisible salaryMin salaryMax",
        populate: { path: "createdBy", select: "companyName name" },
      })
      .lean();

    return res.json(app || null);
  } catch (err) {
    console.error("mineForJob error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMatchingStatus = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { appId } = req.params;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ message: "Invalid application id" });
    }

    const appDoc = await Application.findById(appId)
      .select(
        "candidate job matchingStatus matchingStartedAt matchingCompletedAt matchingError matchingJobId matchScore semanticScore ruleScore similarity matchBreakdown",
      )
      .populate("job", "createdBy");

    if (!appDoc)
      return res.status(404).json({ message: "Application not found" });

    const isCandidate = String(appDoc.candidate) === String(userId);
    const isRecruiterOwner = String(appDoc.job?.createdBy) === String(userId);
    const isAdmin = req.user?.role === "admin";

    if (!isCandidate && !isRecruiterOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json({
      matchingStatus: appDoc.matchingStatus,
      matchingStartedAt: appDoc.matchingStartedAt,
      matchingCompletedAt: appDoc.matchingCompletedAt,
      matchingError: appDoc.matchingError,
      matchingJobId: appDoc.matchingJobId,
      matchScore: appDoc.matchScore,
      semanticScore: appDoc.semanticScore,
      ruleScore: appDoc.ruleScore,
      similarity: appDoc.similarity,
      matchBreakdown: appDoc.matchBreakdown,
    });
  } catch (err) {
    console.error("getMatchingStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/applications/:appId/decision
// PUT /api/applications/:appId/decision
exports.updateDecision = async (req, res) => {
  try {
    const recruiterId = req.user?.id || req.user?._id;

    if (!recruiterId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { appId } = req.params;
    const { decision } = req.body;

    if (!mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ message: "Invalid application id" });
    }

    const allowedDecisions = ["Shortlisted", "Rejected", "Hired"];

    if (!allowedDecisions.includes(decision)) {
      return res.status(400).json({
        message: "Decision must be Shortlisted, Rejected, or Hired.",
      });
    }

    const appDoc = await Application.findById(appId)
      .populate("candidate", "name email")
      .populate({
        path: "job",
        select: "title createdBy",
        populate: {
          path: "createdBy",
          select: "companyName name email",
        },
      });

    if (!appDoc) {
      return res.status(404).json({ message: "Application not found" });
    }

    const isRecruiterOwner =
      String(appDoc.job?.createdBy?._id || appDoc.job?.createdBy) ===
      String(recruiterId);

    if (!isRecruiterOwner && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    appDoc.status = decision;
    await appDoc.save();

    const candidateName = appDoc.candidate?.name || "Candidate";
    const candidateEmail = appDoc.candidate?.email;
    const jobTitle = appDoc.job?.title || "the role";

    const companyName =
      appDoc.job?.createdBy?.companyName ||
      appDoc.job?.createdBy?.name ||
      "the company";

    let subject = "";
    let html = "";

    if (decision === "Shortlisted") {
      subject = `Congratulations! You have been shortlisted for ${jobTitle}`;

      html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color:#111827;">
          <h2 style="color:#16a34a;">Congratulations, ${escapeHtml(candidateName)}!</h2>

          <p>
            We are pleased to inform you that you have been shortlisted after your interview
            for the position of <strong>${escapeHtml(jobTitle)}</strong>
            at <strong>${escapeHtml(companyName)}</strong>.
          </p>

          <p>
            Your profile has been moved to the next stage of the recruitment process.
            Our team will contact you soon with further details.
          </p>

          <p>
            Regards,<br/>
            <strong>${escapeHtml(companyName)}</strong>
          </p>
        </div>
      `;
    }

    if (decision === "Rejected") {
      subject = `Update on your application for ${jobTitle}`;

      html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color:#111827;">
          <h2>Application Update</h2>

          <p>Dear ${escapeHtml(candidateName)},</p>

          <p>
            Thank you for taking the time to complete the interview for the position of
            <strong>${escapeHtml(jobTitle)}</strong>
            at <strong>${escapeHtml(companyName)}</strong>.
          </p>

          <p>
            We are sorry to inform you that your profile has not been shortlisted this time.
            It was a very difficult decision for us, and we truly appreciate the effort,
            time, and interest you showed throughout the process.
          </p>

          <p>
            We encourage you to apply again for future opportunities that match your skills
            and experience.
          </p>

          <p>
            Regards,<br/>
            <strong>${escapeHtml(companyName)}</strong>
          </p>
        </div>
      `;
    }

    if (decision === "Hired") {
      subject = `You have been selected for ${jobTitle}`;

      html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color:#111827;">
          <h2 style="color:#16a34a;">Congratulations, ${escapeHtml(candidateName)}!</h2>

          <p>
            We are pleased to inform you that you have been selected for the role of
            <strong>${escapeHtml(jobTitle)}</strong>
            at <strong>${escapeHtml(companyName)}</strong>.
          </p>

          <p>
            Our team will contact you soon with further details.
          </p>

          <p>
            Regards,<br/>
            <strong>${escapeHtml(companyName)}</strong>
          </p>
        </div>
      `;
    }

    let emailSent = false;

    if (candidateEmail) {
      emailSent = await sendMail(candidateEmail, subject, html);
    }

    return res.json({
      ok: true,
      application: appDoc,
      decision,
      emailSent,
      message: emailSent
        ? "Decision updated and email sent to candidate."
        : "Decision updated, but email could not be sent.",
    });
  } catch (err) {
    console.error("updateDecision error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
