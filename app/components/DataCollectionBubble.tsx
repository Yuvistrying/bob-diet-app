"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "~/app/components/ui/button";
import { Input } from "~/app/components/ui/input";
import { cn } from "~/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DataCollectionBubbleProps {
  type: "text" | "number" | "weight" | "select" | "date";
  question: string;
  placeholder?: string;
  options?: string[];
  unit?: "kg" | "lbs";
  onSubmit: (value: any) => void;
  isDisabled?: boolean;
  minimized?: boolean;
  submittedValue?: any;
}

export function DataCollectionBubble({
  type,
  question,
  placeholder,
  options = [],
  unit: initialUnit = "kg",
  onSubmit,
  isDisabled = false,
  minimized = false,
  submittedValue
}: DataCollectionBubbleProps) {
  const [value, setValue] = useState("");
  const [selectedUnit, setSelectedUnit] = useState(initialUnit);
  const [showOptions, setShowOptions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (!minimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [minimized]);

  const handleSubmit = () => {
    if (!value.trim() && type !== "select") return;
    
    let submissionValue: any = value;
    
    if (type === "weight") {
      submissionValue = {
        weight: parseFloat(value),
        unit: selectedUnit
      };
    } else if (type === "number") {
      submissionValue = parseFloat(value);
    } else if (type === "date") {
      submissionValue = value; // Expecting YYYY-MM-DD format
    }
    
    onSubmit(submissionValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  // Minimized state - show the submitted answer
  if (minimized && submittedValue !== undefined) {
    return (
      <div className="max-w-[80%] px-4 py-2 rounded-2xl border border-border bg-muted/50">
        <div className="text-sm text-muted-foreground">{question}</div>
        <div className="text-sm font-medium text-foreground mt-1">
          {type === "weight" ? `${submittedValue.weight} ${submittedValue.unit}` : submittedValue}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-[80%] px-4 py-3 rounded-2xl border border-border bg-card"
    >
      <div className="text-sm text-foreground mb-3">{question}</div>
      
      {type === "text" && (
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder || "Type your answer"}
            className="flex-1 h-9 text-sm"
            disabled={isDisabled}
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!value.trim() || isDisabled}
            className="h-9"
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {type === "number" && (
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder || "Enter number"}
            className="flex-1 h-9 text-sm"
            disabled={isDisabled}
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!value || isDisabled}
            className="h-9"
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {type === "weight" && (
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="number"
            step="0.1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Weight"
            className="flex-1 h-9 text-sm"
            disabled={isDisabled}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedUnit(selectedUnit === "kg" ? "lbs" : "kg")}
            className="h-9 min-w-[60px]"
          >
            {selectedUnit}
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!value || isDisabled}
            className="h-9"
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {type === "select" && (
        <div className="space-y-2">
          {options.map((option) => (
            <Button
              key={option}
              variant="outline"
              size="sm"
              onClick={() => onSubmit(option)}
              disabled={isDisabled}
              className="w-full h-9 justify-start text-sm"
            >
              {option}
            </Button>
          ))}
        </div>
      )}
      
      {type === "date" && (
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 h-9 text-sm"
            disabled={isDisabled}
            max={new Date().toISOString().split('T')[0]}
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!value || isDisabled}
            className="h-9"
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}