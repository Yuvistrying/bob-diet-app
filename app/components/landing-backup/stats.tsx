"use client";

import { motion } from "framer-motion";
import { bobConfig } from "~/app/lib/bob-config";

export function Stats() {
  return (
    <div className="bg-primary py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {bobConfig.stats.items.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="text-4xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-primary-foreground">
                {stat.value}
              </div>
              <div className="text-sm text-primary-foreground/80">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
