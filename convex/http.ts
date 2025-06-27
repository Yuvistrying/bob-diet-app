import { httpRouter } from "convex/server";
import { paymentWebhook } from "./subscriptions";

const http = httpRouter();

// Route for Polar webhook
http.route({
  path: "/webhooks/polar",
  method: "POST",
  handler: paymentWebhook,
});

// Log all routes for debugging
console.log("[HTTP Router] Configured routes:");
console.log("- POST /webhooks/polar -> paymentWebhook");

export default http;