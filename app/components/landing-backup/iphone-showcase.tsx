"use client";

import { motion } from "framer-motion";
import { Section } from "./section";
import Image from "next/image";

const showcaseItems = [
  {
    title: "Photo Analysis",
    subtitle: "Snap your meal, get instant breakdown",
    description:
      "Just take a photo and Bob analyzes everything - portions, calories, even hidden ingredients",
    placeholder: "Photo analysis screenshot will go here",
    gradient: "from-blue-500/20 to-purple-500/20",
  },
  {
    title: "Morning Greetings",
    subtitle: "Start your day with personalized insights",
    description:
      "Wake up to encouraging messages and reminders tailored to your progress",
    placeholder: "Morning greeting screenshot will go here",
    gradient: "from-green-500/20 to-emerald-500/20",
  },
  {
    title: "Dietary Preferences",
    subtitle: "Bob adapts to YOUR dietary needs",
    description:
      "Vegan? Keto? Allergies? Bob remembers and adjusts all recommendations",
    placeholder: "Preferences screen will go here",
    gradient: "from-orange-500/20 to-red-500/20",
  },
  {
    title: "Weekly Insights",
    subtitle: "Sunday summaries that motivate",
    description:
      "Get personalized insights about your progress and smart adjustments for next week",
    placeholder: "Weekly insight screenshot will go here",
    gradient: "from-purple-500/20 to-pink-500/20",
  },
  {
    title: "Progress Graphs",
    subtitle: "Track your journey visually",
    description:
      "Beautiful charts show your weight trend and help you stay motivated",
    placeholder: "Weight graph screenshot will go here",
    gradient: "from-cyan-500/20 to-blue-500/20",
  },
  {
    title: "Smart Questions",
    subtitle: "Bob digs deeper to help you succeed",
    description:
      'Say "had McDonald\'s" and Bob asks "What did you order? Any sauces?" - catching calories you might miss',
    placeholder: "Conversation screenshot will go here",
    gradient: "from-pink-500/20 to-purple-500/20",
  },
];

export function IPhoneShowcase() {
  return (
    <Section
      id="showcase"
      title="See Bob in Action"
      subtitle="Six Ways Bob Makes Dieting Actually Work"
      className="bg-muted/30"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-16 md:gap-20">
          {showcaseItems.map((item, index) => {
            const isEven = index % 2 === 0;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
                className={`grid gap-8 md:grid-cols-2 items-center ${
                  isEven ? "" : "md:grid-flow-col-dense"
                }`}
              >
                {/* Content */}
                <div className={isEven ? "" : "md:col-start-2"}>
                  <div className="space-y-4">
                    <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                      Feature #{index + 1}
                    </div>
                    <h3 className="text-3xl font-bold">{item.title}</h3>
                    <p className="text-xl text-primary">{item.subtitle}</p>
                    <p className="text-lg text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* iPhone Mockup */}
                <div className={`relative ${isEven ? "" : "md:col-start-1"}`}>
                  <div className="relative mx-auto w-full max-w-[320px]">
                    {/* iPhone Frame */}
                    <div className="relative aspect-[390/844] w-full">
                      {/* Phone Background */}
                      <div className="absolute inset-0 rounded-[3rem] bg-gray-900 shadow-2xl" />

                      {/* Screen */}
                      <div className="absolute inset-[3%] overflow-hidden rounded-[2.5rem] bg-white dark:bg-gray-900">
                        {/* Status Bar */}
                        <div className="relative h-12 bg-black">
                          <div className="absolute left-6 top-1/2 h-5 w-20 -translate-y-1/2 rounded-full bg-black" />
                        </div>

                        {/* Content Area with Gradient Background */}
                        <div
                          className={`h-full bg-gradient-to-br ${item.gradient} flex items-center justify-center p-4`}
                        >
                          <div className="rounded-lg bg-white/90 dark:bg-gray-800/90 p-6 text-center backdrop-blur">
                            <p className="text-sm font-medium text-muted-foreground">
                              {item.placeholder}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
