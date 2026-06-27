// server/utils/cloudinary.js
const cloudinary = require("cloudinary").v2;

const requiredEnv = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

function hasCloudinaryConfig() {
  return requiredEnv.every((key) => Boolean(process.env[key]));
}

if (hasCloudinaryConfig()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  console.warn(
    "⚠️ Cloudinary env variables are missing. Cloud uploads will fail until configured.",
  );
}

module.exports = {
  cloudinary,
  hasCloudinaryConfig,
};