import { internalMutation } from "../_generated/server";

// Migration to remove deprecated agentThreadId field from userPreferences
export const removeAgentThreadId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const preferences = await ctx.db
      .query("userPreferences")
      .collect();
    
    let updated = 0;
    
    for (const pref of preferences) {
      if ('agentThreadId' in pref) {
        const { agentThreadId, ...rest } = pref as any;
        await ctx.db.replace(pref._id, rest);
        updated++;
      }
    }
    
    console.log(`Migration complete: removed agentThreadId from ${updated} documents`);
    return { updated };
  },
});