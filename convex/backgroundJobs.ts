import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";

const crons = cronJobs();

// Run daily at 3 AM to generate conversation summaries
crons.daily(
  "generate-daily-summaries",
  { hourUTC: 3, minuteUTC: 0 },
  internal.backgroundJobHandlers.generateDailySummaries,
);

// Run every 30 minutes to clean up expired cache
crons.interval(
  "cleanup-expired-cache", 
  { minutes: 30 },
  internal.sessionCache.cleanupExpiredCache,
);

export default crons;