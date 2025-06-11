import { getAuth } from "@clerk/react-router/ssr.server";
import { fetchQuery } from "~/lib/convex.server";
import { redirect, useLoaderData, Outlet, NavLink, useLocation } from "react-router";
import { api } from "../../../convex/_generated/api";
import type { Route } from "./+types/layout";
import { createClerkClient } from "@clerk/react-router/api.server";
import { cn } from "~/lib/utils";
import { 
  Home, 
  MessageCircle, 
  FileText, 
  TrendingUp, 
  Settings,
  User
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

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

  // Redirect to onboarding if not completed
  if (!onboardingStatus?.completed && args.request.url.indexOf('/dashboard/onboarding') === -1) {
    throw redirect("/dashboard/onboarding");
  }

  return { user, onboardingStatus };
}

export default function MobileDashboardLayout() {
  const { user } = useLoaderData();
  const location = useLocation();
  
  const navigation = [
    { name: "Chat", href: "/dashboard/chat", icon: MessageCircle },
    { name: "Diary", href: "/dashboard/logs", icon: FileText },
    { name: user?.firstName || "Profile", href: "/dashboard/settings", icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#F5F2ED] flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Bob Diet Coach</h1>
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.imageUrl} alt={user.firstName || ""} />
          <AvatarFallback>
            {user.firstName?.[0] || user.emailAddresses[0].emailAddress[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </header>

      {/* Main Content */}
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