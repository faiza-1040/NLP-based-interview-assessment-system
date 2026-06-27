

// // client/src/utils/resumeApi.js
import { api } from "./api";

export const getApplicationResumeBlob = (appId) =>
  api.get(`/applications/${appId}/resume`, {
    responseType: "blob",
  });

// Save self resume
export const saveResumeToDB = (data) => api.post("/resume/me", data);

// Fetch self resume
export const fetchResumeFromDB = () => api.get("/resume/me");

// Get self resume PDF
export const getResumePdf = (templateId = "classic") =>
  api.get(`/resume/me/pdf?templateId=${encodeURIComponent(templateId)}`, {
    responseType: "blob",
  });

// Upload self resume file
export const uploadResumeFile = (formData) =>
  api.post("/resume/me/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

// Delete uploaded self resume file
export const deleteUploadedFile = (fileId) =>
  api.delete(`/resume/me/upload/${fileId}`);

// Delete self default resume
export const deleteDefaultResume = () => api.delete("/resume/me");

// Optional AI render route
export const renderResume = (payload) => api.post("/resume/render", payload);
