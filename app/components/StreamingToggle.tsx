"use client";

import { useEffect, useState } from "react";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";

export function StreamingToggle() {
  const [useNewStreaming, setUseNewStreaming] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("useNewStreaming") === "true";
    setUseNewStreaming(stored);
  }, []);

  const handleToggle = (checked: boolean) => {
    setUseNewStreaming(checked);
    localStorage.setItem("useNewStreaming", checked.toString());
    // Optionally reload to ensure clean state
    if (confirm("Reload page to apply changes?")) {
      window.location.reload();
    }
  };

  return (
    <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/50">
      <Switch
        id="streaming-mode"
        checked={useNewStreaming}
        onCheckedChange={handleToggle}
      />
      <Label htmlFor="streaming-mode" className="cursor-pointer">
        <div>
          <div className="font-medium">
            {useNewStreaming
              ? "New Streaming (Vercel-Only)"
              : "Current System (Hybrid)"}
          </div>
          <div className="text-sm text-muted-foreground">
            {useNewStreaming
              ? "Simplified architecture with same features"
              : "Convex Agent + Vercel streaming"}
          </div>
        </div>
      </Label>
    </div>
  );
}
