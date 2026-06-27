
// server/utils/nlpMatchClient.js
const axios = require("axios");

const NLP_SERVICE_BASE =
  process.env.NLP_SERVICE_BASE || "http://127.0.0.1:8000";

/**
 * Call FastAPI /match-job with:
 *  - full job document
 *  - processed resume (scoringText + structured)
 */
// async function computeJobResumeMatch(jobDoc, processedResumeDoc) {
//   const payload = {
//     job: jobDoc,
//     resume: {
//       scoringText: processedResumeDoc.scoringText,
//       structured: processedResumeDoc.structured,
//     },
//   };

//   const resp = await axios.post(
//     `${NLP_SERVICE_BASE}/match-job`,
//     payload,
//     { timeout: 120000 }
//   );

//   return resp.data;
//   // {
//   //   similarity,
//   //   semantic_score,
//   //   rule_score,
//   //   final_score,
//   //   breakdown
//   // }
// }
async function computeJobResumeMatch(jobDoc, processedResumeDoc) {
  const scoringText =
    processedResumeDoc?.scoringText ??     // camelCase (if Node stored it)
    processedResumeDoc?.scoring_text ??    // snake_case (from FastAPI)
    "";

  const payload = {
    job: jobDoc,
    resume: {
      scoringText,                         // ✅ always correct now
      structured: processedResumeDoc?.structured || {},
    },
  };

  const resp = await axios.post(`${NLP_SERVICE_BASE}/match-job`, payload, {
    timeout: 120000,
  });

  return resp.data;
}

/**
 * Call FastAPI /bm25/rank with:
 *  - queryText
 *  - jobs array (id + text)
 * Returns ordered ids + scores
 */
async function bm25RankJobs(queryText, jobs) {
  const payload = {
    query: String(queryText || "").trim(),
    jobs: jobs.map((j) => ({
      id: String(j._id),

      // ✅ fields FastAPI expects
      title: j.title || "",
      description: j.description || "",
      skillsRequired: Array.isArray(j.skillsRequired) ? j.skillsRequired : [],
      companyName: j.createdBy?.companyName || j.companyName || "",

      // ✅ extra fields used by Python build_doc()
      workArrangement: j.workArrangement || "",
      jobLocation: j.jobLocation || j.location || "",
      remoteLocation: j.remote?.location || "",
    })),
  };

  const resp = await axios.post(`${NLP_SERVICE_BASE}/bm25/rank`, payload, {
    timeout: 120000,
  });

  return resp.data;
}

async function bm25RebuildIndex(jobs) {
  const payload = {
    jobs: jobs.map((j) => ({
      id: String(j._id),
      title: j.title || "",
      description: j.description || "",
      skillsRequired: Array.isArray(j.skillsRequired) ? j.skillsRequired : [],
      companyName: j.createdBy?.companyName || j.companyName || "",
      workArrangement: j.workArrangement || "",
      jobLocation: j.jobLocation || j.location || "",
      remoteLocation: j.remote?.location || "",
    })),
  };

  const resp = await axios.post(`${NLP_SERVICE_BASE}/bm25/index`, payload, {
    timeout: 120000,
  });
  return resp.data;
}

async function bm25RankFromIndex(queryText) {
  const payload = { query: String(queryText || "").trim() };

  const resp = await axios.post(`${NLP_SERVICE_BASE}/bm25/rank-index`, payload, {
    timeout: 120000,
  });

  return resp.data;
}


module.exports = {
  computeJobResumeMatch,
  bm25RankJobs,
  bm25RebuildIndex,
  bm25RankFromIndex,
};
// module.exports = { computeJobResumeMatch, bm25RankJobs };

