import Integrations from "~/components/homepage/integrations";
import type { Route } from "./+types/home";
import ContentSection from "~/components/homepage/content";

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
    </>
  )
}
