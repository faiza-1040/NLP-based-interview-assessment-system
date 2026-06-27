// server/controllers/resumeRenderController.js
const axios = require("axios");

const NLP_SERVICE_BASE =
  process.env.NLP_SERVICE_BASE || "http://127.0.0.1:8000";

function getAuthUserId(req) {
  return req.user?.id || null;
}

exports.renderResume = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { templateId, resumeJson, jobTitle, themeColor } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!templateId || !resumeJson) {
      return res
        .status(400)
        .json({ error: "templateId and resumeJson are required" });
    }

    const resp = await axios.post(
      `${NLP_SERVICE_BASE}/resume/render`,
      { userId, templateId, resumeJson, jobTitle, themeColor },
      { timeout: 240000 }
    );

    return res.json(resp.data);
  } catch (err) {
    console.error(
      "renderResume proxy error:",
      err?.response?.data || err.message || err
    );
    return res.status(500).json({ error: "Failed to render resume" });
  }
};