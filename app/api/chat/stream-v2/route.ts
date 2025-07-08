import { auth } from "@clerk/nextjs/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "../../../../convex/_generated/api";
import {
  getBobSystemPrompt,
  buildPromptContext,
} from "../../../../convex/prompts";
import {
  createTools,
  detectIntent,
  getToolsForIntent,
} from "../../../../convex/tools/index";
import { StreamDebugger } from "./debug";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Log if API key is present (without exposing it)
console.log(
  "[stream-v2] Anthropic API key present:",
  !!process.env.ANTHROPIC_API_KEY,
);
console.log(
  "[stream-v2] API key length:",
  process.env.ANTHROPIC_API_KEY?.length || 0,
);

const convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  console.log("[stream-v2] ========== NEW REQUEST ==========");
  const debug = new StreamDebugger();
  debug.log("REQUEST_START", { method: "POST", url: req.url });

  try {
    debug.log("AUTH_START", {});

    const { userId, getToken } = await auth();
    if (!userId) {
      debug.error("AUTH_ERROR", { error: "No userId" });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    debug.log("AUTH_USER", { userId });

    const token = await getToken({ template: "convex" });
    if (!token) {
      debug.error("AUTH_ERROR", { error: "No token" });
      console.error("[stream-v2] Failed to get Convex auth token");
      throw new Error("Failed to get authentication token");
    }

    debug.log("AUTH_SUCCESS", { hasToken: true });
    console.log("[stream-v2] Got auth token, setting on Convex client");
    convexClient.setAuth(token);

    const body = await req.json();
    const { prompt, threadId: providedThreadId, storageId } = body;

    console.log("[stream-v2] Request received:", {
      promptLength: prompt?.length || 0,
      hasPrompt: !!prompt,
      hasStorageId: !!storageId,
      providedThreadId,
    });

    debug.log("CONVEX_MUTATION_START", { mutation: "getOrCreateDailyThread" });

    // 1. Get or create thread (simplified)
    let threadResult;
    try {
      threadResult = await convexClient.mutation(
        api.threads.getOrCreateDailyThread,
        {},
      );
      debug.log("CONVEX_MUTATION_SUCCESS", {
        mutation: "getOrCreateDailyThread",
        threadId: threadResult.threadId,
      });
    } catch (error: any) {
      debug.error("CONVEX_MUTATION_ERROR", {
        mutation: "getOrCreateDailyThread",
        error: error.message,
      });
      throw error;
    }

    const threadId = providedThreadId || threadResult.threadId;

    debug.log("CONVEX_MUTATION_START", {
      mutation: "saveMessage",
      role: "user",
    });

    // 2. Save user message (embedding is handled by threads.saveMessage)
    let userMessageId;
    try {
      userMessageId = await convexClient.mutation(api.threads.saveMessage, {
        threadId,
        role: "user",
        content: prompt,
        metadata: {
          storageId: storageId || undefined,
        },
      });
      debug.log("CONVEX_MUTATION_SUCCESS", {
        mutation: "saveMessage",
        messageId: userMessageId,
      });
    } catch (error: any) {
      debug.error("CONVEX_MUTATION_ERROR", {
        mutation: "saveMessage",
        error: error.message,
      });
      throw error;
    }

    // 3. Get daily summary and other context in parallel
    console.log("[stream-v2] Fetching context data for thread:", threadId);

    let dailySummary,
      preferences,
      pendingConfirmation,
      threadMessages,
      threadSummaries,
      calibrationData,
      todayFoodLogs,
      dietaryPreferences;

    try {
      [
        dailySummary,
        preferences,
        pendingConfirmation,
        threadMessages,
        threadSummaries,
        calibrationData,
        todayFoodLogs,
        dietaryPreferences,
      ] = await Promise.all([
        // Daily summary (includes profile, stats, yesterday summary)
        convexClient.query(api.dailySummary.getDailySummary, {}),
        // User preferences
        convexClient.query(api.userPreferences.getUserPreferences, {}),
        // Pending confirmations - needs to be real-time
        convexClient.query(
          api.pendingConfirmations.getLatestPendingConfirmation,
          {
            threadId,
          },
        ),
        // Get recent messages - needs to be real-time
        convexClient.query(api.threads.getThreadMessages, {
          threadId,
          limit: 5, // Only recent messages, summaries will provide older context
        }),
        // Get thread summaries - needs to be real-time
        convexClient.query(api.threads.getThreadSummaries, {
          threadId,
        }),
        // Calibration insights
        convexClient.query(api.calibration.getLatestCalibration, {}),
        // Get today's actual food logs - needs to be real-time for confirmations
        convexClient.query(api.foodLogs.getTodayLogs, {}),
        // Get dietary preferences
        convexClient.query(
          api.dietaryPreferences.getUserDietaryPreferences,
          {},
        ),
      ]);
    } catch (queryError: any) {
      console.error("[stream-v2] Error fetching context data:", queryError);
      console.error("[stream-v2] Query error details:", {
        message: queryError.message,
        stack: queryError.stack,
        name: queryError.name,
      });
      throw new Error(`Failed to fetch context data: ${queryError.message}`);
    }

    // Build coreStats from daily summary
    const coreStats = {
      profile: dailySummary?.profile || {
        name: "there",
        dailyCalorieTarget: 2000,
        proteinTarget: 150,
      },
      todayStats: dailySummary?.today.stats || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        mealsLogged: 0,
      },
      hasWeighedToday: dailySummary?.today.hasWeighedIn || false,
      caloriesRemaining: dailySummary?.today.remaining?.calories || 2000,
      todaySummary: dailySummary?.today.summary || "",
      todayFoodLogs: dailySummary?.today.foodLogs || [],
      yesterdayTotal: dailySummary?.yesterday.total || "",
    };

    // 4. Get meal type
    const hour = new Date().getHours();
    const defaultMealType =
      hour < 11
        ? "breakfast"
        : hour < 15
          ? "lunch"
          : hour < 18
            ? "snack"
            : "dinner";

    // 5. Build system prompt using centralized prompts
    const promptContext = buildPromptContext(
      coreStats.profile,
      coreStats.todayStats,
      preferences,
      calibrationData,
      pendingConfirmation
        ? {
            description: pendingConfirmation.confirmationData.description,
            totalCalories: pendingConfirmation.confirmationData.totalCalories,
            items: pendingConfirmation.confirmationData.items,
          }
        : undefined,
      coreStats.todaySummary,
      coreStats.yesterdayTotal,
      coreStats.hasWeighedToday,
      todayFoodLogs,
      dailySummary?.achievement,
      dietaryPreferences,
    );

    // 6. Detect intents for tool selection only
    const intents = detectIntent(prompt);

    // Always use the consolidated prompt
    let systemPrompt = getBobSystemPrompt(promptContext);

    // Add photo analysis instruction if storageId is present
    if (storageId) {
      systemPrompt = `${systemPrompt}\n\nThe user has uploaded a food photo. Use the analyzeAndConfirmPhoto tool to analyze it and ask for confirmation in one step. This is faster and more efficient than calling separate tools.`;

      console.log(
        "[stream-v2] Photo upload detected with storageId:",
        storageId,
      );
    }

    console.log("[stream-v2] Prompt info:", {
      promptLength: systemPrompt.length,
      intents,
      userPrompt: prompt,
      hasDietaryPreferences: !!dietaryPreferences,
    });

    // 7. Create tools based on intent
    debug.log("TOOLS_CREATE_START", { intents });

    let tools;
    let toolsNeeded;
    try {
      // Only load tools if needed based on intent
      toolsNeeded = getToolsForIntent(intents, !!pendingConfirmation);

      // Pass tool selection to createTools for selective loading
      tools = createTools(
        convexClient,
        userId,
        threadId,
        storageId,
        pendingConfirmation,
        toolsNeeded, // Pass the selection
      );

      debug.log("TOOLS_CREATE_SUCCESS", { toolNames: Object.keys(tools) });
    } catch (error: any) {
      debug.error("TOOLS_CREATE_ERROR", { error: error.message });
      throw error;
    }

    console.log("[stream-v2] Tool selection:", {
      intents,
      toolsNeeded,
      loadedTools: Object.keys(tools),
      toolCount: Object.keys(tools).length,
    });

    // 7. Stream response
    // Collect toolCalls during streaming to ensure they're saved
    const collectedToolCalls: any[] = [];

    try {
      // Prepare messages first - only recent messages, NO system messages
      let messages = [];

      // Add recent messages - LIMIT TO LAST 10 to prevent token explosion
      if (threadMessages.length > 0) {
        const recentMessages = threadMessages
          .filter((m: any) => {
            // Filter out messages with content
            if (!m.content || !m.content.trim()) return false;

            // IMPORTANT: Filter out any messages that contain confirmFood toolCalls
            // This prevents Bob from seeing previous confirmations and auto-confirming
            if (
              m.toolCalls &&
              m.toolCalls.some((tc: any) => tc.toolName === "confirmFood")
            ) {
              console.log(
                "[stream-v2] Filtering out confirmFood message from context:",
                {
                  role: m.role,
                  contentPreview: m.content.substring(0, 50) + "...",
                },
              );
              return false;
            }

            return true;
          })
          .slice(-10) // Take only last 10 messages
          .map((m: any) => ({
            role: m.role as "user" | "assistant",
            content: m.content.trim(),
          }));
        messages = recentMessages;
      }

      // Ensure we have at least one message
      if (messages.length === 0) {
        messages = [
          {
            role: "user" as const,
            content: prompt || "Hello",
          },
        ];
      }

      console.log("[stream-v2] Starting stream with:", {
        hasTools: Object.keys(tools).length > 0,
        toolNames: Object.keys(tools),
        messagesCount: messages.length,
        systemPromptLength: systemPrompt.length,
        hasStorageId: !!storageId,
        hasDietaryPreferences: !!dietaryPreferences,
      });

      // Log the actual messages being sent
      console.log("[stream-v2] Thread messages from query:", {
        totalFromQuery: threadMessages.length,
        afterFilter: messages.length,
        preview: threadMessages.slice(-3).map((m: any) => ({
          role: m.role,
          contentPreview: m.content?.substring(0, 50) + "...",
        })),
      });

      // Add summaries to system prompt if they exist
      if (threadSummaries && threadSummaries.length > 0) {
        const summaryContext = threadSummaries
          .map(
            (s: any) =>
              `${s.summary} (${s.foodsLogged} foods, ${s.caloriesTotal}cal)`,
          )
          .join("; ");

        systemPrompt = `${systemPrompt}\n\nPrevious context: ${summaryContext}`;
      }

      console.log("[stream-v2] Prepared messages:", {
        total: messages.length,
        summaries: threadSummaries?.length || 0,
        recent: threadMessages.length,
        systemPromptLength: systemPrompt.length,
        firstMessage: messages[0]?.content?.substring(0, 100),
        lastMessage: messages[messages.length - 1]?.content?.substring(0, 100),
      });

      // Rough token estimation (1 token ≈ 4 characters)
      const estimatedTokens = {
        systemPrompt: Math.ceil(systemPrompt.length / 4),
        messages: messages.reduce(
          (sum, m) => sum + Math.ceil(m.content.length / 4),
          0,
        ),
        tools: Object.keys(tools).length * 100, // Rough estimate per tool
        total: 0,
      };
      estimatedTokens.total =
        estimatedTokens.systemPrompt +
        estimatedTokens.messages +
        estimatedTokens.tools;

      console.log("[stream-v2] Final request config:", {
        model: "claude-sonnet-4-20250514",
        systemPromptLength: systemPrompt.length,
        systemPromptPreview: systemPrompt.substring(0, 200) + "...",
        messageCount: messages.length,
        hasTools: Object.keys(tools).length > 0,
        messages: messages
          .slice(-3)
          .map((m) => ({ role: m.role, preview: m.content.substring(0, 50) })),
        estimatedTokens,
      });

      let result;
      try {
        result = streamText({
          model: anthropic("claude-sonnet-4-20250514"),
          system: systemPrompt,
          messages,
          tools: Object.keys(tools).length > 0 ? tools : undefined,
          maxSteps: 5, // Allow complex multi-tool workflows
          toolChoice: undefined, // Let AI decide which tools to use
          onChunk: ({ chunk }) => {
            debug.log("CHUNK", {
              type: chunk.type,
              content:
                chunk.type === "text-delta"
                  ? (chunk as any).text?.substring(0, 50)
                  : undefined,
            });

            if (chunk.type === "error") {
              debug.error("CHUNK_ERROR", {
                chunk,
                error: chunk.error,
                message: "Vercel AI SDK generated an error chunk",
              });
              // Log but don't panic - we filter these out in the stream
            } else if (chunk.type === "tool-call") {
              // Handle tool call chunks
              const toolCallChunk = chunk as any;
              if (toolCallChunk.toolCallId && toolCallChunk.toolName) {
                console.log("[stream-v2] Tool call chunk received:", {
                  toolCallId: toolCallChunk.toolCallId,
                  toolName: toolCallChunk.toolName,
                  hasArgs: !!toolCallChunk.args,
                });

                // Collect the tool call
                collectedToolCalls.push({
                  toolCallId: toolCallChunk.toolCallId,
                  toolName: toolCallChunk.toolName,
                  args: toolCallChunk.args || {},
                });
              }
            } else if (
              chunk.type === "tool-result" &&
              (chunk as any).toolCallId &&
              (chunk as any).result
            ) {
              // Handle tool results for analyzeAndConfirmPhoto
              const toolCallId = (chunk as any).toolCallId;
              const result = (chunk as any).result;

              // Find the matching tool call and update it with the result
              const toolCallIndex = collectedToolCalls.findIndex(
                (tc) => tc.toolCallId === toolCallId,
              );
              if (toolCallIndex !== -1) {
                const toolCall = collectedToolCalls[toolCallIndex];

                // For analyzeAndConfirmPhoto, merge the result into args
                if (toolCall.toolName === "analyzeAndConfirmPhoto" && result) {
                  console.log(
                    "[stream-v2] Merging analyzeAndConfirmPhoto result into args",
                  );
                  collectedToolCalls[toolCallIndex] = {
                    ...toolCall,
                    args: {
                      ...toolCall.args,
                      ...result,
                    },
                  };
                }
              }
            }
          },
          onToolCall: async ({ toolCall }) => {
            debug.log("TOOL_CALL", {
              toolName: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              args: toolCall.args,
            });

            console.log("[stream-v2] Tool called:", {
              toolName: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              hasArgs: !!toolCall.args,
              argsPreview: JSON.stringify(toolCall.args).substring(0, 100),
            });

            // Collect tool calls to ensure they're saved
            collectedToolCalls.push({
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: toolCall.args,
            });
          },
          onFinish: async ({ text, toolCalls, usage, finishReason }: any) => {
            debug.log("STREAM_FINISH", {
              hasText: !!text,
              textLength: text?.length,
              toolCallsCount: toolCalls?.length,
              finishReason,
            });

            try {
              // Use collected toolCalls if onFinish doesn't provide them
              const finalToolCalls =
                toolCalls && toolCalls.length > 0
                  ? toolCalls
                  : collectedToolCalls;

              console.log("[stream-v2] Stream finished:", {
                hasText: !!text,
                textLength: text?.length,
                toolCallsCount: finalToolCalls?.length,
                toolCallDetails: finalToolCalls?.map((tc) => ({
                  toolName: tc.toolName,
                  hasArgs: !!tc.args,
                  argsKeys: tc.args ? Object.keys(tc.args) : [],
                })),
                finishReason,
                collectedDuringStream: collectedToolCalls.length,
                receivedInOnFinish: toolCalls?.length || 0,
              });

              // Save assistant message if there's content OR tool calls
              if (
                (text && text.trim().length > 0) ||
                (finalToolCalls && finalToolCalls.length > 0)
              ) {
                // Check if any tool calls resulted in food logs
                let foodLogId = undefined;
                if (finalToolCalls && finalToolCalls.length > 0) {
                  const logFoodCall = finalToolCalls.find(
                    (tc) => tc.toolName === "logFood",
                  );
                  if (logFoodCall && logFoodCall.result?.logId) {
                    foodLogId = logFoodCall.result.logId;
                    console.log("[stream-v2] Food logged with ID:", foodLogId);
                  }
                }

                // Generate confirmation IDs and metadata for confirmation tool calls
                const confirmationIds: Record<string, string> = {};
                const confirmationMetadata: Record<string, any> = {};
                const now = Date.now();

                if (finalToolCalls && finalToolCalls.length > 0) {
                  finalToolCalls.forEach((tc, index) => {
                    if (
                      tc.toolName === "confirmFood" ||
                      tc.toolName === "analyzeAndConfirmPhoto"
                    ) {
                      // Generate confirmation ID using the same logic as the client
                      let timestamp = "";
                      if (tc.toolCallId && tc.toolCallId.includes("_")) {
                        const parts = tc.toolCallId.split("_");
                        if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
                          timestamp = parts[1];
                        }
                      }

                      // Use current timestamp as fallback if no timestamp in toolCallId
                      if (!timestamp) {
                        timestamp = now.toString();
                      }

                      const confirmId = `confirm-${timestamp}`;
                      confirmationIds[tc.toolCallId] = confirmId;

                      // Store additional metadata for robustness
                      confirmationMetadata[tc.toolCallId] = {
                        confirmId,
                        toolName: tc.toolName,
                        createdAt: now,
                        foodDescription:
                          tc.args?.description ||
                          tc.args?.items
                            ?.map((item: any) => item.name)
                            .join(", "),
                      };

                      console.log(
                        "[stream-v2] Generated confirmation ID with metadata:",
                        {
                          toolCallId: tc.toolCallId,
                          confirmId,
                          toolName: tc.toolName,
                          createdAt: now,
                        },
                      );
                    }
                  });
                }

                console.log(
                  "[stream-v2] Saving assistant message with toolCalls:",
                  {
                    hasToolCalls: !!finalToolCalls && finalToolCalls.length > 0,
                    toolCallCount: finalToolCalls?.length || 0,
                    toolNames: finalToolCalls?.map((tc) => tc.toolName) || [],
                    hasText: !!text && text.trim().length > 0,
                    textLength: text?.trim().length || 0,
                    usingCollected:
                      collectedToolCalls.length > 0 &&
                      (!toolCalls || toolCalls.length === 0),
                    confirmationIds:
                      Object.keys(confirmationIds).length > 0
                        ? confirmationIds
                        : undefined,
                    confirmationMetadata:
                      Object.keys(confirmationMetadata).length > 0
                        ? confirmationMetadata
                        : undefined,
                  },
                );

                await convexClient.mutation(api.threads.saveMessage, {
                  threadId,
                  role: "assistant",
                  content: text || "", // Use empty string if no text
                  toolCalls: finalToolCalls || [],
                  metadata: {
                    foodLogId,
                    confirmationIds:
                      Object.keys(confirmationIds).length > 0
                        ? confirmationIds
                        : undefined,
                    confirmationMetadata:
                      Object.keys(confirmationMetadata).length > 0
                        ? confirmationMetadata
                        : undefined,
                    usage: usage
                      ? {
                          promptTokens: usage.promptTokens || 0,
                          completionTokens: usage.completionTokens || 0,
                          totalTokens: usage.totalTokens || 0,
                        }
                      : undefined,
                  },
                });

                // Trigger summarization check (async, don't wait)
                convexClient
                  .action(api.threads.checkAndSummarize, { threadId })
                  .catch((error) =>
                    console.error(
                      "[stream-v2] Summarization check failed:",
                      error,
                    ),
                  );
              } else {
                // No text and no tool calls - this is unexpected
                console.warn(
                  "[stream-v2] Stream finished with no content or tool calls",
                );
              }
            } catch (saveError: any) {
              console.error(
                "[stream-v2] Error saving message in onFinish:",
                saveError,
              );
              console.error("[stream-v2] Save error details:", {
                message: saveError.message,
                stack: saveError.stack,
              });
              // Don't throw - let the stream complete successfully
            }
          },
        });
      } catch (streamTextError: any) {
        console.error("[stream-v2] Error calling streamText:", streamTextError);
        console.error("[stream-v2] streamText error details:", {
          message: streamTextError.message,
          stack: streamTextError.stack,
          name: streamTextError.name,
          code: streamTextError.code,
        });

        // Don't throw - create a proper error response
        const encoder = new TextEncoder();
        const errorStream = new ReadableStream({
          start(controller) {
            // Send initial text explaining the error
            controller.enqueue(
              encoder.encode(
                `0:"I encountered an error processing your request. "\\n`,
              ),
            );
            controller.enqueue(
              encoder.encode(`0:"Please try again in a moment."\\n`),
            );
            controller.close();
          },
        });

        return new Response(errorStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      console.log("[stream-v2] Stream created successfully");
      console.log("[stream-v2] Result type:", typeof result);
      console.log(
        "[stream-v2] Result has toDataStreamResponse:",
        typeof result.toDataStreamResponse,
      );

      try {
        // Get the response but intercept the stream
        const baseResponse = result.toDataStreamResponse();
        console.log("[stream-v2] Got base response, intercepting stream");

        if (!baseResponse.body) {
          throw new Error("No response body to filter");
        }

        // Create a new response with filtered stream
        const reader = baseResponse.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();

        console.log("[stream-v2] Creating filtered stream");
        const filteredStream = new ReadableStream({
          async start(controller) {
            let buffer = "";

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                  // Skip empty lines in the middle of processing
                  if (!line && buffer) continue;

                  // Parse SSE format more robustly
                  if (line.startsWith("0:")) {
                    // Text chunk - always pass through
                    controller.enqueue(encoder.encode(line + "\n"));
                  } else if (line.startsWith("1:")) {
                    // Function call chunk - pass through
                    controller.enqueue(encoder.encode(line + "\n"));
                  } else if (line.startsWith("2:")) {
                    // Function result chunk - pass through
                    controller.enqueue(encoder.encode(line + "\n"));
                  } else if (line.startsWith("3:")) {
                    // Error chunk - filter carefully
                    const errorContent = line.substring(2);
                    try {
                      const errorData = JSON.parse(errorContent);
                      // Only filter out empty or generic errors
                      if (
                        !errorData ||
                        errorData === "An error occurred" ||
                        errorData === "An error occurred." ||
                        errorData === ""
                      ) {
                        console.log("[stream-v2] Filtering out generic error");
                        continue;
                      }
                    } catch (e) {
                      // If we can't parse it, it might be a real error
                    }
                    // Pass through real errors
                    controller.enqueue(encoder.encode(line + "\n"));
                  } else if (
                    line.startsWith("4:") ||
                    line.startsWith("5:") ||
                    line.startsWith("6:")
                  ) {
                    // Tool-related chunks - pass through
                    controller.enqueue(encoder.encode(line + "\n"));
                  } else if (line.startsWith("7:")) {
                    // Roundtrip info - pass through
                    controller.enqueue(encoder.encode(line + "\n"));
                  } else if (line.startsWith("8:")) {
                    // Finish chunk - pass through
                    controller.enqueue(encoder.encode(line + "\n"));
                  } else if (line.trim()) {
                    // Any other non-empty line - pass through
                    controller.enqueue(encoder.encode(line + "\n"));
                  } else {
                    // Empty line - preserve for SSE format
                    controller.enqueue(encoder.encode("\n"));
                  }
                }
              }

              // Handle any remaining buffer
              if (buffer.trim() && !buffer.startsWith("3:")) {
                controller.enqueue(encoder.encode(buffer));
              }
            } catch (error) {
              console.error("[stream-v2] Stream filter error:", error);
              controller.error(error);
            } finally {
              controller.close();
            }
          },
        });

        // Log the final debug dump
        const debugDump = debug.getDump();
        console.log("[stream-v2] Debug summary:", {
          totalTime: debugDump.totalTime,
          chunkTypes: debugDump.logs
            .filter((l) => l.type === "CHUNK")
            .map((l) => l.data.type),
          errorCount: debugDump.logs.filter((l) => l.type.includes("ERROR"))
            .length,
          toolCalls: debugDump.logs
            .filter((l) => l.type === "TOOL_CALL_START")
            .map((l) => l.data.toolName),
        });

        return new Response(filteredStream, {
          headers: baseResponse.headers,
        });
      } catch (responseError: any) {
        console.error("[stream-v2] Error creating response:", responseError);
        throw responseError;
      }
    } catch (streamError: any) {
      console.error("[stream-v2] Stream error:", streamError);
      console.error("[stream-v2] Stream error details:", {
        name: streamError.name,
        message: streamError.message,
        stack: streamError.stack,
        cause: streamError.cause,
      });

      // Try to provide more specific error info
      if (streamError.message?.includes("model")) {
        console.error(
          "[stream-v2] Model error - check if claude-sonnet-4-20250514 is available",
        );
      }
      if (streamError.response?.data) {
        console.error(
          "[stream-v2] API response data:",
          streamError.response.data,
        );
      }

      // Don't throw, return error response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const errorData = JSON.stringify(
            "Failed to process your request. Please try again.",
          );
          controller.enqueue(encoder.encode(`3:${errorData}\n`));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Connection: "keep-alive",
        },
      });
    }
  } catch (error: any) {
    // Log the debug dump to see where we failed
    const debugDump = debug.getDump();
    console.error(
      "[Chat Stream V2] Failed at stage:",
      debugDump.logs[debugDump.logs.length - 1],
    );
    console.error(
      "[Chat Stream V2] Debug trace:",
      debugDump.logs.map((l) => `${l.type}@${l.timestamp}ms`).join(" -> "),
    );

    console.error("[Chat Stream V2] Outer catch - Error:", error.message);
    console.error("[Chat Stream V2] Outer catch - Full error:", error);
    console.error("[Chat Stream V2] Outer catch - Stack trace:", error.stack);
    console.error("[Chat Stream V2] Outer catch - Error name:", error.name);
    console.error(
      "[Chat Stream V2] Outer catch - Error constructor:",
      error.constructor.name,
    );

    // Provide more specific error messages
    let errorMessage = error.message || "An error occurred";
    console.error("[Chat Stream V2] Sending error to client:", errorMessage);

    // Log specific error details
    if (error.response) {
      console.error("[Chat Stream V2] Response error:", error.response);
    }
    if (error.code) {
      console.error("[Chat Stream V2] Error code:", error.code);
    }

    // Return error in proper format
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send the error in the correct SSE format
        const errorData = JSON.stringify(errorMessage);
        controller.enqueue(encoder.encode(`3:${errorData}\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
}
