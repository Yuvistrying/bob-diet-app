import { Button } from "~/app/components/ui/button";
import { Input } from "~/app/components/ui/input";
import { Badge } from "~/app/components/ui/badge";
import { Switch } from "~/app/components/ui/switch";
import { useState, useEffect, useRef } from "react";
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
  const [nameValue, setNameValue] = useState("");
  const [dietaryData, setDietaryData] = useState({
    restrictions: [] as string[],
    customNotes: "",
    intermittentFasting: {
      enabled: false,
      startHour: 12,
      endHour: 20,
    },
  });

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
    display_mode: [
      { label: "Show All Numbers", value: "standard", icon: "📊" },
      { label: "Stealth Mode", value: "stealth", icon: "🤫" },
    ],
    dietary_preferences: [], // Special handling with full card UI
    current_weight: [
      { label: "kg", value: "kg" },
      { label: "lbs", value: "lbs" },
    ],
    target_weight: [
      { label: "kg", value: "kg" },
      { label: "lbs", value: "lbs" },
    ],
  };

  // Special handling for name step
  if (step === "name") {
    return (
      <div className="space-y-3 p-3 bg-muted rounded-lg">
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">
            What should I call you?
          </label>
          <Input
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && nameValue.trim() && !isLoading) {
                onSelect(nameValue.trim());
              }
            }}
            className="w-full text-center text-lg font-medium"
            autoFocus
          />
        </div>
        <Button
          onClick={() => {
            if (nameValue.trim()) {
              onSelect(nameValue.trim());
            }
          }}
          disabled={isLoading || !nameValue.trim()}
          className="w-full h-10 text-sm font-medium bg-primary text-primary-foreground"
        >
          Continue →
        </Button>
      </div>
    );
  }

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
                  value={heightValue}
                  onChange={(e) => setHeightValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      heightValue &&
                      ageValue &&
                      !isLoading
                    ) {
                      onSelect(
                        `I am ${heightValue}cm tall and ${ageValue} years old`,
                      );
                    }
                  }}
                  className="flex-1 text-center text-lg font-medium"
                  min="100"
                  max="250"
                />
              ) : (
                <div className="flex-1 flex gap-2">
                  <Input
                    type="number"
                    value={feetValue}
                    onChange={(e) => setFeetValue(e.target.value)}
                    className="w-16 text-center text-lg font-medium"
                    min="3"
                    max="8"
                  />
                  <span className="self-center text-muted-foreground">ft</span>
                  <Input
                    type="number"
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
              value={ageValue}
              onChange={(e) => setAgeValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && ageValue && !isLoading) {
                  let heightStr = "";
                  if (heightUnit === "cm" && heightValue) {
                    heightStr = `${heightValue}cm`;
                  } else if (heightUnit === "ft" && feetValue) {
                    const totalInches =
                      parseInt(feetValue) * 12 + (parseInt(inchesValue) || 0);
                    const cm = Math.round(totalInches * 2.54);
                    heightStr = `${cm}cm`;
                  }
                  if (heightStr && ageValue) {
                    onSelect(
                      `I am ${heightStr} tall and ${ageValue} years old`,
                    );
                  }
                }
              }}
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
    const COMMON_RESTRICTIONS = [
      "vegetarian",
      "vegan",
      "gluten-free",
      "dairy-free",
      "keto",
      "paleo",
      "nut-free",
      "halal",
      "kosher",
    ];

    const toggleRestriction = (restriction: string) => {
      setDietaryData((prev) => ({
        ...prev,
        restrictions: prev.restrictions.includes(restriction)
          ? prev.restrictions.filter((r) => r !== restriction)
          : [...prev.restrictions, restriction],
      }));
    };

    const formatHour = (hour: number) => {
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayHour}:00 ${period}`;
    };

    return (
      <div className="space-y-4 p-4 bg-muted rounded-lg">
        {/* Dietary Restrictions */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Dietary Restrictions
          </label>
          <p className="text-xs text-muted-foreground mb-3">
            Select any that apply to you
          </p>
          <div className="flex flex-wrap gap-2">
            {COMMON_RESTRICTIONS.map((restriction) => (
              <Badge
                key={restriction}
                variant={
                  dietaryData.restrictions.includes(restriction)
                    ? "default"
                    : "outline"
                }
                className="cursor-pointer transition-colors capitalize hover:bg-primary hover:text-primary-foreground"
                onClick={() => toggleRestriction(restriction)}
              >
                {restriction}
              </Badge>
            ))}
          </div>
        </div>

        {/* Custom Notes */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Additional Notes
          </label>
          <textarea
            value={dietaryData.customNotes}
            onChange={(e) =>
              setDietaryData((prev) => ({
                ...prev,
                customNotes: e.target.value,
              }))
            }
            placeholder="Any allergies, medical conditions, or preferences..."
            className="w-full p-2 text-sm bg-background border border-border rounded-md resize-none"
            rows={2}
          />
        </div>

        {/* Intermittent Fasting */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground">
              Intermittent Fasting
            </label>
            <Switch
              checked={dietaryData.intermittentFasting.enabled}
              onCheckedChange={(checked) =>
                setDietaryData((prev) => ({
                  ...prev,
                  intermittentFasting: {
                    ...prev.intermittentFasting,
                    enabled: checked,
                  },
                }))
              }
            />
          </div>
          {dietaryData.intermittentFasting.enabled && (
            <div className="space-y-2 mt-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-20">
                  Start:
                </label>
                <select
                  value={dietaryData.intermittentFasting.startHour}
                  onChange={(e) =>
                    setDietaryData((prev) => ({
                      ...prev,
                      intermittentFasting: {
                        ...prev.intermittentFasting,
                        startHour: parseInt(e.target.value),
                      },
                    }))
                  }
                  className="flex-1 p-1 text-sm bg-background border border-border rounded"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {formatHour(i)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-20">
                  End:
                </label>
                <select
                  value={dietaryData.intermittentFasting.endHour}
                  onChange={(e) =>
                    setDietaryData((prev) => ({
                      ...prev,
                      intermittentFasting: {
                        ...prev.intermittentFasting,
                        endHour: parseInt(e.target.value),
                      },
                    }))
                  }
                  className="flex-1 p-1 text-sm bg-background border border-border rounded"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {formatHour(i)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <Button
            onClick={() => {
              // Create a human-readable message for the chat bubble
              let displayMessage = "Set dietary preferences:";

              if (dietaryData.restrictions.length > 0) {
                displayMessage += ` ${dietaryData.restrictions.join(", ")}`;
              }

              if (dietaryData.intermittentFasting.enabled) {
                const startTime = formatHour(
                  dietaryData.intermittentFasting.startHour,
                );
                const endTime = formatHour(
                  dietaryData.intermittentFasting.endHour,
                );
                displayMessage += `${dietaryData.restrictions.length > 0 ? ", " : " "}intermittent fasting ${startTime} - ${endTime}`;
              }

              if (dietaryData.customNotes) {
                displayMessage += `${dietaryData.restrictions.length > 0 || dietaryData.intermittentFasting.enabled ? ", " : " "}${dietaryData.customNotes}`;
              }

              // If no preferences were set
              if (
                dietaryData.restrictions.length === 0 &&
                !dietaryData.intermittentFasting.enabled &&
                !dietaryData.customNotes
              ) {
                displayMessage = "No special dietary preferences";
              }

              // Send both the data and the display message
              const dataToSend = {
                ...dietaryData,
                _isOnboardingData: true,
                _displayMessage: displayMessage,
              };
              onSelect(JSON.stringify(dataToSend));
            }}
            disabled={isLoading}
            className="w-full h-10 text-sm font-medium bg-primary text-primary-foreground"
          >
            Save Preferences
          </Button>
          <Button
            onClick={() => onSelect("skip_preferences")}
            disabled={isLoading}
            variant="outline"
            className="w-full h-10 text-sm font-medium"
          >
            I don&apos;t have any special preferences
          </Button>
        </div>
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
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && weightValue && !isLoading) {
                  onSelect(`${weightValue} ${weightUnit}`);
                }
              }}
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
          If you&apos;re not sure, describe your situation and I&apos;ll help
          you figure it out!
        </p>
      )}
      {step === "gender" && (
        <p className="text-sm text-muted-foreground text-center mb-2">
          This helps me calculate your nutritional needs more accurately
        </p>
      )}
      {step === "activity_level" && (
        <p className="text-sm text-muted-foreground text-center mb-2">
          How active are you on a typical week?
        </p>
      )}
      {step === "display_mode" && (
        <p className="text-sm text-muted-foreground text-center mb-2">
          Choose how you&apos;d like to see your nutrition data
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
