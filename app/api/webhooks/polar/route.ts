import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    // Forward the request to Convex HTTP action
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL not configured");
    }

    // Forward all webhook headers
    const webhookHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    // Forward all webhook-related headers
    req.headers.forEach((value, key) => {
      if (key.toLowerCase().includes('webhook') || 
          key.toLowerCase() === 'content-type') {
        webhookHeaders[key] = value;
      }
    });

    const response = await fetch(`${convexUrl}/webhooks/polar`, {
      method: "POST",
      headers: webhookHeaders,
      body,
    });

    const responseData = await response.text();

    return new NextResponse(responseData, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("Polar webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
