// client/src/utils/applicationApi.js
import api from "./api"; // your configured axios instance (baseURL + auth)

export async function applyToJob({
  jobId,
  resumeSource,     // "default" | "upload"
  resumeFileId,     // ObjectId string or null
  resumeName,       // snapshot label for recruiter
  resumePath,       // URL or API path to PDF
  screeningAnswers, // array of strings
}) {
  const payload = {
    jobId,
    resumeSource,
    resumeFileId: resumeFileId || null,
    resumeName: resumeName || null,
    resumePath: resumePath || null,
    screeningAnswers: screeningAnswers || [],
  };

  const res = await api.post("/applications", payload);
  return res.data;
}
