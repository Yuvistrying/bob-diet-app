import { getAuth } from "@clerk/react-router/ssr.server";
import { fetchQuery } from "~/lib/convex.server";
import { redirect, useLoaderData, Outlet, NavLink, useLocation } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Route } from "./+types/layout";
import { createClerkClient } from "@clerk/react-router/api.server";
import { cn } from "~/lib/utils";
import { MessageCircle, FileText, User } from "lucide-react";

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);

  // Redirect to sign-in if not authenticated
  if (!userId) {
    throw redirect("/sign-in");
  }

  // Parallel data fetching to reduce waterfall
  const [subscriptionStatus, user, onboardingStatus] = await Promise.all([
    fetchQuery(api.subscriptions.checkUserSubscriptionStatus, { userId }),
    createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    }).users.getUser(userId),
    fetchQuery(api.onboarding.getOnboardingStatus, {})
  ]);

  // Redirect to subscription-required if no active subscription
  if (!subscriptionStatus?.hasActiveSubscription) {
    throw redirect("/subscription-required");
  }

  // Don't redirect to onboarding - we'll handle it in chat
  return { user, onboardingStatus };
}

export default function AppLayout() {
  const { user, onboardingStatus } = useLoaderData();
  const location = useLocation();
  
  const navigation = [
    { name: "Chat", href: "/chat", icon: MessageCircle },
    { name: "Diary", href: "/diary", icon: FileText },
    { name: user?.firstName || "Profile", href: "/profile", icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#F5F2ED] flex flex-col">
      {/* Main Content - No header, full screen */}
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="grid grid-cols-3">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  "flex flex-col items-center py-3 px-1 text-xs transition-colors",
                  isActive 
                    ? "text-green-600" 
                    : "text-gray-500 hover:text-gray-900"
                )}
              >
                <item.icon className={cn("h-5 w-5 mb-1", isActive && "text-green-600")} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}