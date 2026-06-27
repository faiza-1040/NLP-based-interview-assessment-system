require("dotenv").config();
const { Queue } = require("bullmq");
const { connection } = require("../queue/redis");

const queue = new Queue("resume-processing", { connection });

async function clearQueue() {
  try {
    console.log("🧹 Clearing resume-processing queue...");

    await queue.drain(true);

    await queue.clean(0, 1000, "completed");
    await queue.clean(0, 1000, "failed");
    await queue.clean(0, 1000, "wait");
    await queue.clean(0, 1000, "delayed");
    await queue.clean(0, 1000, "active");

    console.log("✅ Resume queue cleared successfully");
  } catch (err) {
    console.error("❌ Failed to clear queue:", err);
  } finally {
    await queue.close();
    await connection.quit?.();
    process.exit(0);
  }
}

clearQueue();