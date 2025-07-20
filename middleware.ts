import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pricing",
  "/api/webhooks(.*)",
  "/success",
  "/subscription-required",
]);

const isProtectedRoute = createRouteMatcher([
  "/chat(.*)",
  "/diary(.*)",
  "/profile(.*)",
  "/settings(.*)",
]);

export default clerkMiddleware((auth, req) => {
  // Only protect specific routes
  if (isProtectedRoute(req)) {
    auth().protect();
  }
  
  // For the home page, redirect authenticated users to chat
  if (req.nextUrl.pathname === "/" && auth().userId) {
    return NextResponse.redirect(new URL("/chat", req.url));
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
