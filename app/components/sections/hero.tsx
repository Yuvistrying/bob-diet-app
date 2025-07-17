"use client";

import { Section } from "~/app/components/section";
import { easeInOutCubic } from "~/app/lib/animation";
import { siteConfig } from "~/app/lib/config";
import { motion, useScroll, useTransform } from "framer-motion";

export function Hero() {
  const { scrollY } = useScroll({
    offset: ["start start", "end start"],
  });
  const y1 = useTransform(scrollY, [0, 300], [100, 0]);
  const y2 = useTransform(scrollY, [0, 300], [50, 0]);
  const y3 = useTransform(scrollY, [0, 300], [0, 0]);
  const y4 = useTransform(scrollY, [0, 300], [50, 0]);
  const y5 = useTransform(scrollY, [0, 300], [100, 0]);

  return (
    <Section id="hero" className="min-h-[100vh] w-full overflow-hidden">
      <main className="mx-auto pt-16 sm:pt-24 md:pt-32 text-center relative px-4">
        <div className="relative">
          <motion.div
            initial={{ scale: 4.5, height: "80vh" }}
            animate={{ scale: 1, height: "10vh" }}
            transition={{
              scale: { delay: 0, duration: 1.8, ease: easeInOutCubic },
              height: { delay: 0, duration: 1.8, ease: easeInOutCubic },
            }}
            className="mb-16 relative z-20"
            style={{ transformOrigin: "top" }}
          >
            <img src="/logo.svg" alt="Bob Diet Coach" className="h-20 w-20 mx-auto" />
          </motion.div>
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="absolute inset-0 top-20 z-10"
          >
            {siteConfig.name}
          </motion.div>
        </div>

        <div className="max-w-5xl mx-auto">
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5, ease: easeInOutCubic }}
            className="text-5xl font-bold mb-4 tracking-tighter"
          >
            {siteConfig.description}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.7, ease: easeInOutCubic }}
            className="max-w-2xl mx-auto text-xl mb-8 font-medium text-balance"
          >
            Just tell Bob what you ate like you'd text a friend. No tedious
            databases, no barcode scanning - he understands natural language and
            catches hidden calories you might miss.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9, ease: easeInOutCubic }}
            className="flex flex-col sm:flex-row items-center gap-4 mb-16 justify-center"
          >
            <a
              href="/sign-up"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8"
            >
              {siteConfig.cta} →
            </a>
            <p className="text-sm text-muted-foreground">
              Free to start • No credit card required
            </p>
          </motion.div>
        </div>
        <div className="flex flex-nowrap items-center justify-center gap-4 sm:gap-8 h-auto sm:h-[500px] select-none">
          <motion.img
            src="/Device-1.png"
            alt="iPhone"
            initial={{ opacity: 0, x: -200 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ y: y1 }}
            transition={{ duration: 1, delay: 1 }}
            className="w-40 sm:w-64 h-[333px] sm:h-[500px] flex-shrink-0"
          />
          <motion.img
            src="/Device-2.png"
            alt="iPhone"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ y: y2 }}
            transition={{ duration: 1, delay: 1 }}
            className="w-40 sm:w-64 h-[333px] sm:h-[500px] flex-shrink-0"
          />
          <motion.img
            src="/Device-3.png"
            alt="iPhone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ y: y3 }}
            transition={{ duration: 1, delay: 1 }}
            className="w-40 sm:w-64 h-[333px] sm:h-[500px] flex-shrink-0"
          />
          <motion.img
            src="/Device-4.png"
            alt="iPhone"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ y: y4 }}
            transition={{ duration: 1, delay: 1 }}
            className="w-40 sm:w-64 h-[333px] sm:h-[500px] flex-shrink-0"
          />
          <motion.img
            src="/Device-5.png"
            alt="iPhone"
            initial={{ opacity: 0, x: 200 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ y: y5 }}
            transition={{ duration: 1, delay: 1 }}
            className="w-40 sm:w-64 h-[333px] sm:h-[500px] flex-shrink-0"
          />
        </div>
      </main>
    </Section>
  );
}
