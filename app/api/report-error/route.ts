import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Log to Vercel logs so you can see it
    console.error("[CLIENT ERROR REPORT]", {
      timestamp: new Date().toISOString(),
      ...body
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to log" }, { status: 500 });
  }
}