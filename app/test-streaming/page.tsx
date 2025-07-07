"use client";

import { useState } from "react";
import { Button } from "~/app/components/ui/button";
import { useAuth } from "@clerk/nextjs";

export default function TestStreaming() {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<string[]>([]);
  const [rawOutput, setRawOutput] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [testResults, setTestResults] = useState<any>({});

  // Test Anthropic API directly
  const testAnthropicApi = async () => {
    setMessages(["Testing Anthropic API..."]);
    try {
      const response = await fetch("/api/chat/test-anthropic");
      const data = await response.json();
      setTestResults((prev) => ({ ...prev, anthropic: data }));
      setMessages((prev) => [
        ...prev,
        `Anthropic API Test: ${JSON.stringify(data, null, 2)}`,
      ]);
    } catch (error: any) {
      setTestResults((prev) => ({
        ...prev,
        anthropic: { error: error.message },
      }));
      setMessages((prev) => [...prev, `Anthropic API Error: ${error.message}`]);
    }
  };

  const testDebugStream = async () => {
    setIsStreaming(true);
    setMessages([`Testing debug stream endpoint...`]);
    setRawOutput("");

    try {
      const token = await getToken();

      const response = await fetch("/api/chat/stream-debug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: "I had a banana for breakfast",
        }),
      });

      console.log("Debug Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText}`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let fullOutput = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setMessages((prev) => [...prev, "Stream completed!"]);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        fullOutput += chunk;
        setRawOutput(fullOutput);

        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          console.log("Debug line:", trimmedLine);
          setMessages((prev) => [...prev, `Debug: ${trimmedLine}`]);
        }
      }
    } catch (error: any) {
      console.error("Debug streaming error:", error);
      setMessages((prev) => [...prev, `Error: ${error.message}`]);
    } finally {
      setIsStreaming(false);
    }
  };

  const testStreaming = async (disableTools: boolean = false) => {
    setIsStreaming(true);
    setMessages([
      `Starting streaming test (tools ${disableTools ? "disabled" : "enabled"})...`,
    ]);
    setRawOutput("");

    try {
      const token = await getToken();

      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: "What is 2+2? Answer in exactly 5 words.",
          threadId: `test_${Date.now()}`,
          disableTools: disableTools,
        }),
      });

      console.log("Response status:", response.status);
      console.log(
        "Response headers:",
        Object.fromEntries(response.headers.entries()),
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText}`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let fullOutput = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setMessages((prev) => [...prev, "Stream completed!"]);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        fullOutput += chunk;
        setRawOutput(fullOutput);

        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          console.log("Processing line:", trimmedLine);
          setMessages((prev) => [...prev, `Raw line: ${trimmedLine}`]);

          // Parse Vercel AI SDK format
          const colonIndex = trimmedLine.indexOf(":");
          if (colonIndex !== -1) {
            const eventType = trimmedLine.substring(0, colonIndex);
            const jsonData = trimmedLine.substring(colonIndex + 1);

            setMessages((prev) => [
              ...prev,
              `Event type: ${eventType}, Data: ${jsonData}`,
            ]);

            if (
              eventType === "3" &&
              jsonData.startsWith('"') &&
              jsonData.endsWith('"')
            ) {
              // Error message
              const errorMsg = JSON.parse(jsonData);
              setMessages((prev) => [...prev, `ERROR: ${errorMsg}`]);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Streaming error:", error);
      setMessages((prev) => [...prev, `Error: ${error.message}`]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Streaming Debug Tests</h1>

      <div className="space-y-4">
        <div className="flex gap-4 flex-wrap">
          <Button onClick={testAnthropicApi} disabled={isStreaming}>
            Test Anthropic API
          </Button>

          <Button onClick={() => testStreaming(true)} disabled={isStreaming}>
            Test Stream (No Tools)
          </Button>

          <Button onClick={() => testStreaming(false)} disabled={isStreaming}>
            Test Stream (With Tools)
          </Button>

          <Button
            onClick={testDebugStream}
            disabled={isStreaming}
            className="bg-yellow-600"
          >
            Test Debug Stream
          </Button>
        </div>

        {testResults.anthropic && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
            <h3 className="font-semibold mb-2">Anthropic API Test Result:</h3>
            <pre className="text-sm">
              {JSON.stringify(testResults.anthropic, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <h2 className="text-lg font-semibold">Stream Messages:</h2>
          {messages.map((msg, idx) => (
            <div key={idx} className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
              <pre className="text-sm whitespace-pre-wrap">{msg}</pre>
            </div>
          ))}
        </div>

        {rawOutput && (
          <div className="mt-4">
            <h2 className="text-lg font-semibold">Raw Output:</h2>
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
              <pre className="text-sm whitespace-pre-wrap">{rawOutput}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
