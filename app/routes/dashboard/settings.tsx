"use client";
import SubscriptionStatus from "~/components/subscription-status";

/**
 * Renders the dashboard settings page layout with the subscription status section.
 *
 * Displays the {@link SubscriptionStatus} component within a styled container using responsive layout classes.
 */
export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <SubscriptionStatus />
          </div>
        </div>
      </div>
    </div>
  );
}
