// server/utils/nlpMockInterviewClient.js
const axios = require("axios");

const NLP_BASE = process.env.NLP_SERVICE_URL || "http://127.0.0.1:8000";

async function generateMockQuestions(payload) {
  const { data } = await axios.post(
    `${NLP_BASE}/mock-interview/generate-questions`,
    payload,
    { timeout: 120000 }
  );
  return data;
}

async function evaluateMockAnswer(payload) {
  const { data } = await axios.post(
    `${NLP_BASE}/mock-interview/evaluate-answer`,
    payload,
    { timeout: 120000 }
  );
  return data;
}

module.exports = {
  generateMockQuestions,
  evaluateMockAnswer,
};
