import { getAuth } from "@clerk/react-router/ssr.server";
import { fetchAction, fetchQuery } from "convex/nextjs";
import ContentSection from "~/components/homepage/content";
import Footer from "~/components/homepage/footer";
import Integrations from "~/components/homepage/integrations";
import Pricing from "~/components/homepage/pricing";
import Team from "~/components/homepage/team";
import { api } from "../../convex/_generated/api";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "React Starter Kit" },
    {
      name: "description",
      content:
        "This powerful starter kit is designed to help you launch your SAAS application quickly and efficiently.",
    },
  ];
}

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);

  let subscriptionData = null;

  if (userId) {
    try {
      subscriptionData = await fetchQuery(
        api.subscriptions.checkUserSubscriptionStatus,
        { userId }
      );
    } catch (error) {
      console.error("Failed to fetch subscription data:", error);
    }
  }

  const plans = await fetchAction(api.subscriptions.getAvailablePlans);
  return {
    isSignedIn: !!userId,
    hasActiveSubscription: subscriptionData?.hasActiveSubscription || false,
    plans,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Integrations loaderData={loaderData} />
      <ContentSection />
      <Team />
      <Pricing loaderData={loaderData} />
      <Footer />
    </>
  );
}
