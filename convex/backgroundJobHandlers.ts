import { internalAction, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

// Generate daily summaries for all users
export const generateDailySummaries = internalAction({
  handler: async (ctx) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    console.log(`Generating summaries for ${dateStr}`);

    // Get all users who had conversations yesterday
    const yesterdayStart = yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = yesterday.setHours(23, 59, 59, 999);

    // Get unique user IDs from yesterday's chat history
    const messages = await ctx.runQuery(
      internal.backgroundJobHandlers.getYesterdayMessages,
      {
        startTime: yesterdayStart,
        endTime: yesterdayEnd,
      },
    );

    const userIds = [...new Set(messages.map((m: any) => m.userId))];
    console.log(`Found ${userIds.length} users with activity on ${dateStr}`);

    // Generate summary for each user
    for (const userId of userIds) {
      try {
        const userMessages = messages
          .filter((m: any) => m.userId === userId)
          .map((m: any) => ({
            role: m.role,
            content: m.content,
            metadata: m.metadata,
          }));

        await ctx.runAction(internal.conversationSummary.generateDailySummary, {
          userId,
          date: dateStr,
          messages: userMessages,
        });

        console.log(`Generated summary for user ${userId}`);
      } catch (error) {
        console.error(`Failed to generate summary for user ${userId}:`, error);
      }
    }

    console.log(`Completed generating summaries for ${dateStr}`);
  },
});

// Internal query to get yesterday's messages
export const getYesterdayMessages = internalQuery({
  args: {
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatHistory")
      .filter((q) =>
        q.and(
          q.gte(q.field("timestamp"), args.startTime),
          q.lte(q.field("timestamp"), args.endTime),
        ),
      )
      .collect();
  },
});
