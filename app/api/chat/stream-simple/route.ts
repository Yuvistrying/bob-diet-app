import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: Request) {
  console.log("[Simple Stream] Request received");
  
  try {
    const { prompt, withTools } = await req.json();
    
    console.log("[Simple Stream] Config:", { prompt, withTools });
    
    const streamConfig: any = {
      model: anthropic('claude-sonnet-4-20250514'),
      prompt: prompt || "Say hello in 3 words",
      maxTokens: 50,
    };
    
    if (withTools) {
      console.log("[Simple Stream] Adding simple tool");
      streamConfig.tools = {
        testTool: tool({
          description: "A simple test tool",
          parameters: z.object({
            message: z.string(),
          }),
          execute: async ({ message }) => {
            console.log("[Simple Stream] Tool executed with:", message);
            return { result: `Received: ${message}` };
          },
        }),
      };
    }
    
    console.log("[Simple Stream] Calling streamText");
    const result = await streamText(streamConfig);
    
    console.log("[Simple Stream] Converting to response");
    return result.toDataStreamResponse();
    
  } catch (error: any) {
    console.error("[Simple Stream] Error:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    
    // Return error as text response
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}