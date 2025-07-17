"use client";

import { Section } from "./section";
import { bobConfig } from "~/app/lib/bob-config";
import Marquee from "~/app/components/ui/marquee";
import { Card, CardContent } from "~/app/components/ui/card";
import Image from "next/image";

export function Testimonials() {
  return (
    <Section
      id="testimonials"
      title="Success Stories"
      subtitle="Real Stories From People Who 'Tried Everything'"
    >
      <div className="relative">
        <Marquee pauseOnHover className="[--duration:40s]">
          {bobConfig.testimonials.map((testimonial) => (
            <Card key={testimonial.id} className="mx-4 w-[350px]">
              <CardContent className="p-6">
                <p className="mb-4 text-sm leading-relaxed">
                  "{testimonial.text}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full">
                    <Image
                      src={testimonial.image}
                      alt={testimonial.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </Marquee>
      </div>
    </Section>
  );
}
