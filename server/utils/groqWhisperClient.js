// server/utils/groqWhisperClient.js
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

function getSafeAudioFilename(filePath, mimeType = "audio/webm") {
  const extFromPath = path.extname(filePath || "").replace(".", "");

  if (extFromPath) {
    return `audio.${extFromPath}`;
  }

  if (mimeType.includes("ogg")) return "audio.ogg";
  if (mimeType.includes("wav")) return "audio.wav";
  if (mimeType.includes("mp4")) return "audio.mp4";
  if (mimeType.includes("mpeg")) return "audio.mp3";

  return "audio.webm";
}

async function transcribeAudio(filePath, mimeType = "audio/webm") {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set in server .env");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error("Audio file not found on server.");
  }

  const stat = fs.statSync(filePath);

  if (!stat.size || stat.size <= 0) {
    throw new Error("Audio file is empty.");
  }

  const cleanMimeType = String(mimeType || "audio/webm").split(";")[0];
  const filename = getSafeAudioFilename(filePath, cleanMimeType);

  const form = new FormData();

  form.append("file", fs.createReadStream(filePath), {
    filename,
    contentType: cleanMimeType,
  });

  form.append("model", "whisper-large-v3");
  form.append("response_format", "json");
  form.append("language", "en");

  const { data } = await axios.post(GROQ_WHISPER_URL, form, {
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      ...form.getHeaders(),
    },
    timeout: 120000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return {
    text: String(data?.text || "").trim(),
    duration_sec:
      typeof data?.duration === "number" ? data.duration : null,
  };
}

module.exports = { transcribeAudio };