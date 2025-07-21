import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  console.log("Polar webhook endpoint hit!");

  try {
    const body = await request.text();
    console.log("Webhook body received:", body.substring(0, 100));

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
    request.headers.forEach((value, key) => {
      if (
        key.toLowerCase().includes("webhook") ||
        key.toLowerCase() === "content-type" ||
        key.toLowerCase() === "x-polar-webhook-signature"
      ) {
        webhookHeaders[key] = value;
      }
    });

    // HTTP routes are served from convex.site, not convex.cloud
    const convexSiteUrl = convexUrl.replace(".convex.cloud", ".convex.site");
    console.log(
      "Forwarding to Convex HTTP URL:",
      `${convexSiteUrl}/webhooks/polar`,
    );

    const response = await fetch(`${convexSiteUrl}/webhooks/polar`, {
      method: "POST",
      headers: webhookHeaders,
      body,
    });

    const responseData = await response.text();
    console.log("Convex response status:", response.status);
    console.log("Convex response:", responseData.substring(0, 200));

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
