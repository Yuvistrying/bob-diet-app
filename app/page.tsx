import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import LandingPage from "@/landing/app/page";

export default async function HomePage() {
  const { userId } = await auth();

  // If user is logged in, redirect to chat
  if (userId) {
    redirect("/chat");
  }

  // Otherwise, show landing page
  return <LandingPage />;
}
