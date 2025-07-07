"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { Input } from "./ui/input";
import { useMutation, useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { COMMON_RESTRICTIONS } from "~/convex/dietaryPreferences";
import { Loader2 } from "lucide-react";

interface DietaryPreferencesCardProps {
  onComplete?: () => void;
  showTitle?: boolean;
  compact?: boolean;
}

export function DietaryPreferencesCard({
  onComplete,
  showTitle = true,
  compact = false,
}: DietaryPreferencesCardProps) {
  const existingPreferences = useQuery(
    api.dietaryPreferences.getUserDietaryPreferences,
  );
  const setPreferences = useMutation(
    api.dietaryPreferences.setDietaryPreferences,
  );

  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>(
    [],
  );
  const [customNotes, setCustomNotes] = useState("");
  const [fastingEnabled, setFastingEnabled] = useState(false);
  const [fastingStartHour, setFastingStartHour] = useState(12);
  const [fastingEndHour, setFastingEndHour] = useState(20);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing preferences
  useEffect(() => {
    if (existingPreferences) {
      setSelectedRestrictions(existingPreferences.restrictions || []);
      setCustomNotes(existingPreferences.customNotes || "");
      if (existingPreferences.intermittentFasting) {
        setFastingEnabled(existingPreferences.intermittentFasting.enabled);
        setFastingStartHour(existingPreferences.intermittentFasting.startHour);
        setFastingEndHour(existingPreferences.intermittentFasting.endHour);
      }
    }
  }, [existingPreferences]);

  const handleRestrictionToggle = (restriction: string) => {
    setSelectedRestrictions((prev) =>
      prev.includes(restriction)
        ? prev.filter((r) => r !== restriction)
        : [...prev, restriction],
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setPreferences({
        restrictions: selectedRestrictions,
        customNotes: customNotes.trim(),
        intermittentFasting: fastingEnabled
          ? {
              enabled: true,
              startHour: fastingStartHour,
              endHour: fastingEndHour,
            }
          : undefined,
      });
      onComplete?.();
    } catch (error) {
      console.error("Failed to save preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const commonCategories = {
    "Diet Types": ["vegan", "vegetarian", "keto", "low-carb"],
    Allergies: [
      "gluten-free",
      "dairy-free",
      "nut-free",
      "soy-free",
      "egg-free",
      "shellfish-free",
    ],
    "Religious/Ethical": ["halal", "kosher"],
    Medical: ["diabetic"],
  };

  return (
    <Card className={compact ? "border-0 shadow-none" : ""}>
      {showTitle && (
        <CardHeader>
          <CardTitle>Dietary Preferences</CardTitle>
          <CardDescription>
            Let Bob know about your dietary restrictions and preferences
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className={compact ? "p-0" : ""}>
        <div className="space-y-6">
          {/* Common Restrictions */}
          <div className="space-y-4">
            {Object.entries(commonCategories).map(
              ([category, restrictions]) => (
                <div key={category}>
                  <h4 className="text-sm font-medium mb-2">{category}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {restrictions.map((restriction) => (
                      <div
                        key={restriction}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={restriction}
                          checked={selectedRestrictions.includes(restriction)}
                          onCheckedChange={() =>
                            handleRestrictionToggle(restriction)
                          }
                        />
                        <Label
                          htmlFor={restriction}
                          className="text-sm font-normal capitalize cursor-pointer"
                        >
                          {restriction.replace("-", " ")}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>

          {/* Intermittent Fasting */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="fasting"
                checked={fastingEnabled}
                onCheckedChange={setFastingEnabled}
              />
              <Label htmlFor="fasting" className="cursor-pointer">
                Intermittent Fasting
              </Label>
            </div>
            {fastingEnabled && (
              <div className="ml-6 space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="start-hour" className="text-sm">
                    Eating window:
                  </Label>
                  <Input
                    id="start-hour"
                    type="number"
                    min={0}
                    max={23}
                    value={fastingStartHour}
                    onChange={(e) =>
                      setFastingStartHour(parseInt(e.target.value))
                    }
                    className="w-16"
                  />
                  <span className="text-sm">to</span>
                  <Input
                    id="end-hour"
                    type="number"
                    min={0}
                    max={23}
                    value={fastingEndHour}
                    onChange={(e) =>
                      setFastingEndHour(parseInt(e.target.value))
                    }
                    className="w-16"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  You can eat between {fastingStartHour}:00 and {fastingEndHour}
                  :00
                </p>
              </div>
            )}
          </div>

          {/* Custom Notes */}
          <div className="space-y-2">
            <Label htmlFor="custom-notes">Other preferences or notes</Label>
            <Textarea
              id="custom-notes"
              placeholder="e.g., No spicy food, allergic to sesame, prefer organic..."
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
