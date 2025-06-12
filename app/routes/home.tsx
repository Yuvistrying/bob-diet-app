import { getAuth } from "@clerk/react-router/ssr.server";
import { redirect } from "react-router";
import type { Route } from "./+types/home";

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);
  
  // If user is logged in, redirect to chat
  if (userId) {
    throw redirect("/chat");
  }
  
  // Otherwise, redirect to sign-in
  throw redirect("/sign-in");
}

export default function Home() {
  // This will never render due to redirects in loader
  return null;
}