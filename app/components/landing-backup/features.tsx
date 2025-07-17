"use client";

import { motion } from "framer-motion";
import { Section } from "./section";
import { bobConfig } from "~/app/lib/bob-config";

export function Features() {
  return (
    <Section
      id="features"
      title="How Bob Works"
      subtitle="Your Personal AI Diet Coach"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-16 md:gap-20">
          {bobConfig.productShowcase.scenes.map((scene, index) => {
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
                      {scene.time}
                    </div>
                    <h3 className="text-2xl font-bold">{scene.scenario}</h3>

                    {scene.chat && (
                      <div className="space-y-3">
                        <div className="flex justify-end">
                          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%]">
                            {scene.chat}
                          </div>
                        </div>
                        {scene.response && (
                          <div className="flex justify-start">
                            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%]">
                              {scene.response}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {scene.overlay && (
                      <p className="text-lg font-semibold text-primary">
                        {scene.overlay}
                      </p>
                    )}

                    {scene.result && (
                      <p className="text-xl font-bold">{scene.result}</p>
                    )}
                  </div>
                </div>

                {/* Visual */}
                <div className={`relative ${isEven ? "" : "md:col-start-1"}`}>
                  <div className="aspect-[4/3] bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center">
                    <div className="text-6xl">
                      {index === 0 && "🍞"}
                      {index === 1 && "🥗🍫"}
                      {index === 2 && "🍕"}
                      {index === 3 && "📊"}
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
