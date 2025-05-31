import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/sign-in", "routes/sign-in.tsx"),
  route("/sign-up", "routes/sign-up.tsx"),
  route("/pricing", "routes/pricing.tsx"),
  route("/success", "routes/success.tsx"),
  route("/dashboard", "routes/dashboard.tsx"),
] satisfies RouteConfig;
