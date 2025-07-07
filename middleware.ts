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

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // For protected routes, require authentication
  if (isProtectedRoute(req) && !userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // For the home page, redirect authenticated users to chat
  if (req.nextUrl.pathname === "/" && userId) {
    return NextResponse.redirect(new URL("/chat", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
