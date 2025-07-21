import { Benefits } from "~/app/components/landing/sections/benefits";
import { BentoGrid } from "~/app/components/landing/sections/bento";
import { CTA } from "~/app/components/landing/sections/cta";
import { FAQ } from "~/app/components/landing/sections/faq";
import { FeatureHighlight } from "~/app/components/landing/sections/feature-highlight";
import { FeatureScroll } from "~/app/components/landing/sections/feature-scroll";
import { Features } from "~/app/components/landing/sections/features";
import { Footer } from "~/app/components/landing/sections/footer";
import { Header } from "~/app/components/landing/sections/header";
import { Hero } from "~/app/components/landing/sections/hero";
import { Pricing } from "~/app/components/landing/sections/pricing";
import { Testimonials } from "~/app/components/landing/sections/testimonials";

export default function LandingPage() {
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
