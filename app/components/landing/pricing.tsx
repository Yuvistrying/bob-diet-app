"use client";

import { motion } from "framer-motion";
import { Section } from "./section";
import { bobConfig } from "~/app/lib/bob-config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/components/ui/card";
import { Button } from "~/app/components/ui/button";
import { Badge } from "~/app/components/ui/badge";
import { Check } from "lucide-react";
import Link from "next/link";

export function Pricing() {
  return (
    <Section
      id="pricing"
      title="Simple Pricing"
      subtitle="Start Free, Stay Because It Works"
      className="bg-muted/30"
    >
      <div className="mx-auto max-w-4xl px-4">
        <div className="grid gap-8 md:grid-cols-2">
          {bobConfig.pricing.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card
                className={plan.isPopular ? "border-primary shadow-lg" : ""}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="default" className="px-3 py-1">
                      {plan.badge}
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    {plan.originalPrice && (
                      <span className="text-sm line-through text-muted-foreground">
                        ${plan.originalPrice}
                      </span>
                    )}
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">
                        /{plan.period}
                      </span>
                    </div>
                  </div>
                  <CardDescription className="mt-2">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className="w-full"
                    variant={plan.isPopular ? "default" : "outline"}
                  >
                    <Link href="/sign-up">{plan.buttonText}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}
