import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

// Create a custom middleware that handles webhooks before Clerk
export default function middleware(request: NextRequest) {
  // Skip Clerk completely for webhook routes
  if (request.nextUrl.pathname.startsWith("/api/webhooks")) {
    return NextResponse.next();
  }

  // Apply Clerk middleware for all other routes
  return clerkMiddleware(async (auth, req) => {
    // Only protect specific routes
    if (isProtectedRoute(req)) {
      await auth.protect(); // Note: not auth().protect()
    }

    // For the home page, redirect authenticated users to chat
    const { userId } = await auth();
    if (req.nextUrl.pathname === "/" && userId) {
      return NextResponse.redirect(new URL("/chat", req.url));
    }
  })(request);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
