import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ChatProvider } from "~/app/providers/ChatProvider";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  // Redirect to sign-in if not authenticated
  if (!userId) {
    redirect("/sign-in");
  }
  
  return (
    <ChatProvider>
      {children}
    </ChatProvider>
  );
}