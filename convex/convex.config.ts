// convex/convex.config.ts
import { defineApp } from "convex/server";
import polar from "@convex-dev/polar/convex.config";
import agent from "@convex-dev/agent/convex.config";

const app = defineApp();
app.use(polar);
app.use(agent);

export default app;
