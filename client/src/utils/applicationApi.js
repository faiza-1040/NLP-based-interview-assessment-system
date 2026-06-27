// client/src/utils/applicationApi.js
import { api } from "./api";

let cachedMinePath = null;

async function detectMinePath() {
  if (cachedMinePath) return cachedMinePath;

  const paths = ["/applications/mine", "/applications/me", "/applications"];

  for (const p of paths) {
    try {
      await api.get(p);
      cachedMinePath = p;
      return p;
    } catch (e) {
      const s = e?.response?.status;

      // If route exists but user is forbidden, path still exists
      if (s === 403) {
        cachedMinePath = p;
        return p;
      }

      // Only keep trying on 404/405
      if (s !== 404 && s !== 405) {
        throw e;
      }
    }
  }

  throw new Error("NO_MINE_ENDPOINT");
}

export const applicationApi = {
 async create({ jobId, screeningAnswers, ...rest }) {
  if (!jobId) {
    throw new Error("JOB_ID_REQUIRED");
  }

  const data = {
    jobId,
    screeningAnswers: Array.isArray(screeningAnswers) ? screeningAnswers : [],
    ...rest,
  };

  return api.post('/applications', data);
},

  async mine() {
    const path = await detectMinePath();
    return api.get(path);
  },
};