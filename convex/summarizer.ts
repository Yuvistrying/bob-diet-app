import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Types
interface MessageToSummarize {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface SummaryResult {
  summary: string;
  keyPoints: string[];
  foodsLogged: number;
  caloriesTotal: number;
}

// Summarize a batch of messages
export const summarizeMessages = internalAction({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        timestamp: v.number(),
      }),
    ),
    previousSummary: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SummaryResult> => {
    const { messages, previousSummary } = args;

    // Don't summarize if too few messages
    if (messages.length < 3) {
      return {
        summary: messages.map((m) => m.content).join(" "),
        keyPoints: [],
        foodsLogged: 0,
        caloriesTotal: 0,
      };
    }

    // Build context for summarization
    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const systemPrompt = `You are a conversation summarizer for a diet coaching app. 
Your task is to create concise summaries that preserve important context about:
- Foods logged (with calories)
- Weight measurements
- Goals discussed
- User preferences or issues mentioned

${previousSummary ? `Previous context: ${previousSummary}\n\n` : ""}

Provide a JSON response with:
{
  "summary": "A 1-2 sentence summary of the conversation",
  "keyPoints": ["Array of important points to remember"],
  "foodsLogged": number of food items mentioned,
  "caloriesTotal": total calories from foods mentioned
}`;

    try {
      const { text } = await generateText({
        model: anthropic("claude-3-5-haiku-20241022"),
        system: systemPrompt,
        prompt: conversationText,
        temperature: 0.3,
        maxTokens: 300,
      });

      // Parse the JSON response
      const result = JSON.parse(text);

      return {
        summary: result.summary || "",
        keyPoints: result.keyPoints || [],
        foodsLogged: result.foodsLogged || 0,
        caloriesTotal: result.caloriesTotal || 0,
      };
    } catch (error) {
      console.error("[summarizeMessages] Error:", error);

      // Fallback to simple concatenation
      return {
        summary: `Conversation about: ${messages
          .slice(0, 3)
          .map((m) => m.content.substring(0, 50))
          .join(", ")}...`,
        keyPoints: [],
        foodsLogged: 0,
        caloriesTotal: 0,
      };
    }
  },
});

// Determine if messages should be summarized
export function shouldSummarizeMessages(
  messages: MessageToSummarize[],
  totalMessagesSummarized: number,
): boolean {
  // Don't summarize if:
  // 1. Not enough total messages (need at least 10)
  if (messages.length < 10) return false;

  // 2. Less than 5 new messages since last summary
  const newMessageCount = messages.length - totalMessagesSummarized;
  if (newMessageCount < 5) return false;

  // 3. Active tool chain in progress (check last message)
  const lastMessage = messages[messages.length - 1];
  if (
    lastMessage.content.includes("Let me confirm:") ||
    lastMessage.content.includes("Is this correct?")
  ) {
    return false;
  }

  // 4. Recent weight log (within last 3 messages)
  const recentMessages = messages.slice(-3);
  const hasRecentWeightLog = recentMessages.some(
    (m) =>
      m.content.toLowerCase().includes("weight") ||
      m.content.toLowerCase().includes("weigh"),
  );
  if (hasRecentWeightLog) return false;

  console.log(
    `[shouldSummarizeMessages] Can summarize: ${messages.length} total, ${totalMessagesSummarized} already summarized, ${newMessageCount} new`,
  );
  return true;
}

// Extract important context that should never be summarized
export function extractProtectedContext(messages: MessageToSummarize[]) {
  const protected_context = {
    unconfirmedFoods: [] as string[],
    recentWeightLogs: [] as string[],
    activeGoals: [] as string[],
  };

  // Look for unconfirmed food mentions in last 5 messages
  const recentMessages = messages.slice(-5);
  recentMessages.forEach((msg) => {
    if (msg.role === "assistant" && msg.content.includes("Let me confirm:")) {
      protected_context.unconfirmedFoods.push(msg.content);
    }

    if (
      msg.content.toLowerCase().includes("weight") &&
      (msg.content.includes("kg") || msg.content.includes("lbs"))
    ) {
      protected_context.recentWeightLogs.push(msg.content);
    }

    if (
      msg.content.toLowerCase().includes("goal") ||
      msg.content.toLowerCase().includes("target")
    ) {
      protected_context.activeGoals.push(msg.content);
    }
  });

  return protected_context;
}
