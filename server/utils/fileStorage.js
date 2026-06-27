// server/utils/fileStorage.js
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const streamifier = require("streamifier");
const { cloudinary, hasCloudinaryConfig } = require("./cloudinary");

function safeFileBaseName(originalName = "file") {
  const parsed = path.parse(originalName);
  const cleaned = parsed.name
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return cleaned || "file";
}

function getExtension(originalName = "") {
  return path.extname(originalName || "").toLowerCase();
}

function getServerPublicBaseUrl() {
  const fromEnv =
    process.env.SERVER_PUBLIC_URL ||
    process.env.PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.SERVER_URL;

  if (fromEnv) {
    return String(fromEnv).replace(/\/+$/, "");
  }

  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

async function ensureDirectory(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function saveBufferToLocalUploads({
  buffer,
  originalName,
  publicIdPrefix = "resume",
}) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Invalid file buffer for local upload.");
  }

  const uploadsDir = path.join(__dirname, "..", "uploads", "resumes");
  await ensureDirectory(uploadsDir);

  const ext = getExtension(originalName || "") || ".pdf";
  const baseName = safeFileBaseName(originalName || "resume");

  const filename = [publicIdPrefix, Date.now(), baseName]
    .filter(Boolean)
    .join("-") + ext;

  const absolutePath = path.join(uploadsDir, filename);
  await fsp.writeFile(absolutePath, buffer);

  const relativeUrl = `/uploads/resumes/${filename}`;
  const fileUrl = `${getServerPublicBaseUrl()}${relativeUrl}`;

  return {
    storageProvider: "local",
    filePath: relativeUrl,
    fileUrl,
    originalName,
    cloudinaryPublicId: null,
    cloudinaryAssetId: null,
    resourceType: "raw",
    bytes: buffer.length,
    format: ext.replace(".", "") || null,
  };
}

function uploadBufferToCloudinary(buffer, options = {}) {
  if (!hasCloudinaryConfig()) {
    throw new Error("Cloudinary is not configured. Check server/.env values.");
  }

  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Invalid file buffer for Cloudinary upload.");
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        type: "upload",
        access_mode: "public",
        use_filename: false,
        unique_filename: false,
        overwrite: true,
        timeout: 180000,
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      },
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

async function uploadResumeBuffer({
  buffer,
  userId,
  originalName,
  folderType = "uploaded-resumes",
  publicIdPrefix = "",
}) {
  const baseName = safeFileBaseName(originalName || "resume");
  const ext = getExtension(originalName || ".pdf");

  const publicId = [publicIdPrefix, Date.now(), baseName]
    .filter(Boolean)
    .join("-");

  if (hasCloudinaryConfig()) {
    try {
      const result = await uploadBufferToCloudinary(buffer, {
        folder: `nlpias/${folderType}/${userId}`,
        public_id: publicId,
        resource_type: "raw",
        format: ext ? ext.replace(".", "") : undefined,
        timeout: 180000,
      });

      return {
        storageProvider: "cloudinary",
        filePath: null,
        fileUrl: result.secure_url,
        originalName,
        cloudinaryPublicId: result.public_id,
        cloudinaryAssetId: result.asset_id,
        resourceType: result.resource_type || "raw",
        bytes: result.bytes || 0,
        format: result.format || null,
      };
    } catch (err) {
      console.warn(
        "⚠️ Cloudinary resume upload failed. Falling back to local storage:",
        err?.message || err,
      );
    }
  } else {
    console.warn("⚠️ Cloudinary not configured. Using local resume storage.");
  }

  return await saveBufferToLocalUploads({
    buffer,
    originalName,
    publicIdPrefix: publicIdPrefix || "uploaded",
  });
}

async function uploadResumeBase64Pdf({
  pdfBase64,
  userId,
  templateId = "modern",
  originalName,
}) {
  if (!pdfBase64) {
    throw new Error("Missing PDF base64 content.");
  }

  const cleanBase64 = String(pdfBase64).includes(",")
    ? String(pdfBase64).split(",").pop()
    : String(pdfBase64);

  const buffer = Buffer.from(cleanBase64, "base64");

  if (!buffer.length) {
    throw new Error("Invalid PDF base64 content.");
  }

  if (hasCloudinaryConfig()) {
    try {
      const result = await uploadBufferToCloudinary(buffer, {
        folder: `nlpias/builder-resumes/${userId}`,
        public_id: `resume_${userId}_${templateId}`,
        resource_type: "raw",
        format: "pdf",
        overwrite: true,
        timeout: 180000,
      });

      return {
        storageProvider: "cloudinary",
        filePath: null,
        fileUrl: result.secure_url,
        originalName: originalName || `resume_${userId}_${templateId}.pdf`,
        cloudinaryPublicId: result.public_id,
        cloudinaryAssetId: result.asset_id,
        resourceType: result.resource_type || "raw",
        mimeType: "application/pdf",
        size: result.bytes || buffer.length,
      };
    } catch (err) {
      console.warn(
        "⚠️ Cloudinary builder PDF upload failed. Falling back to local storage:",
        err?.message || err,
      );
    }
  } else {
    console.warn("⚠️ Cloudinary not configured. Using local builder PDF storage.");
  }

  const local = await saveBufferToLocalUploads({
    buffer,
    originalName: originalName || `resume_${userId}_${templateId}.pdf`,
    publicIdPrefix: `builder-${userId}-${templateId}`,
  });

  return {
    storageProvider: local.storageProvider,
    filePath: local.filePath,
    fileUrl: local.fileUrl,
    originalName: local.originalName,
    cloudinaryPublicId: null,
    cloudinaryAssetId: null,
    resourceType: "raw",
    mimeType: "application/pdf",
    size: local.bytes || buffer.length,
  };
}

async function deleteCloudinaryAsset(publicId, resourceType = "raw") {
  if (!publicId) {
    return { skipped: true, reason: "Missing Cloudinary public ID" };
  }

  if (!hasCloudinaryConfig()) {
    throw new Error("Cloudinary is not configured. Check server/.env values.");
  }

  return await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType || "raw",
    invalidate: true,
  });
}

function safeCloudinaryPublicId(value = "file") {
  return String(value)
    .replace(/\.[^/.]+$/, "")
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function uploadImageBuffer({
  buffer,
  folder,
  originalName,
  publicIdPrefix = "image",
}) {
  const baseName = safeCloudinaryPublicId(originalName || "image");

  const result = await uploadBufferToCloudinary(buffer, {
    folder,
    public_id: `${publicIdPrefix}-${Date.now()}-${baseName}`,
    resource_type: "image",
    overwrite: true,
    timeout: 180000,
  });

  return {
    storageProvider: "cloudinary",
    fileUrl: result.secure_url,
    cloudinaryPublicId: result.public_id,
    cloudinaryAssetId: result.asset_id,
    resourceType: result.resource_type || "image",
    size: result.bytes || buffer.length,
    format: result.format || null,
  };
}

async function uploadRawFileBuffer({
  buffer,
  folder,
  originalName,
  publicIdPrefix = "doc",
}) {
  const ext = path.extname(originalName || "").toLowerCase();
  const baseName = safeCloudinaryPublicId(originalName || "document");
  const format = ext ? ext.replace(".", "") : undefined;

  const result = await uploadBufferToCloudinary(buffer, {
    folder,
    public_id: `${publicIdPrefix}-${Date.now()}-${baseName}`,
    resource_type: "raw",
    format,
    overwrite: true,
    timeout: 180000,
  });

  return {
    storageProvider: "cloudinary",
    fileUrl: result.secure_url,
    cloudinaryPublicId: result.public_id,
    cloudinaryAssetId: result.asset_id,
    resourceType: result.resource_type || "raw",
    size: result.bytes || buffer.length,
    format: result.format || null,
  };
}

module.exports = {
  uploadBufferToCloudinary,
  uploadResumeBuffer,
  uploadResumeBase64Pdf,
  uploadImageBuffer,
  uploadRawFileBuffer,
  deleteCloudinaryAsset,
};