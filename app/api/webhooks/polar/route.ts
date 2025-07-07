import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    // Forward the request to Convex HTTP action
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL not configured");
    }

    const response = await fetch(`${convexUrl}/webhooks/polar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward the webhook signature header
        "X-Polar-Webhook-Signature":
          req.headers.get("X-Polar-Webhook-Signature") || "",
      },
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
