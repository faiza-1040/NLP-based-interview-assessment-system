
// //server/utils/processedResumeService.js
const axios = require("axios");
const ProcessedResume = require("../models/ProcessedResume");

const NLP_SERVICE_BASE =
  process.env.NLP_SERVICE_BASE || "http://127.0.0.1:8000";

function normalizeStructuredResume(nlpData = {}) {
  const structured = nlpData.structured || {};

  const rawText =
    structured.raw_text ||
    nlpData.raw_text ||
    nlpData.rawText ||
    nlpData.scoring_text ||
    nlpData.scoringText ||
    nlpData.markdown ||
    "";

  return {
    ...structured,

    raw_text: rawText,

    skills: structured.skills || nlpData.skills || [],
    experience: structured.experience || nlpData.experience || [],
    projects: structured.projects || nlpData.projects || [],
    education: structured.education || nlpData.education || [],
    certifications: structured.certifications || nlpData.certifications || [],
    languages: structured.languages || nlpData.languages || [],
  };
}

async function processUploadedResume(userId, fileDoc) {
  const fileUrl = fileDoc?.fileUrl || fileDoc?.filePath;

  if (!fileDoc || !fileUrl) {
    throw new Error("Missing uploaded resume file URL/path");
  }

  const existing = await ProcessedResume.findOne({
    userId,
    sourceType: "uploaded_pdf",
    uploadedFileId: fileDoc._id,
  });

  const targetDoc =
    existing ||
    new ProcessedResume({
      userId,
      sourceType: "uploaded_pdf",
      resumeDocId: null,
      uploadedFileId: fileDoc._id,
      fileUrl,
    });

  targetDoc.processingStatus = "pending";
  targetDoc.processingStartedAt = new Date();
  targetDoc.processingCompletedAt = null;
  targetDoc.processingError = null;
  targetDoc.fileUrl = fileUrl;

  await targetDoc.save();

  try {
    const nlpResp = await axios.post(
      `${NLP_SERVICE_BASE}/process-resume`,
      {
        source_type: "uploaded_pdf",
        file_url: fileUrl,
        user_id: userId,
      },
      {
        timeout: 240000,
      },
    );

    const { scoring_text, structured, markdown } = nlpResp.data;

    const nlpData = nlpResp.data || {};
    const normalizedStructured = normalizeStructuredResume(nlpData);

    console.log("===== NLP PROCESS RESUME RESPONSE DEBUG =====");
    console.log("NLP KEYS:", Object.keys(nlpData || {}));
    console.log("STRUCTURED KEYS:", Object.keys(normalizedStructured || {}));
    console.log("SKILLS:", normalizedStructured.skills);
    console.log("EXPERIENCE COUNT:", normalizedStructured.experience?.length);
    console.log("PROJECTS COUNT:", normalizedStructured.projects?.length);
    console.log("EDUCATION COUNT:", normalizedStructured.education?.length);
    console.log("============================================");

    targetDoc.scoringText =
      nlpData.scoring_text ||
      nlpData.scoringText ||
      normalizedStructured.raw_text ||
      "";

    targetDoc.structured = normalizedStructured;

    targetDoc.markdown = nlpData.markdown || targetDoc.scoringText || "";

    targetDoc.rawText =
      normalizedStructured.raw_text || targetDoc.scoringText || "";
    targetDoc.processingStatus = "completed";
    targetDoc.processingCompletedAt = new Date();
    targetDoc.processingError = null;

    await targetDoc.save();
    return targetDoc;
  } catch (err) {
    targetDoc.processingStatus = "failed";
    targetDoc.processingCompletedAt = new Date();
    targetDoc.processingError =
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err.message ||
      "Resume processing failed";

    await targetDoc.save();
    throw err;
  }
}

async function processPlatformResume(resumeDoc) {
  if (!resumeDoc) {
    throw new Error("Resume document is required");
  }

  const userId = String(resumeDoc.userId);

  const existing = await ProcessedResume.findOne({
    userId,
    sourceType: "builder_form",
  });

  const targetDoc =
    existing ||
    new ProcessedResume({
      userId,
      sourceType: "builder_form",
      resumeDocId: resumeDoc._id,
    });

  targetDoc.resumeDocId = resumeDoc._id;
  targetDoc.processingStatus = "pending";
  targetDoc.processingStartedAt = new Date();
  targetDoc.processingCompletedAt = null;
  targetDoc.processingError = null;

  await targetDoc.save();

  try {
    const nlpResp = await axios.post(
      `${NLP_SERVICE_BASE}/process-resume`,
      {
        source_type: "builder_form",
        user_id: userId,
        resume_json: resumeDoc.toObject ? resumeDoc.toObject() : resumeDoc,
      },
      {
        timeout: 240000,
      },
    );

    const { scoring_text, structured, markdown } = nlpResp.data;

    const nlpData = nlpResp.data || {};
    const normalizedStructured = normalizeStructuredResume(nlpData);

    console.log("===== NLP PROCESS RESUME RESPONSE DEBUG =====");
    console.log("NLP KEYS:", Object.keys(nlpData || {}));
    console.log("STRUCTURED KEYS:", Object.keys(normalizedStructured || {}));
    console.log("SKILLS:", normalizedStructured.skills);
    console.log("EXPERIENCE COUNT:", normalizedStructured.experience?.length);
    console.log("PROJECTS COUNT:", normalizedStructured.projects?.length);
    console.log("EDUCATION COUNT:", normalizedStructured.education?.length);
    console.log("============================================");

    targetDoc.scoringText =
      nlpData.scoring_text ||
      nlpData.scoringText ||
      normalizedStructured.raw_text ||
      "";

    targetDoc.structured = normalizedStructured;

    targetDoc.markdown = nlpData.markdown || targetDoc.scoringText || "";

    targetDoc.rawText =
      normalizedStructured.raw_text || targetDoc.scoringText || "";
    targetDoc.processingStatus = "completed";
    targetDoc.processingCompletedAt = new Date();
    targetDoc.processingError = null;

    await targetDoc.save();
    return targetDoc;
  } catch (err) {
    targetDoc.processingStatus = "failed";
    targetDoc.processingCompletedAt = new Date();
    targetDoc.processingError =
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err.message ||
      "Platform resume processing failed";

    await targetDoc.save();
    throw err;
  }
}

module.exports = { processUploadedResume, processPlatformResume };