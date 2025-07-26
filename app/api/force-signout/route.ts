import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = NextResponse.json({ message: "Signed out" });
    
    // Clear all possible Clerk cookies
    const cookiesToClear = [
      "__client",
      "__client_uat", 
      "__session",
      "__clerk_db_jwt",
      "clerk-db-jwt",
      "__dev_session"
    ];
    
    cookiesToClear.forEach(cookieName => {
      response.cookies.set(cookieName, "", {
        expires: new Date(0),
        path: "/",
        domain: "localhost",
      });
      response.cookies.set(cookieName, "", {
        expires: new Date(0),
        path: "/",
      });
    });
    
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to sign out" },
      { status: 500 }
    );
  }
}