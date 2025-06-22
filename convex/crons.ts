import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Weekly calibration - runs every Sunday at midnight UTC
crons.weekly(
  "weekly calibration",
  {
    dayOfWeek: "sunday",
    hourUTC: 0,   // midnight
    minuteUTC: 0
  },
  internal.calibration.runWeeklyCalibration
);

export default crons;