import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Header } from "~/app/components/landing/header";
import { HeroV2 } from "~/app/components/landing/hero-v2";
import { Benefits } from "~/app/components/landing/benefits";
import { Stats } from "~/app/components/landing/stats";
import { IPhoneShowcaseAnimated } from "~/app/components/landing/iphone-showcase-animated";
import { Testimonials } from "~/app/components/landing/testimonials";
import { Pricing } from "~/app/components/landing/pricing";
import { FAQ } from "~/app/components/landing/faq";
import { CTA } from "~/app/components/landing/cta";
import { Footer } from "~/app/components/landing/footer";

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
      <HeroV2 />
      <Benefits />
      <Stats />
      <IPhoneShowcaseAnimated />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
