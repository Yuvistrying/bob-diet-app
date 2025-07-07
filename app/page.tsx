import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { userId } = await auth();

  // If user is logged in, redirect to chat
  if (userId) {
    redirect("/chat");
  }

  // Otherwise, redirect to sign-in
  redirect("/sign-in");
}
