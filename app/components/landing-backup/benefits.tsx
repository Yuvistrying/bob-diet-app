"use client";

import { motion } from "framer-motion";
import { Section } from "./section";
import { bobConfig } from "~/app/lib/bob-config";
import { Card, CardContent } from "~/app/components/ui/card";

export function Benefits() {
  return (
    <Section
      id="benefits"
      title="Why Choose Bob"
      subtitle={bobConfig.valueProposition.header}
      className="bg-muted/30"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {bobConfig.valueProposition.benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {benefit.icon}
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">
                    {benefit.title}
                  </h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}
