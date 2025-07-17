"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Section } from "./section";
import { easeInOutCubic } from "~/app/lib/animation";

const showcaseItems = [
  {
    id: 1,
    title: "Photo Analysis",
    subtitle: "Snap & Track Instantly",
    screen: "bg-gradient-to-br from-blue-500 to-purple-500",
    placeholder: "Photo analysis UI",
  },
  {
    id: 2,
    title: "Morning Greetings",
    subtitle: "Start Your Day Right",
    screen: "bg-gradient-to-br from-green-500 to-emerald-500",
    placeholder: "Morning greeting UI",
  },
  {
    id: 3,
    title: "Dietary Preferences",
    subtitle: "Personalized For You",
    screen: "bg-gradient-to-br from-orange-500 to-red-500",
    placeholder: "Preferences UI",
  },
  {
    id: 4,
    title: "Weekly Insights",
    subtitle: "Track Your Progress",
    screen: "bg-gradient-to-br from-purple-500 to-pink-500",
    placeholder: "Weekly insights UI",
  },
  {
    id: 5,
    title: "Weight Graphs",
    subtitle: "Visualize Success",
    screen: "bg-gradient-to-br from-cyan-500 to-blue-500",
    placeholder: "Weight graph UI",
  },
];

export function IPhoneShowcaseAnimated() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({
    offset: ["start start", "end start"],
  });

  // Create transforms matching Magic UI template pattern with easing
  const y1 = useTransform(scrollY, [0, 300], [100, 0], {
    ease: easeInOutCubic,
  });
  const y2 = useTransform(scrollY, [0, 300], [50, 0], {
    ease: easeInOutCubic,
  });
  const y3 = useTransform(scrollY, [0, 300], [0, 0], {
    ease: easeInOutCubic,
  });
  const y4 = useTransform(scrollY, [0, 300], [50, 0], {
    ease: easeInOutCubic,
  });
  const y5 = useTransform(scrollY, [0, 300], [100, 0], {
    ease: easeInOutCubic,
  });

  const transforms = [y1, y2, y3, y4, y5];

  return (
    <Section
      id="showcase"
      title="See Bob in Action"
      subtitle="Everything You Need in One App"
      className="overflow-hidden"
    >
      <div ref={containerRef} className="relative">
        {/* Title Cards */}
        <div className="mb-16 grid gap-4 md:grid-cols-5 px-4 max-w-6xl mx-auto">
          {showcaseItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <h3 className="font-bold text-lg">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.subtitle}</p>
            </motion.div>
          ))}
        </div>

        {/* iPhone Display - Matching Magic UI Template */}
        <div className="flex flex-nowrap items-center justify-center gap-4 sm:gap-8 h-auto sm:h-[500px] select-none">
          {showcaseItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{
                opacity: 0,
                x: index < 2 ? -200 : index > 2 ? 200 : 0,
              }}
              animate={{ opacity: 1, x: 0 }}
              style={{ y: transforms[index] }}
              transition={{ duration: 1, delay: 1, ease: easeInOutCubic }}
              className="relative flex-shrink-0"
            >
              {/* iPhone Container */}
              <div className="relative w-[200px] sm:w-[280px]">
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
                    <div
                      className={`h-full ${item.screen} flex items-center justify-center p-4`}
                    >
                      <div className="rounded-lg bg-white/90 dark:bg-gray-800/90 p-4 text-center backdrop-blur">
                        <p className="text-xs sm:text-sm font-medium">
                          {item.placeholder}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Screenshot coming soon
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Home Indicator */}
                  <div className="absolute bottom-2 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-white/30" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Feature Description */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mt-16 text-center max-w-3xl mx-auto px-4"
        >
          <h3 className="text-2xl font-bold mb-4">
            Smart Questions That Catch Hidden Calories
          </h3>
          <p className="text-lg text-muted-foreground">
            Say "had McDonald's" and Bob doesn't just log it - he asks "What did
            you order? Any sauces? What size?" Because those details matter, and
            Bob knows you might miss them.
          </p>
        </motion.div>
      </div>
    </Section>
  );
}
