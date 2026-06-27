// client/src/utils/mockInterviewApi.js
import { api } from "./api";

export const mockInterviewStart = (payload) => api.post("/mock/start", payload);

export const mockInterviewGetSession = (sessionId) =>
  api.get(`/mock/session/${sessionId}`);

export const mockInterviewSubmitAnswer = (payload) =>
  api.post("/mock/answer", payload);

export const mockInterviewFinish = (sessionId) =>
  api.post("/mock/finish", { sessionId });

export const mockInterviewAnalytics = () =>
  api.get("/mock/analytics");

export const mockInterviewDetailedFeedback = (sessionId) =>
  api.get(`/mock/session/${sessionId}`);
