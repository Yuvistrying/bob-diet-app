import { auth } from "@clerk/nextjs/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: Request) {
  console.log("[Debug Stream] Starting");
  
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }
    
    const { prompt } = await req.json();
    
    console.log("[Debug Stream] Creating minimal tools");
    
    const result = await streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: "You are Bob, a helpful diet coach.",
      messages: [{ role: 'user', content: prompt }],
      tools: {
        confirmFood: tool({
          description: "Confirm food for logging",
          parameters: z.object({
            description: z.string(),
            calories: z.number(),
          }),
          execute: async (args) => {
            console.log("[Debug] confirmFood called:", args);
            return args;
          },
        }),
        logFood: tool({
          description: "Log food",
          parameters: z.object({
            description: z.string(),
            calories: z.number(),
          }),
          execute: async (args) => {
            console.log("[Debug] logFood called:", args);
            return { success: true, logged: args };
          },
        }),
      },
      onChunk: ({ chunk }) => {
        console.log("[Debug Stream] Chunk:", chunk.type);
      },
      onError: (error) => {
        console.error("[Debug Stream] Error in stream:", error);
      },
    });
    
    console.log("[Debug Stream] Returning response");
    return result.toDataStreamResponse();
    
  } catch (error: any) {
    console.error("[Debug Stream] Error:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}