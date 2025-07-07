import { Button } from "~/app/components/ui/button";
import { Input } from "~/app/components/ui/input";
import { useState } from "react";
import { DietaryPreferencesCard } from "~/app/components/DietaryPreferencesCard";

interface QuickResponseOption {
  label: string;
  value: string;
  icon?: string;
}

interface OnboardingQuickResponsesProps {
  step: string;
  onSelect: (value: string) => void;
  isLoading: boolean;
  currentInput?: string;
}

export function OnboardingQuickResponses({
  step,
  onSelect,
  isLoading,
  currentInput,
}: OnboardingQuickResponsesProps) {
  const [ageValue, setAgeValue] = useState("");
  const [heightValue, setHeightValue] = useState("");
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft">("cm");
  const [feetValue, setFeetValue] = useState("");
  const [inchesValue, setInchesValue] = useState("");
  const [weightValue, setWeightValue] = useState("");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");

  const options: Record<string, QuickResponseOption[]> = {
    gender: [
      { label: "Male", value: "male", icon: "👨" },
      { label: "Female", value: "female", icon: "👩" },
      { label: "Prefer not to say", value: "other", icon: "🤐" },
    ],
    activity_level: [
      { label: "Sedentary", value: "sedentary", icon: "🪑" },
      { label: "Light Exercise", value: "light", icon: "🚶" },
      { label: "Moderate", value: "moderate", icon: "🏃" },
      { label: "Very Active", value: "active", icon: "💪" },
    ],
    goal: [
      { label: "Lose Weight", value: "cut", icon: "📉" },
      { label: "Build Muscle", value: "gain", icon: "📈" },
      { label: "Maintain", value: "maintain", icon: "⚖️" },
      { label: "I'm not sure - help me decide", value: "help", icon: "🤔" },
    ],
    display_mode: [
      { label: "Show All Numbers", value: "standard", icon: "📊" },
      { label: "Stealth Mode", value: "stealth", icon: "🤫" },
    ],
    dietary_setup: [
      {
        label: "Set Dietary Preferences",
        value: "set_preferences",
        icon: "🥗",
      },
      { label: "Skip for Now", value: "skip_preferences", icon: "⏭️" },
    ],
    current_weight: [
      { label: "kg", value: "kg" },
      { label: "lbs", value: "lbs" },
    ],
    target_weight: [
      { label: "kg", value: "kg" },
      { label: "lbs", value: "lbs" },
    ],
  };

  // Special handling for height_age step
  if (step === "height_age") {
    return (
      <div className="space-y-3 p-3 bg-muted rounded-lg">
        <div className="space-y-3">
          {/* Height input with unit toggle */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Height
            </label>
            <div className="flex gap-2">
              {heightUnit === "cm" ? (
                <Input
                  type="number"
                  placeholder="170"
                  value={heightValue}
                  onChange={(e) => setHeightValue(e.target.value)}
                  className="flex-1 text-center text-lg font-medium"
                  min="100"
                  max="250"
                />
              ) : (
                <div className="flex-1 flex gap-2">
                  <Input
                    type="number"
                    placeholder="5"
                    value={feetValue}
                    onChange={(e) => setFeetValue(e.target.value)}
                    className="w-16 text-center text-lg font-medium"
                    min="3"
                    max="8"
                  />
                  <span className="self-center text-muted-foreground">ft</span>
                  <Input
                    type="number"
                    placeholder="10"
                    value={inchesValue}
                    onChange={(e) => setInchesValue(e.target.value)}
                    className="w-16 text-center text-lg font-medium"
                    min="0"
                    max="11"
                  />
                  <span className="self-center text-muted-foreground">in</span>
                </div>
              )}
              <div className="flex rounded-md shadow-sm" role="group">
                <button
                  type="button"
                  onClick={() => setHeightUnit("cm")}
                  className={`px-3 py-2 text-sm font-medium rounded-l-md border ${
                    heightUnit === "cm"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-card-foreground border-border"
                  }`}
                >
                  cm
                </button>
                <button
                  type="button"
                  onClick={() => setHeightUnit("ft")}
                  className={`px-3 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                    heightUnit === "ft"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-card-foreground border-border"
                  }`}
                >
                  ft
                </button>
              </div>
            </div>
          </div>

          {/* Age input */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Age
            </label>
            <Input
              type="number"
              placeholder="25"
              value={ageValue}
              onChange={(e) => setAgeValue(e.target.value)}
              className="w-full text-center text-lg font-medium"
              min="13"
              max="100"
            />
          </div>
        </div>

        <Button
          onClick={() => {
            let heightStr = "";
            if (heightUnit === "cm" && heightValue) {
              heightStr = `${heightValue}cm`;
            } else if (heightUnit === "ft" && feetValue) {
              // Convert feet and inches to cm for backend
              const totalInches =
                parseInt(feetValue) * 12 + (parseInt(inchesValue) || 0);
              const cm = Math.round(totalInches * 2.54);
              heightStr = `${cm}cm`;
            }

            if (heightStr && ageValue) {
              onSelect(`I am ${heightStr} tall and ${ageValue} years old`);
            }
          }}
          disabled={
            isLoading ||
            !ageValue ||
            (heightUnit === "cm" ? !heightValue : !feetValue)
          }
          className="w-full h-10 text-sm font-medium bg-primary text-primary-foreground"
        >
          Continue →
        </Button>
      </div>
    );
  }

  // Special handling for dietary preferences
  if (step === "dietary_preferences") {
    return (
      <div className="p-3">
        <DietaryPreferencesCard
          showTitle={false}
          compact={true}
          onComplete={() => onSelect("preferences_saved")}
        />
      </div>
    );
  }

  // Special handling for weight input
  if (step === "current_weight" || step === "target_weight") {
    return (
      <div className="space-y-3 p-3 bg-muted rounded-lg">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground mb-2 block">
            {step === "current_weight" ? "Current Weight" : "Target Weight"}
          </label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={weightUnit === "kg" ? "70" : "155"}
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
              className="flex-1 text-center text-lg font-medium"
              min="20"
              max={weightUnit === "kg" ? "300" : "650"}
              step={weightUnit === "kg" ? "0.1" : "1"}
            />
            <div className="flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setWeightUnit("kg")}
                className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                  weightUnit === "kg"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-card-foreground border-border"
                }`}
              >
                kg
              </button>
              <button
                type="button"
                onClick={() => setWeightUnit("lbs")}
                className={`px-4 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                  weightUnit === "lbs"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-card-foreground border-border"
                }`}
              >
                lbs
              </button>
            </div>
          </div>
        </div>
        <Button
          onClick={() => {
            if (weightValue) {
              onSelect(`${weightValue} ${weightUnit}`);
            }
          }}
          disabled={isLoading || !weightValue}
          className="w-full h-10 text-sm font-medium bg-primary text-primary-foreground"
        >
          Continue →
        </Button>
      </div>
    );
  }

  const currentOptions = options[step];
  if (!currentOptions) return null;

  // For other options, show as large centered buttons
  return (
    <div className="space-y-2 p-3">
      {step === "goal" && (
        <p className="text-sm text-muted-foreground text-center mb-2">
          If you're not sure, describe your situation and I'll help you figure
          it out!
        </p>
      )}
      {currentOptions.map((option) => (
        <Button
          key={option.value}
          variant="outline"
          onClick={() => onSelect(option.value)}
          disabled={isLoading}
          className="w-full h-12 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 border"
        >
          {option.icon && <span className="text-base">{option.icon}</span>}
          <span className="font-medium">{option.label}</span>
        </Button>
      ))}
    </div>
  );
}
