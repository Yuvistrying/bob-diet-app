"use client";

import { motion } from "framer-motion";
import { Section } from "./section";
import { bobConfig } from "~/app/lib/bob-config";
import { Button } from "~/app/components/ui/button";
import { Check } from "lucide-react";
import Link from "next/link";

export function CTA() {
  return (
    <Section id="cta" className="bg-primary/5">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6"
        >
          {bobConfig.finalCTA.headline}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true }}
          className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto"
        >
          {bobConfig.finalCTA.subtext}
        </motion.p>

        {/* Visual Element - Mock Chat */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
          className="bg-card rounded-2xl p-6 mb-8 max-w-md mx-auto shadow-lg"
        >
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
              B
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2 text-left">
              {bobConfig.finalCTA.visualText}
            </div>
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          viewport={{ once: true }}
          className="mb-6"
        >
          <Button asChild size="lg" className="text-lg px-8 py-6">
            <Link href="/sign-up">Start Your Free Week with Bob →</Link>
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            {bobConfig.finalCTA.pricing}
          </p>
        </motion.div>

        {/* Trust Elements */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground mb-8"
        >
          {bobConfig.finalCTA.trustElements.map((element, index) => (
            <div key={index} className="flex items-center gap-1">
              <Check className="h-4 w-4 text-primary" />
              <span>{element}</span>
            </div>
          ))}
        </motion.div>

        {/* Emotional Hook */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          viewport={{ once: true }}
          className="text-sm text-muted-foreground italic max-w-2xl mx-auto"
        >
          {bobConfig.finalCTA.emotionalHook}
        </motion.p>
      </div>
    </Section>
  );
}
