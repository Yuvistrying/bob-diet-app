"use client"
import { AppSidebar } from "~/components/app-sidebar"
import { ChartAreaInteractive } from "~/components/chart-area-interactive"
import { DataTable } from "~/components/data-table"
import { SectionCards } from "~/components/section-cards"
import { SiteHeader } from "~/components/site-header"
import SubscriptionStatus from "~/components/subscription-status"

import SubscriptionGuard from "~/components/subscription-guard"
import {
  SidebarInset,
  SidebarProvider,
} from "~/components/ui/sidebar"
import { useMutation } from "convex/react"
import { useAuth } from "@clerk/react-router"
import { api } from "../../convex/_generated/api"
import { useEffect } from "react"

import data from "./data.json"

export default function Page() {
  const { isSignedIn } = useAuth();
  const upsertUser = useMutation(api.users.upsertUser);

  // Sync user data when dashboard loads
  useEffect(() => {
    if (isSignedIn) {
      upsertUser();
    }
  }, [isSignedIn, upsertUser]);

  return (
    <SubscriptionGuard>
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
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="px-4 lg:px-6">
                  <SubscriptionStatus />
                </div>
                <SectionCards />
                <div className="px-4 lg:px-6">
                  <ChartAreaInteractive />
                </div>
                <DataTable data={data} />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </SubscriptionGuard>
  )
}
