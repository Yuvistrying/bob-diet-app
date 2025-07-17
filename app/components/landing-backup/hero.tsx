"use client";

import { motion } from "framer-motion";
import { Section } from "./section";
import { bobConfig } from "~/app/lib/bob-config";
import { Button } from "~/app/components/ui/button";
import Link from "next/link";
import Image from "next/image";

export function Hero() {
  return (
    <Section id="hero" className="min-h-[100vh] w-full overflow-hidden">
      <main className="mx-auto pt-16 sm:pt-24 md:pt-32 text-center relative px-4">
        {/* Animated Logo */}
        <motion.div
          initial={{ scale: 4.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            scale: { delay: 0, duration: 1.2 },
            opacity: { delay: 0, duration: 0.8 },
          }}
          className="mb-8 relative z-20 mx-auto w-fit"
        >
          <Image
            src="/logo.svg"
            alt="Bob Diet Coach"
            width={80}
            height={80}
            className="w-20 h-20 mx-auto"
          />
        </motion.div>

        <div className="max-w-5xl mx-auto">
          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 tracking-tight"
          >
            {bobConfig.hero.headline}
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="max-w-3xl mx-auto text-lg sm:text-xl mb-8 text-muted-foreground"
          >
            {bobConfig.hero.subheadline}
          </motion.p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="flex flex-col items-center gap-4 mb-8"
          >
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link href="/sign-up">{bobConfig.cta} →</Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              {bobConfig.ctaSubtext}
            </p>
          </motion.div>

          {/* Trust Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.1 }}
            className="flex items-center justify-center gap-2 text-sm"
          >
            <span>{bobConfig.hero.trustIndicator.rating}</span>
            <span className="text-muted-foreground">
              {bobConfig.hero.trustIndicator.quote} -{" "}
              {bobConfig.hero.trustIndicator.author}
            </span>
          </motion.div>
        </div>

        {/* Hero Visual - Chat Interface Mock */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.3 }}
          className="mt-16 max-w-3xl mx-auto"
        >
          <div className="bg-card rounded-2xl shadow-2xl p-4 sm:p-8">
            {/* Mock Chat Interface */}
            <div className="space-y-4">
              {/* User Message */}
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%]">
                  Had pizza with the kids tonight 🍕
                </div>
              </div>

              {/* Bob's Response */}
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%]">
                  Perfect! Family pizza nights are important 😊 That's about
                  600-800 calories depending on slices. How many did you have?
                </div>
              </div>

              {/* User Message */}
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%]">
                  2 slices and some salad
                </div>
              </div>

              {/* Bob's Response */}
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%]">
                  Great balance with the salad! That's about 650 cal total.
                  You're at 1,580 for today - right on track! 💪
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </Section>
  );
}
