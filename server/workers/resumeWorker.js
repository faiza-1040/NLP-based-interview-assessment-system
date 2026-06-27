
//server/workers/resumeWorker.js
require("dotenv").config();

const mongoose = require("mongoose");

const { Worker } = require("bullmq");

const { connection } = require("../queue/redis");

const Resume = require("../models/Resume");

const ProcessedResume = require("../models/ProcessedResume");

const {

  processUploadedResume,

  processPlatformResume,

} = require("../utils/processedResumeService");



mongoose

  .connect(process.env.MONGO_URI)

  .then(() => console.log("✅ Resume worker DB connected"))

  .catch((err) => {

    console.error("❌ Resume worker DB connection error:", err);

    process.exit(1);

  });



const worker = new Worker(

  "resume-processing",

  async (job) => {

    const { type, userId, resumeId, uploadedFileId } = job.data;



    if (type === "uploaded_resume_process") {

      const resumeDoc = await Resume.findOne({ userId });

      if (!resumeDoc) throw new Error("Resume document not found");



      const fileDoc = resumeDoc.uploadedFiles.find(

        (f) => String(f._id) === String(uploadedFileId)

      );



      if (!fileDoc) throw new Error("Uploaded file not found");



      const processed = await ProcessedResume.findOne({

        userId,

        sourceType: "uploaded_pdf",

        uploadedFileId,

      });



      if (processed) {

        processed.processingJobId = String(job.id);

        await processed.save();

      }



      return await processUploadedResume(userId, fileDoc);

    }



    if (type === "platform_resume_process") {

      const resumeDoc = await Resume.findById(resumeId);

      if (!resumeDoc) throw new Error("Builder resume not found");



      const processed = await ProcessedResume.findOne({

        userId: String(resumeDoc.userId),

        sourceType: "builder_form",

      });



      if (processed) {

        processed.processingJobId = String(job.id);

        await processed.save();

      }



      return await processPlatformResume(resumeDoc);

    }



    throw new Error(`Unknown resume job type: ${type}`);

  },

  { connection }

);



worker.on("completed", (job) => {

  console.log(`✅ Resume worker completed job ${job.id}`);

});



worker.on("failed", (job, err) => {

  console.error(`❌ Resume worker failed job ${job?.id}:`, err.message);

}); 