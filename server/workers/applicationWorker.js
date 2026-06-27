//server/workers/applicationWorker.js
require("dotenv").config();
const mongoose = require("mongoose");
const { Worker } = require("bullmq");
const { connection } = require("../queue/redis");
const Application = require("../models/Application");
const Job = require("../models/Job");
const ProcessedResume = require("../models/ProcessedResume");
const { computeJobResumeMatch } = require("../utils/nlpMatchClient");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Application worker DB connected"))
  .catch((err) => {
    console.error("❌ Application worker DB connection error:", err);
    process.exit(1);
  });

const worker = new Worker(
  "application-matching",
  async (job) => {
    const { applicationId, candidateId, jobId, resumeSource, resumeFileId } = job.data;

    const appDoc = await Application.findById(applicationId);
    if (!appDoc) throw new Error("Application not found");

    appDoc.matchingStatus = "pending";
    appDoc.matchingStartedAt = new Date();
    appDoc.matchingError = null;
    appDoc.matchingJobId = String(job.id);
    await appDoc.save();

    const jobDoc = await Job.findById(jobId).select(
      'isClosed applicationDeadline title createdBy customQuestions screeningQuestions description skillsRequired rateSkills experience qualification location careerLevel'
    );

    if (!jobDoc) throw new Error("Job not found");

    let processedResume = null;

    if (resumeSource === "upload" && resumeFileId) {
      processedResume = await ProcessedResume.findOne({
        userId: String(candidateId),
        sourceType: "uploaded_pdf",
        uploadedFileId: resumeFileId,
        processingStatus: "completed",
      }).lean();
    } else {
      processedResume = await ProcessedResume.findOne({
        userId: String(candidateId),
        sourceType: "builder_form",
        processingStatus: "completed",
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    if (!processedResume) {
      appDoc.matchingStatus = "failed";
      appDoc.matchingCompletedAt = new Date();
      appDoc.matchingError = "Processed resume not found or not completed";
      await appDoc.save();
      return;
    }

    try {
      const matchResult = await computeJobResumeMatch(
        jobDoc.toObject ? jobDoc.toObject() : jobDoc,
        processedResume
      );

      appDoc.matchScore = matchResult.final_score ?? null;
      appDoc.semanticScore = matchResult.semantic_score ?? null;
      appDoc.ruleScore = matchResult.rule_score ?? null;
      appDoc.similarity = matchResult.similarity ?? null;
      appDoc.matchBreakdown = matchResult.breakdown ?? null;

      appDoc.matchingStatus = "completed";
      appDoc.matchingCompletedAt = new Date();
      appDoc.matchingError = null;

      await appDoc.save();
    } catch (err) {
      appDoc.matchingStatus = "failed";
      appDoc.matchingCompletedAt = new Date();
      appDoc.matchingError =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err.message ||
        "Matching failed";

      await appDoc.save();
      throw err;
    }
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`✅ Application worker completed job ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Application worker failed job ${job?.id}:`, err.message);
});