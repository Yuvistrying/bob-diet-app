import { Button } from "~/components/ui/button";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

/**
 * Renders a promotional section highlighting the features and ecosystem of Lyra and RSK.
 *
 * Displays a heading, descriptive paragraphs, and a call-to-action button linking to additional information.
 */
export default function ContentSection() {
  return (
    <section id="features" className="py-16 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-6 md:grid-cols-2 md:gap-12">
          <h2 className="text-4xl font-medium">
            The Starter Kit you need to start your SaaS application.
          </h2>
          <div className="space-y-6">
            <p>
              Lyra is evolving to be more than just the models. It supports an
              entire ecosystem — from products to the APIs and platforms helping
              developers and businesses innovate.
            </p>
            <p>
              RSK.{" "}
              <span className="font-bold">It supports an entire ecosystem</span>{" "}
              — from products innovate. Sit minus, quod debitis autem quia
              aspernatur delectus impedit modi, neque non id ad dignissimos?
              Saepe deleniti perferendis beatae.
            </p>
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="gap-1 pr-1.5"
            >
              <Link to="#">
                <span>Learn More</span>
                <ChevronRight className="size-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
