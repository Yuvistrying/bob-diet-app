import Integrations from "~/components/homepage/integrations";
import type { Route } from "./+types/home";
import ContentSection from "~/components/homepage/content";
import Pricing from "~/components/homepage/pricing";
import Footer from "~/components/homepage/footer";
import Team from "~/components/homepage/team";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  return (
    <>
    <Integrations />
    <ContentSection />
    <Team />
    <Pricing />
    <Footer />
    </>
  )
}
