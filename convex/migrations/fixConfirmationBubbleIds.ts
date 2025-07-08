import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

// One-time migration to fix existing confirmation bubble IDs
export const fixExistingBubbleIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all confirmed bubbles
    const allBubbles = await ctx.db.query("confirmedBubbles").collect();

    console.log(
      `[Migration] Found ${allBubbles.length} total confirmation bubbles`,
    );

    let updated = 0;
    const updates: Array<{ oldId: string; newId: string; food: string }> = [];

    for (const bubble of allBubbles) {
      // Check if this is an old-style ID (confirm-timestamp)
      if (bubble.confirmationId.match(/^confirm-\d{13}$/)) {
        // Generate a deterministic ID based on the food description and bubble data
        const dataString = JSON.stringify({
          foodDescription: bubble.foodDescription,
          threadId: bubble.threadId,
          messageIndex: bubble.messageIndex,
        });

        const hash = dataString.split("").reduce((a, b) => {
          a = (a << 5) - a + b.charCodeAt(0);
          return a & a;
        }, 0);

        const newId = `confirm-legacy-${Math.abs(hash)}`;

        // Update the bubble with new ID
        await ctx.db.patch(bubble._id, {
          confirmationId: newId,
        });

        updates.push({
          oldId: bubble.confirmationId,
          newId,
          food: bubble.foodDescription,
        });

        updated++;
      }
    }

    console.log(`[Migration] Updated ${updated} bubbles with new IDs`);
    console.log(`[Migration] Updates:`, updates);

    return {
      total: allBubbles.length,
      updated,
      updates,
    };
  },
});

// Helper query to check current bubble states
export const checkBubbleStates = internalMutation({
  args: { threadId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const query = ctx.db.query("confirmedBubbles");

    const bubbles = args.threadId
      ? await query
          .filter((q) => q.eq(q.field("threadId"), args.threadId))
          .collect()
      : await query.collect();

    const summary = {
      total: bubbles.length,
      byStatus: {
        confirmed: bubbles.filter((b) => b.status === "confirmed").length,
        rejected: bubbles.filter((b) => b.status === "rejected").length,
      },
      byIdType: {
        oldStyle: bubbles.filter((b) =>
          b.confirmationId.match(/^confirm-\d{13}$/),
        ).length,
        fallback: bubbles.filter((b) => b.confirmationId.includes("fallback"))
          .length,
        legacy: bubbles.filter((b) => b.confirmationId.includes("legacy"))
          .length,
      },
      samples: bubbles.slice(0, 5).map((b) => ({
        id: b.confirmationId,
        status: b.status,
        food: b.foodDescription.substring(0, 50),
      })),
    };

    console.log("[checkBubbleStates] Summary:", summary);
    return summary;
  },
});
