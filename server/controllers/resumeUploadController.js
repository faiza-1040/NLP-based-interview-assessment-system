// server/controllers/resumeUploadController.js

const Resume = require("../models/Resume");
const ProcessedResume = require("../models/ProcessedResume");
const { resumeQueue } = require("../queue/resumeQueue");
const { uploadResumeBuffer ,deleteCloudinaryAsset,} = require("../utils/fileStorage");

function getAuthUserId(req) {
  return req.user?.id || req.user?._id || null;
}

exports.uploadResume = async (req, res) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!req.file.buffer) {
      return res.status(400).json({
        error: "File buffer missing. Upload middleware must use memoryStorage.",
      });
    }

    let resume = await Resume.findOne({ userId: String(userId) });

    if (!resume) {
      resume = new Resume({
        userId: String(userId),
        uploadedFiles: [],
      });
    }

    // ✅ Upload uploaded CV to Cloudinary
    const uploadedCloudFile = await uploadResumeBuffer({
      buffer: req.file.buffer,
      userId: String(userId),
      originalName: req.file.originalname,
      folderType: "uploaded-resumes",
      publicIdPrefix: "uploaded",
    });

    const newFile = {
      originalName: req.file.originalname,

      // New cloud fields
      storageProvider: uploadedCloudFile.storageProvider,
      filePath: uploadedCloudFile.filePath, // null for cloud
      fileUrl: uploadedCloudFile.fileUrl,
      cloudinaryPublicId: uploadedCloudFile.cloudinaryPublicId,
      cloudinaryAssetId: uploadedCloudFile.cloudinaryAssetId,
      resourceType: uploadedCloudFile.resourceType || "raw",

      mimeType: req.file.mimetype,
      size: uploadedCloudFile.bytes || req.file.size,

      isDeleted: false,
      deletedAt: null,
      uploadedAt: new Date(),
    };

    resume.uploadedFiles.push(newFile);
    await resume.save();

    const savedFile = resume.uploadedFiles[resume.uploadedFiles.length - 1];

    let processed = await ProcessedResume.findOne({
      userId: String(userId),
      sourceType: "uploaded_pdf",
      uploadedFileId: savedFile._id,
    });

    if (!processed) {
      processed = await ProcessedResume.create({
        userId: String(userId),
        sourceType: "uploaded_pdf",
        uploadedFileId: savedFile._id,
        fileUrl: savedFile.fileUrl,
        processingStatus: "pending",
        processingStartedAt: new Date(),
      });
    } else {
      processed.processingStatus = "pending";
      processed.processingStartedAt = new Date();
      processed.processingCompletedAt = null;
      processed.processingError = null;
      processed.fileUrl = savedFile.fileUrl;
      await processed.save();
    }

    const queueJob = await resumeQueue.add("uploaded_resume_process", {
      type: "uploaded_resume_process",
      userId: String(userId),
      uploadedFileId: String(savedFile._id),
    });

    processed.processingJobId = String(queueJob.id);
    await processed.save();

    return res.json({
      message: "Resume uploaded successfully. Processing started.",
      file: savedFile,
      processing: {
        status: processed.processingStatus,
        jobId: String(queueJob.id),
      },
    });
  } catch (err) {
    console.error("uploadResume error:", err);

    return res.status(500).json({
      error: "Server Error",
      details: err.message,
    });
  }
};

exports.deleteResume = async (req, res) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { fileId } = req.params;

    const resume = await Resume.findOne({ userId: String(userId) });

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const uploaded = resume.uploadedFiles.id(fileId);

    if (!uploaded) {
      return res.status(404).json({ error: "File not found" });
    }

    if (uploaded.isDeleted === true) {
      return res.json({
        message: "Resume already removed from your CV list.",
      });
    }

    /**
     * Delete only the ORIGINAL uploaded CV file from Cloudinary.
     *
     * Do NOT delete:
     * - ProcessedResume
     * - Application.submittedResume
     * - Application snapshot Cloudinary file
     */
    const uploadedPublicId = uploaded.cloudinaryPublicId;
    const uploadedResourceType = uploaded.resourceType || "raw";

    if (uploadedPublicId) {
      try {
        const deleteResult = await deleteCloudinaryAsset(
          uploadedPublicId,
          uploadedResourceType
        );

        console.log("Cloudinary uploaded CV delete result:", deleteResult);
      } catch (cloudErr) {
        console.error(
          "Failed to delete Cloudinary uploaded CV:",
          cloudErr.message
        );

        // Continue with soft delete even if Cloudinary delete fails.
        // This prevents frontend delete from failing because of cleanup issue.
      }
    }

    /**
     * Soft delete in MongoDB.
     * Keep the record for history/reference.
     */
    uploaded.isDeleted = true;
    uploaded.deletedAt = new Date();

    await resume.save();

    return res.json({
      message: "Uploaded resume removed successfully.",
    });
  } catch (err) {
    console.error("deleteUploadedResume error:", err);

    return res.status(500).json({
      error: "Server Error",
      details: err.message,
    });
  }
};