"use client";

import { cn } from "~/lib/utils";
import { Settings, MessageSquarePlus } from "lucide-react";
import { designTokens } from "~/app/design-system/tokens";
import { useHapticFeedback } from "~/app/design-system/hooks";

interface NavigationBarProps {
  userName?: string;
  onNewChat?: () => void;
  onSettings?: () => void;
  isStreaming?: boolean;
}

export function NavigationBar({
  userName = "Bob",
  onNewChat,
  onSettings,
  isStreaming = false
}: NavigationBarProps) {
  const { triggerHaptic } = useHapticFeedback();

  return (
    <div className="nav-blur border-b border-separator">
      <div className="h-nav flex items-center justify-between px-4">
        {/* Left - Settings */}
        <button
          onClick={() => {
            onSettings?.();
            triggerHaptic('light');
          }}
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full ios-button"
        >
          <Settings className="w-5 h-5 text-foreground" />
        </button>

        {/* Center - Title */}
        <div className="flex-1 flex items-center justify-center gap-3 ml-4">
          <img src="/logo.svg" alt="Bob" className="h-[60px] w-[60px]" />
          <h1 className="text-body font-semibold text-foreground">
            {userName}
          </h1>
        </div>

        {/* Right - New Chat */}
        <button
          onClick={() => {
            if (!isStreaming) {
              onNewChat?.();
              triggerHaptic('light');
            }
          }}
          disabled={isStreaming}
          className={cn(
            "w-11 h-11 -mr-2 flex items-center justify-center rounded-full ios-button",
            isStreaming && "opacity-50"
          )}
        >
          <MessageSquarePlus className="w-5 h-5 text-foreground" />
        </button>
      </div>
    </div>
  );
}