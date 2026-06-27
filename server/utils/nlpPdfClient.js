// server/utils/nlpPdfClient.js
const axios = require("axios");

const NLP_SERVICE_BASE = process.env.NLP_SERVICE_BASE || "http://127.0.0.1:8000";

async function generateResumePdf({ userId, templateId, viewModel, themeColor }) {
  const resp = await axios.post(
    `${NLP_SERVICE_BASE}/resume/generate-pdf`,
    { userId, templateId, viewModel, themeColor },
    { responseType: "arraybuffer", timeout: 120000 }
  );

  return Buffer.from(resp.data);
}

module.exports = { generateResumePdf };
