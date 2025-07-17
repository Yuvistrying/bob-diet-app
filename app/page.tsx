import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Benefits } from "~/app/components/sections/benefits";
import { BentoGrid } from "~/app/components/sections/bento";
import { CTA } from "~/app/components/sections/cta";
import { FAQ } from "~/app/components/sections/faq";
import { FeatureHighlight } from "~/app/components/sections/feature-highlight";
import { FeatureScroll } from "~/app/components/sections/feature-scroll";
import { Features } from "~/app/components/sections/features";
import { Footer } from "~/app/components/sections/footer";
import { Header } from "~/app/components/sections/header";
import { Hero } from "~/app/components/sections/hero";
import { Pricing } from "~/app/components/sections/pricing";
import { Testimonials } from "~/app/components/sections/testimonials";

export default async function HomePage() {
  const { userId } = await auth();

  // If user is logged in, redirect to chat
  if (userId) {
    redirect("/chat");
  }

  // Otherwise, show landing page
  return (
    <main className="relative">
      <Header />
      <Hero />
      <FeatureScroll />
      <FeatureHighlight />
      <BentoGrid />
      <Benefits />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
