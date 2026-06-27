// server/queue/resumeQueue.js
const { Queue } = require("bullmq");
const { connection } = require("./redis");

const resumeQueue = new Queue("resume-processing", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

module.exports = { resumeQueue };


