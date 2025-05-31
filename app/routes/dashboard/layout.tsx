import { getAuth } from "@clerk/react-router/ssr.server";
import { fetchQuery } from "convex/nextjs";
import { redirect } from "react-router";
import { AppSidebar } from "~/components/app-sidebar";
import { SiteHeader } from "~/components/site-header";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { api } from "../../../convex/_generated/api";
import type { Route } from "./+types/layout";

import { Outlet } from "react-router";

/**
 * Authenticates the user and verifies their subscription status before granting access to the dashboard.
 *
 * Redirects unauthenticated users to the sign-in page and users without an active subscription to the subscription-required page.
 *
 * @returns An object containing the authenticated user's ID.
 *
 * @throws {Response} If the user is not authenticated or does not have an active subscription, a redirect response is thrown.
 */
export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);

  // Redirect to sign-in if not authenticated
  if (!userId) {
    throw redirect("/sign-in");
  }

  // Check subscription status
  const subscriptionStatus = await fetchQuery(
    api.subscriptions.checkUserSubscriptionStatus,
    { userId }
  );

  // Redirect to subscription-required if no active subscription
  if (!subscriptionStatus?.hasActiveSubscription) {
    throw redirect("/subscription-required");
  }

  // Return userId for client-side use
  return { userId };
}

/**
 * Renders the dashboard layout with a sidebar, header, and nested route content.
 *
 * Provides a sidebar context with custom dimensions, displays the application sidebar, and wraps the main content area with a header and outlet for nested routes.
 */
export default function DashboardLayout() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
