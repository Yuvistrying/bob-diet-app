import { Section } from "~/app/components/landing/section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/app/components/landing/ui/accordion";
import { siteConfig } from "~/app/lib/landing/config";

export function FAQ() {
  return (
    <Section
      id="faq"
      title="FAQ"
      subtitle="Frequently Asked Questions"
      className="container px-10 mx-auto max-w-[var(--max-container-width)]"
    >
      <Accordion
        type="single"
        collapsible
        className="w-full max-w-2xl mx-auto py-10"
      >
        {siteConfig.faqs.map((faq, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="text-left hover:no-underline">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent>{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}
