import { httpRouter } from "convex/server";
import { paymentWebhook } from "./subscriptions";

const http = httpRouter();

// Single webhook endpoint - environment determined by deployment
http.route({
  path: "/webhooks/polar",
  method: "POST",
  handler: paymentWebhook,
});

export default http;
