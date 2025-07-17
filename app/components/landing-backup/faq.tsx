"use client";

import { Section } from "./section";
import { bobConfig } from "~/app/lib/bob-config";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/app/components/ui/accordion";

export function FAQ() {
  return (
    <Section
      id="faq"
      title="FAQ"
      subtitle="Questions? Bob Has Answers."
      align="center"
    >
      <div className="mx-auto max-w-3xl px-4">
        <Accordion type="single" collapsible className="w-full">
          {bobConfig.faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}
