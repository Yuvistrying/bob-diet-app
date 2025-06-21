import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export async function GET() {
  console.log("[Test Anthropic] Starting test");
  
  try {
    // Check environment
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
    const apiKeyLength = process.env.ANTHROPIC_API_KEY?.length;
    
    if (!hasApiKey) {
      return new Response(JSON.stringify({ 
        error: "ANTHROPIC_API_KEY not found in environment variables" 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Initialize Anthropic
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
    
    console.log("[Test Anthropic] Testing simple generateText");
    
    // Test simple text generation
    let result;
    let modelId = 'claude-sonnet-4-20250514'; // Try Claude 4 Sonnet
    
    console.log("[Test Anthropic] Trying model:", modelId);
    result = await generateText({
      model: anthropic(modelId),
      prompt: "Say 'Hello, I'm working!' in exactly 4 words.",
      maxTokens: 10,
    });
    
    console.log("[Test Anthropic] Success:", result.text);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: "Anthropic API is working",
      response: result.text,
      modelUsed: modelId,
      apiKeyLength,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error("[Test Anthropic] Error:", {
      name: error.name,
      message: error.message,
      response: error.response,
      status: error.status,
      stack: error.stack
    });
    
    return new Response(JSON.stringify({ 
      error: true,
      message: error.message,
      errorType: error.name,
      status: error.status,
      details: error.response?.data || error.cause
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}