import { NextResponse } from "next/server";
import { api } from "../../../convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

export async function POST() {
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    
    // This will throw an error in Convex and send it to Sentry
    await convex.mutation(api.testSentry.testError);
    
    return NextResponse.json({ 
      success: false, 
      message: "If you see this, the error wasn't thrown properly" 
    });
  } catch (error) {
    return NextResponse.json({ 
      success: true, 
      message: "Convex error thrown and should be in Sentry",
      error: (error as Error).message,
    });
  }
}