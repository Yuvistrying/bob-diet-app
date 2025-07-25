import { getAuth } from "@clerk/react-router/ssr.server";
import { fetchQuery } from "~/lib/convex.server";
import {
  redirect,
  useLoaderData,
  Outlet,
  NavLink,
  useLocation,
} from "react-router";
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
  const [subscriptionStatus, user, onboardingStatus, userProfile] =
    await Promise.all([
      fetchQuery(api.subscriptions.checkUserSubscriptionStatus, { userId }),
      createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY,
      }).users.getUser(userId),
      fetchQuery(api.onboarding.getOnboardingStatus, {}),
      fetchQuery(api.userProfiles.getUserProfile, {}),
    ]);

  // Get the current path
  const url = new URL(args.request.url);
  const isProfilePage = url.pathname === "/profile";

  // Allow access to profile page even without subscription
  if (!isProfilePage && !subscriptionStatus?.hasActiveSubscription) {
    throw redirect("/subscription-required");
  }

  // Don't redirect to onboarding - we'll handle it in chat
  return { user, onboardingStatus, userProfile };
}

export default function AppLayout() {
  const { user, onboardingStatus, userProfile } = useLoaderData();
  const location = useLocation();

  const navigation = [
    { name: "Chat", href: "/chat", icon: MessageCircle },
    { name: "Diary", href: "/diary", icon: FileText },
    {
      name: userProfile?.name || user?.firstName || "Profile",
      href: "/profile",
      icon: User,
    },
  ];

  return (
    <>
      {/* Main Content */}
      <Outlet />

      {/* Bottom Navigation - fixed position */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black z-50">
        <div className="grid grid-cols-3">
          {navigation.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href !== "/dashboard" &&
                location.pathname.startsWith(item.href));

            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  "flex flex-col items-center py-3 px-1 text-xs transition-all",
                  isActive
                    ? "text-gray-900 dark:text-gray-100 font-bold"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200",
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 mb-1",
                    isActive && "text-gray-900 dark:text-gray-100",
                  )}
                />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
