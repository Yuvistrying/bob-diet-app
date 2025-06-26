"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "~/lib/utils";
import { Camera, ChevronDown, X } from "lucide-react";
import { designTokens } from "~/app/design-system/tokens";
import { useIOSKeyboard, useHapticFeedback, useSafeAreaInsets } from "~/app/design-system/hooks";

interface ChatInterfaceProps {
  messages: any[];
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isStreaming: boolean;
  selectedImage: File | null;
  imagePreview: string | null;
  onImageSelect: (file: File) => void;
  onImageClear: () => void;
  onScrollToBottom?: () => void;
  showScrollToBottom?: boolean;
}

export function ChatInterface({
  messages,
  input,
  setInput,
  onSubmit,
  isStreaming,
  selectedImage,
  imagePreview,
  onImageSelect,
  onImageClear,
  onScrollToBottom,
  showScrollToBottom
}: ChatInterfaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { keyboardHeight, isKeyboardVisible } = useIOSKeyboard();
  const { triggerHaptic } = useHapticFeedback();
  const safeAreaInsets = useSafeAreaInsets();
  
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelect(file);
      triggerHaptic('light');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isStreaming) return;
    triggerHaptic('medium');
    onSubmit(e);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat Messages Area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto ios-scroll px-4 pb-2"
        style={{ 
          paddingTop: safeAreaInsets.top,
          paddingBottom: isKeyboardVisible ? 8 : safeAreaInsets.bottom + 72
        }}
      >
        <div className="max-w-content mx-auto space-y-3">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-chat-bubble px-4 py-2.5 rounded-[18px]",
                  message.role === "user" 
                    ? "bg-accent text-white rounded-br-[4px]" 
                    : "bg-background-elevated text-foreground rounded-bl-[4px]"
                )}
              >
                <div className="text-body">{message.content}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollToBottom && (
        <button
          onClick={() => {
            onScrollToBottom?.();
            triggerHaptic('light');
          }}
          className="absolute bottom-24 right-4 w-10 h-10 bg-background-elevated rounded-full shadow-lg flex items-center justify-center ios-button"
        >
          <ChevronDown className="w-5 h-5 text-foreground-secondary" />
        </button>
      )}

      {/* Input Bar */}
      <div 
        className="border-t border-separator bg-background-secondary"
        style={{ 
          paddingBottom: isKeyboardVisible ? 8 : safeAreaInsets.bottom,
          marginBottom: keyboardHeight
        }}
      >
        <form onSubmit={handleSubmit} className="px-4 py-3">
          {/* Image Preview */}
          {imagePreview && (
            <div className="mb-3 relative inline-block">
              <img
                src={imagePreview}
                alt="Selected"
                className="h-20 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  onImageClear();
                  triggerHaptic('light');
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-background-elevated rounded-full flex items-center justify-center shadow-sm ios-button"
              >
                <X className="w-3.5 h-3.5 text-foreground-secondary" />
              </button>
            </div>
          )}
          
          <div className="flex items-center gap-3">
            {/* Camera Button */}
            <button
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
                triggerHaptic('light');
              }}
              className="w-9 h-9 flex items-center justify-center rounded-full ios-button"
            >
              <Camera className="w-5 h-5 text-foreground-secondary" />
            </button>
            
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />
            
            {/* Text Input */}
            <div className="flex-1 relative">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message"
                className={cn(
                  "w-full h-9 bg-background-elevated rounded-full px-4 pr-12",
                  "text-body placeholder:text-foreground-tertiary text-foreground",
                  "border-0 outline-none ios-input"
                )}
                disabled={isStreaming}
              />
              
              {/* Send Button */}
              <button
                type="submit"
                disabled={(!input.trim() && !selectedImage) || isStreaming}
                className={cn(
                  "absolute right-1 top-1/2 -translate-y-1/2",
                  "w-7 h-7 rounded-full flex items-center justify-center",
                  "transition-all duration-200 ios-button",
                  (!input.trim() && !selectedImage) || isStreaming
                    ? "bg-foreground-tertiary/20"
                    : "bg-accent"
                )}
              >
                <svg 
                  className={cn(
                    "w-4 h-4",
                    (!input.trim() && !selectedImage) || isStreaming
                      ? "text-foreground-tertiary"
                      : "text-white"
                  )}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}