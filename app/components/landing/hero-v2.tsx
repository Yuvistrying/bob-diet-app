"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Section } from "./section";
import { bobConfig } from "~/app/lib/bob-config";
import { Button } from "~/app/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { easeInOutCubic } from "~/app/lib/animation";

export function HeroV2() {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 300], [0, -50], {
    ease: easeInOutCubic,
  });
  const y2 = useTransform(scrollY, [0, 300], [0, -100], {
    ease: easeInOutCubic,
  });
  const y3 = useTransform(scrollY, [0, 300], [0, -150], {
    ease: easeInOutCubic,
  });

  const phones = [
    {
      content: (
        <div className="space-y-3 p-4">
          <div className="flex justify-end">
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%]">
              Just had lunch at Chipotle 🌯
            </div>
          </div>
          <div className="flex justify-start gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
              B
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%]">
              Nice! What did you get? Bowl, burrito, or tacos?
            </div>
          </div>
        </div>
      ),
      transform: y1,
    },
    {
      content: (
        <div className="p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg">
            <h4 className="font-semibold mb-2">Good morning! 🌅</h4>
            <p className="text-sm text-muted-foreground mb-3">
              You're down 0.8 lbs this week! Let's keep the momentum going.
            </p>
            <div className="text-xs bg-primary/10 text-primary rounded p-2">
              💡 Tip: Your body responds well to protein at breakfast. Try eggs or Greek yogurt today!
            </div>
          </div>
        </div>
      ),
      transform: y2,
    },
    {
      content: (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-center">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-8 text-center">
              <div className="text-4xl mb-2">📸</div>
              <p className="text-sm font-medium">Photo Analysis</p>
            </div>
          </div>
          <div className="flex justify-start gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
              B
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2">
              Looks like grilled chicken with veggies! About 420 calories. Any sauce on that?
            </div>
          </div>
        </div>
      ),
      transform: y3,
    },
  ];

  return (
    <Section id="hero" className="min-h-[100vh] w-full overflow-hidden pt-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-center lg:text-left">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-8 flex justify-center lg:justify-start"
            >
              <Image
                src="/logo.svg"
                alt="Bob Diet Coach"
                width={80}
                height={80}
                className="w-20 h-20"
              />
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 tracking-tight"
            >
              {bobConfig.hero.headline}
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-lg sm:text-xl mb-8 text-muted-foreground max-w-2xl mx-auto lg:mx-0"
            >
              {bobConfig.hero.subheadline}
            </motion.p>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center gap-4 mb-8 justify-center lg:justify-start"
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
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex items-center gap-2 text-sm justify-center lg:justify-start"
            >
              <span>{bobConfig.hero.trustIndicator.rating}</span>
              <span className="text-muted-foreground">
                {bobConfig.hero.trustIndicator.quote} -{" "}
                {bobConfig.hero.trustIndicator.author}
              </span>
            </motion.div>
          </div>

          {/* Right Column - iPhone Mockups */}
          <div className="relative h-[600px] hidden lg:block">
            {phones.map((phone, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.4 + index * 0.1, ease: easeInOutCubic }}
                style={{ 
                  y: phone.transform,
                  position: 'absolute',
                  left: `${index * 120}px`,
                  top: `${index * 40}px`,
                  zIndex: 3 - index,
                }}
                className="w-[280px]"
              >
                <div className="relative aspect-[390/844] w-full">
                  {/* Phone Frame */}
                  <div className="absolute inset-0 rounded-[2.5rem] bg-gray-900 shadow-2xl" />
                  
                  {/* Screen */}
                  <div className="absolute inset-[3%] overflow-hidden rounded-[2rem] bg-white dark:bg-gray-900">
                    {/* Status Bar */}
                    <div className="relative h-10 bg-black">
                      <div className="absolute left-1/2 top-1/2 h-4 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
                    </div>
                    
                    {/* Screen Content */}
                    <div className="h-full bg-background">
                      {phone.content}
                    </div>
                  </div>

                  {/* Home Indicator */}
                  <div className="absolute bottom-2 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-white/30" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Mobile Version - Single Phone */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-12 lg:hidden"
        >
          <div className="relative mx-auto w-full max-w-[320px]">
            <div className="relative aspect-[390/844] w-full">
              {/* Phone Frame */}
              <div className="absolute inset-0 rounded-[2.5rem] bg-gray-900 shadow-2xl" />
              
              {/* Screen */}
              <div className="absolute inset-[3%] overflow-hidden rounded-[2rem] bg-white dark:bg-gray-900">
                {/* Status Bar */}
                <div className="relative h-10 bg-black">
                  <div className="absolute left-1/2 top-1/2 h-4 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
                </div>
                
                {/* Screen Content */}
                <div className="h-full bg-background">
                  {phones[0].content}
                </div>
              </div>

              {/* Home Indicator */}
              <div className="absolute bottom-2 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-white/30" />
            </div>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}