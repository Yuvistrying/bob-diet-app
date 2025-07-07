import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Weekly calibration - runs every Sunday at midnight UTC
crons.weekly(
  "weekly calibration",
  {
    dayOfWeek: "sunday",
    hourUTC: 0, // midnight
    minuteUTC: 0,
  },
  internal.calibration.runWeeklyCalibration,
);

// Daily thread reset - runs every day at 5 AM local time (using UTC conversion)
// Note: This runs at 10 AM UTC which is ~5 AM EST
crons.daily(
  "daily thread reset",
  {
    hourUTC: 10, // 10 AM UTC = 5 AM EST
    minuteUTC: 0,
  },
  internal.threads.resetDailyThreads,
);

export default crons;
