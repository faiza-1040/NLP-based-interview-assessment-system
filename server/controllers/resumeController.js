
// server/controllers/resumeController.js
const Resume = require("../models/Resume");
const ProcessedResume = require("../models/ProcessedResume");
const { generateResumePdf } = require("../utils/nlpPdfClient");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { resumeQueue } = require("../queue/resumeQueue");
const { uploadResumeBase64Pdf, deleteCloudinaryAsset, } = require("../utils/fileStorage");

function getAuthUserId(req) {
  return req.user?.id || req.user?._id || null;
}

function ensureResumesDir() {
  const resumesDir = path.join(__dirname, "..", "uploads", "resumes");
  if (!fs.existsSync(resumesDir)) {
    fs.mkdirSync(resumesDir, { recursive: true });
  }
  return resumesDir;
}

async function saveBase64Pdf({ userId, templateId, pdfBase64, fileName }) {
  if (!pdfBase64) return null;

  const uploaded = await uploadResumeBase64Pdf({
    pdfBase64,
    userId: String(userId),
    templateId: templateId || "modern",
    originalName: fileName || `resume_${userId}_${templateId || "modern"}.pdf`,
  });

  return {
    storageProvider: uploaded.storageProvider,
    filePath: uploaded.filePath,
    fileUrl: uploaded.fileUrl,
    originalName: uploaded.originalName,
    cloudinaryPublicId: uploaded.cloudinaryPublicId,
    cloudinaryAssetId: uploaded.cloudinaryAssetId,
    resourceType: uploaded.resourceType || "raw",
    mimeType: uploaded.mimeType || "application/pdf",
    size: uploaded.size || 0,
  };
}

exports.submitResume = async (req, res) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data = { ...req.body, userId };

    const templateId = data.templateId || "modern";
    const viewModel = data.viewModel || null;
    const pdfBase64 = data.pdfBase64 || null;
    const pdfFileName =
      data.pdfFileName || `resume_${userId}_${templateId}.pdf`;

    delete data.pdfBase64;
    delete data.pdfFileName;

    // const savedClientPdf = writeBase64Pdf({
    //   userId,
    //   templateId,
    //   pdfBase64,
    //   fileName: pdfFileName,
    // });

    const savedClientPdf = await saveBase64Pdf({
      userId,
      templateId,
      pdfBase64,
      fileName: pdfFileName,
    });

    if (!savedClientPdf) {
      return res.status(400).json({
        error:
          "Frontend PDF was not received. Please save again after the preview is ready.",
      });
    }


    const builderPdf = {
      storageProvider: savedClientPdf.storageProvider || "cloudinary",
      filePath: savedClientPdf.filePath || null,
      fileUrl: savedClientPdf.fileUrl || null,
      originalName: savedClientPdf.originalName,

      cloudinaryPublicId: savedClientPdf.cloudinaryPublicId || null,
      cloudinaryAssetId: savedClientPdf.cloudinaryAssetId || null,
      resourceType: savedClientPdf.resourceType || "raw",

      mimeType: savedClientPdf.mimeType || "application/pdf",
      size: savedClientPdf.size || 0,

      templateId,
      themeColor: data.themeColor || "#2563eb",
      fontFamily: data.fontFamily || "Inter",
      spacing: data.spacing || "normal",
      generatedAt: new Date(),
    };

    const resume = await Resume.findOneAndUpdate(
      { userId: String(userId) },
      {
        $set: {
          ...data,
          userId: String(userId),
          templateId,
          viewModel,
          builderPdf,
          updatedAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    let processed = await ProcessedResume.findOne({
      userId: String(userId),
      sourceType: "builder_form",
    });

    if (!processed) {
      processed = await ProcessedResume.create({
        userId: String(userId),
        sourceType: "builder_form",
        resumeDocId: resume._id,
        processingStatus: "pending",
        processingStartedAt: new Date(),
      });
    } else {
      processed.resumeDocId = resume._id;
      processed.processingStatus = "pending";
      processed.processingStartedAt = new Date();
      processed.processingCompletedAt = null;
      processed.processingError = null;
      await processed.save();
    }

    const queueJob = await resumeQueue.add("platform_resume_process", {
      type: "platform_resume_process",
      userId: String(userId),
      resumeId: String(resume._id),
    });

    processed.processingJobId = String(queueJob.id);
    await processed.save();

    return res.json({
      message: "Resume saved successfully! Processing started.",
      pdfUrl: `/api/resume/me/pdf?templateId=${encodeURIComponent(templateId)}`,
      processing: {
        status: processed.processingStatus,
        jobId: String(queueJob.id),
      },
    });
  } catch (err) {
    console.error("❌ Error in submitResume:", err);
    return res.status(500).json({
      error: "Server Error",
      details: err.message,
    });
  }
};

exports.getResume = async (req, res) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const resume = await Resume.findOne({ userId });

    if (!resume) {
      return res.status(404).json({ message: "No resume found" });
    }

    return res.json(resume);
  } catch (err) {
    console.error("getResume error:", err);
    return res.status(500).json({ error: "Server Error" });
  }
};

exports.getPDF = async (req, res) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const resume = await Resume.findOne({ userId });

    if (!resume) {
      return res.status(404).json({ message: "No resume found" });
    }

    const filename =
      resume.builderPdf?.originalName ||
      `resume_${userId}_${resume.templateId || "modern"}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    // ✅ New cloud builder PDF flow
    if (resume.builderPdf?.fileUrl) {
      const cloudResp = await axios.get(resume.builderPdf.fileUrl, {
        responseType: "stream",
        timeout: 120000,
      });

      return cloudResp.data.pipe(res);
    }

    // ✅ Old local fallback flow
    let pdfPath = null;

    if (resume.builderPdf?.filePath) {
      pdfPath = path.isAbsolute(resume.builderPdf.filePath)
        ? resume.builderPdf.filePath
        : path.join(__dirname, "..", resume.builderPdf.filePath);
    } else {
      const templateId = req.query.templateId || resume.templateId || "modern";
      pdfPath = path.join(
        __dirname,
        "..",
        "uploads",
        "resumes",
        `resume_${userId}_${templateId}.pdf`,
      );
    }

    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({
        message:
          "Saved resume PDF not found. Please open Resume Builder and save again.",
      });
    }

    return fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    console.error("getPDF error:", err);
    return res.status(500).json({ error: "Server Error" });
  }
};

exports.deleteResume = async (req, res) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Find resume document first.
    // Do NOT delete full Resume document because uploadedFiles[] are stored here too.
    const resume = await Resume.findOne({ userId });

    if (!resume) {
      return res.status(404).json({ message: "No resume found" });
    }

    // Delete only builder PDF from Cloudinary
    const builderPublicId = resume.builderPdf?.cloudinaryPublicId;
    const builderResourceType = resume.builderPdf?.resourceType || "raw";

    if (builderPublicId) {
      try {
        const deleteResult = await deleteCloudinaryAsset(
          builderPublicId,
          builderResourceType
        );

        console.log("Cloudinary builder PDF delete result:", deleteResult);
      } catch (cloudErr) {
        console.error(
          "Failed to delete Cloudinary builder PDF:",
          cloudErr.message
        );
      }
    }

    // Old local builder PDF fallback cleanup
    const resumesDir = ensureResumesDir();

    if (fs.existsSync(resumesDir)) {
      const files = fs.readdirSync(resumesDir);

      for (const f of files) {
        if (f.startsWith(`resume_${userId}_`) && f.endsWith(".pdf")) {
          try {
            fs.unlinkSync(path.join(resumesDir, f));
          } catch {}
        }
      }
    }

    // Delete only processed builder resume data
    await ProcessedResume.deleteOne({
      userId: String(userId),
      sourceType: "builder_form",
    });

    // Clear builder/default resume fields only.
    // Keep uploadedFiles[] untouched.
    resume.personalDetails = {
      fullName: "",
      jobTitle: "",
      email: "",
      phone: "",
      address: "",
      photoUrl: "",
    };

    resume.summary = "";
    resume.skills = [];
    resume.skillItems = [];
    resume.education = [];
    resume.experience = [];
    resume.projects = [];
    resume.certifications = [];
    resume.languages = [];
    resume.customSections = [];

    resume.templateId = "modern";
    resume.themeColor = "#2563eb";
    resume.fontFamily = "Inter";
    resume.spacing = "normal";
    resume.sectionOrder = [
      "summary",
      "education",
      "experience",
      "skills",
      "projects",
      "certifications",
      "languages",
      "customSections",
    ];

    resume.viewModel = undefined;
    resume.builderPdf = undefined;

    await resume.save();

    return res.json({
      message: "Builder resume deleted successfully",
    });
  } catch (err) {
    console.error("deleteResume error:", err);
    return res.status(500).json({ error: "Server Error" });
  }
};

exports.getBuilderProcessingStatus = async (req, res) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const processed = await ProcessedResume.findOne({
      userId: String(userId),
      sourceType: "builder_form",
    }).lean();

    if (!processed) {
      return res.json({ status: "not_started" });
    }

    return res.json({
      status: processed.processingStatus,
      startedAt: processed.processingStartedAt,
      completedAt: processed.processingCompletedAt,
      error: processed.processingError,
      jobId: processed.processingJobId,
    });
  } catch (err) {
    console.error("getBuilderProcessingStatus error:", err);
    return res.status(500).json({ error: "Server Error" });
  }
};

exports.getUploadedProcessingStatus = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { fileId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const processed = await ProcessedResume.findOne({
      userId: String(userId),
      sourceType: "uploaded_pdf",
      uploadedFileId: fileId,
    }).lean();

    if (!processed) {
      return res.json({ status: "not_started" });
    }

    return res.json({
      status: processed.processingStatus,
      startedAt: processed.processingStartedAt,
      completedAt: processed.processingCompletedAt,
      error: processed.processingError,
      jobId: processed.processingJobId,
    });
  } catch (err) {
    console.error("getUploadedProcessingStatus error:", err);
    return res.status(500).json({ error: "Server Error" });
  }
};
