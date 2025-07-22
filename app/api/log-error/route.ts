import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const errorData = await req.json();

    // Log to server console with timestamp
    console.error(`[CLIENT ERROR] ${new Date().toISOString()}`);
    console.error("URL:", errorData.url);
    console.error("Message:", errorData.message);
    console.error("Stack:", errorData.stack);
    console.error("Component Stack:", errorData.componentStack);
    console.error("User Agent:", errorData.userAgent);
    console.error("---");

    // You could also:
    // 1. Save to database
    // 2. Send to error tracking service (Sentry, LogRocket, etc)
    // 3. Send email/Slack notification for critical errors

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to log client error:", error);
    return NextResponse.json({ error: "Failed to log error" }, { status: 500 });
  }
}
