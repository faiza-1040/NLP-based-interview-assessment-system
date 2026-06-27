// server/queue/applicationQueue.js
const { Queue } = require("bullmq");
const { connection } = require("./redis");

const applicationQueue = new Queue("application-matching", {
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

module.exports = { applicationQueue };