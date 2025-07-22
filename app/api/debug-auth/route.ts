import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "~/convex/_generated/api";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get Clerk auth info
    const authResult = await auth();
    const clerkUserId = authResult?.userId;
    const sessionId = authResult?.sessionId;
    
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      clerk: {
        authenticated: !!clerkUserId,
        userId: clerkUserId || null,
        sessionId: sessionId || null,
      },
      convex: {
        connected: false,
        user: null,
        error: null,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasConvexUrl: !!process.env.NEXT_PUBLIC_CONVEX_URL,
        hasClerkPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        hasClerkSecretKey: !!process.env.CLERK_SECRET_KEY,
      },
    };

    // Try to connect to Convex
    if (clerkUserId && process.env.NEXT_PUBLIC_CONVEX_URL) {
      try {
        const convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
        
        // Get auth token for Convex
        const token = await authResult?.getToken({ template: "convex" });
        
        if (token) {
          convexClient.setAuth(token);
          debugInfo.convex.hasToken = true;
          
          // Try to find user in Convex
          try {
            const convexUser = await convexClient.query(api.users.findUserByToken, {
              tokenIdentifier: clerkUserId,
            });
            
            debugInfo.convex.connected = true;
            debugInfo.convex.user = convexUser ? {
              exists: true,
              id: convexUser._id,
              email: convexUser.email,
            } : {
              exists: false,
              message: "User not found in Convex database",
            };
          } catch (queryError: any) {
            debugInfo.convex.error = {
              type: "query_error",
              message: queryError.message || "Failed to query user",
            };
          }
        } else {
          debugInfo.convex.error = {
            type: "auth_error",
            message: "Failed to get Convex auth token from Clerk",
          };
        }
      } catch (convexError: any) {
        debugInfo.convex.error = {
          type: "connection_error",
          message: convexError.message || "Failed to connect to Convex",
        };
      }
    }

    // Analyze the results
    debugInfo.diagnosis = analyzeDiagnosis(debugInfo);

    return NextResponse.json(debugInfo, { 
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      error: "Debug endpoint error",
      message: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

function analyzeDiagnosis(debugInfo: any): any {
  const diagnosis = {
    healthy: false,
    issues: [] as string[],
    recommendations: [] as string[],
  };

  // Check Clerk auth
  if (!debugInfo.clerk.authenticated) {
    diagnosis.issues.push("User is not authenticated with Clerk");
    diagnosis.recommendations.push("User needs to sign in first");
    return diagnosis;
  }

  // Check environment
  if (!debugInfo.environment.hasConvexUrl) {
    diagnosis.issues.push("Convex URL is not configured");
    diagnosis.recommendations.push("Set NEXT_PUBLIC_CONVEX_URL environment variable");
  }

  // Check Convex connection
  if (debugInfo.convex.error) {
    const errorType = debugInfo.convex.error.type;
    
    if (errorType === "auth_error") {
      diagnosis.issues.push("Cannot get Convex auth token from Clerk");
      diagnosis.recommendations.push(
        "Check Clerk JWT template configuration",
        "Verify Convex auth provider settings"
      );
    } else if (errorType === "connection_error") {
      diagnosis.issues.push("Cannot connect to Convex backend");
      diagnosis.recommendations.push(
        "Check Convex deployment status",
        "Verify network connectivity"
      );
    } else if (errorType === "query_error") {
      diagnosis.issues.push("Error querying Convex database");
      diagnosis.recommendations.push(
        "Check Convex function permissions",
        "Verify database schema"
      );
    }
  } else if (debugInfo.convex.connected && !debugInfo.convex.user?.exists) {
    diagnosis.issues.push("User exists in Clerk but not in Convex");
    diagnosis.recommendations.push(
      "Run upsertUser mutation to sync user",
      "Check for client-side errors preventing sync",
      "Verify browser allows third-party cookies"
    );
  } else if (debugInfo.convex.connected && debugInfo.convex.user?.exists) {
    diagnosis.healthy = true;
  }

  return diagnosis;
}