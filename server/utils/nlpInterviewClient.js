// server/utils/nlpInterviewClient.js
const axios = require("axios");

const NLP_BASE = process.env.NLP_SERVICE_URL || "http://127.0.0.1:8000";

async function generateQuestions(payload) {
  const { data } = await axios.post(
    `${NLP_BASE}/interview/generate-questions`,
    payload,
    { timeout: 120000 }
  );

  return data;
}

async function evaluateAnswer(payload) {
  const { data } = await axios.post(
    `${NLP_BASE}/interview/evaluate-answer`,
    payload,
    { timeout: 120000 }
  );

  return data;
}

module.exports = {
  generateQuestions,
  evaluateAnswer,
};