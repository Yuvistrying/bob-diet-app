──────────────────────────────────────────────────╮
     │ Token Usage Analysis & Optimization Plan          │
     │                                                   │
     │ Based on my analysis of the codebase, here are the│
     │  key findings and recommended optimizations:      │
     │                                                   │
     │ Current Token Usage Patterns                      │
     │                                                   │
     │ 1. Context Management                             │
     │   - Messages are limited to last 5 messages (line │
     │ 120 in stream-v2/route.ts)                        │
     │   - However, the code actually takes the last 10  │
     │ messages (line 258) due to a discrepancy          │
     │   - Summaries are generated using Claude Haiku    │
     │ after every 5 messages                            │
     │   - Today's food logs are fully passed in the     │
     │ prompt context                                    │
     │ 2. Prompt Structure                               │
     │   - Full prompt includes: user stats, today's     │
     │ actual meals, yesterday's totals, pending         │
     │ confirmations                                     │
     │   - Food logs are formatted as detailed strings   │
     │ with calories and macros for each item            │
     │   - Smart prompt selection: minimal prompts for   │
     │ simple queries, full prompts for complex ones     │
     │ 3. Token Estimation (from stream-v2/route.ts line │
     │ 313-319)                                          │
     │   - System prompt: ~length/4 characters           │
     │   - Messages: ~content length/4 per message       │
     │   - Tools: ~100 tokens per tool loaded            │
     │                                                   │
     │ Key Issues Contributing to High Token Usage       │
     │                                                   │
     │ 1. Food Log Context Explosion                     │
     │   - Today's food logs are passed in full detail in│
     │  the system prompt (lines 48-52 in prompts.ts)    │
     │   - Each food item includes name, calories, and   │
     │ all macros                                        │
     │   - This can quickly grow to hundreds of tokens   │
     │ for users who log many items                      │
     │ 2. Message History Inconsistency                  │
     │   - Query fetches last 5 messages but code uses   │
     │ last 10                                           │
     │   - No effective truncation of very long messages │
     │ 3. Redundant Information                          │
     │   - Food logs are passed both in the daily summary│
     │  AND as full details                              │
     │   - Yesterday's stats could be more concise       │
     │                                                   │
     │ Recommended Optimizations                         │
     │                                                   │
     │ 1. Compress Food Log Context                      │
     │   - Instead of full details, pass only meal       │
     │ summaries with total calories                     │
     │   - Example: "breakfast: 450cal, lunch: 680cal"   │
     │ instead of detailed item lists                    │
     │   - Keep full details only for the most recent 2-3│
     │  meals                                            │
     │ 2. Fix Message Limit Discrepancy                  │
     │   - Align the query limit (5) with the actual     │
     │ usage (10)                                        │
     │   - Consider reducing to 3-5 messages for most    │
     │ interactions                                      │
     │ 3. Implement Progressive Context Loading          │
     │   - For queries about food history, load context  │
     │ on-demand                                         │
     │   - For logging new food, minimize historical     │
     │ context                                           │
     │   - Use intent detection to determine context     │
     │ needs                                             │
     │ 4. Optimize Summary Format                        │
     │   - Current summaries include redundant           │
     │ calorie/macro details                             │
     │   - Compress to key insights only                 │
     │ 5. Cache Daily Summary More Aggressively          │
     │   - Currently cached with short TTL               │
     │   - Increase cache duration since daily stats     │
     │ change infrequently                               │
     │ 6. Tool Loading Optimization                      │
     │   - Already implemented well with intent-based    │
     │ loading                                           │
     │   - Consider removing unused tool variants        │
     │                                                   │
     │ Implementation Priority                           │
     │                                                   │
     │ 1. High Impact, Quick Win: Compress food log      │
     │ context format                                    │
     │ 2. Medium Impact: Fix message limit discrepancy   │
     │ 3. High Impact, More Complex: Progressive context │
     │ loading based on intent                           │
     │ 4. Low Impact: Summary format optimization        │
     │                                                   │
     │ These changes should reduce token usage by 30-50% │
     │ for typical interactions while maintaining full   │
     │ functionality.                                    │
     ╰───────────────────────────────────────────────