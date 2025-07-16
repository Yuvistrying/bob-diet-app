"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CardContent, CardHeader, CardTitle } from "~/app/components/ui/card";
import { Button } from "~/app/components/ui/button";
import { Label } from "~/app/components/ui/label";
import { Textarea } from "~/app/components/ui/textarea";
import { Switch } from "~/app/components/ui/switch";
import { Badge } from "~/app/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/components/ui/select";
import { Wheat, Clock, X } from "lucide-react";
import { cn } from "~/lib/utils";

const COMMON_RESTRICTIONS = [
  "vegan",
  "vegetarian",
  "gluten-free",
  "dairy-free",
  "nut-free",
  "soy-free",
  "egg-free",
  "shellfish-free",
  "keto",
  "low-carb",
  "diabetic",
  "halal",
  "kosher",
];

export function DietaryPreferencesCard() {
  const dietaryPreferences = useQuery(
    api.dietaryPreferences.getUserDietaryPreferences,
  );
  const setDietaryPreferences = useMutation(
    api.dietaryPreferences.setDietaryPreferences,
  );

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    restrictions: [] as string[],
    customNotes: "",
    intermittentFasting: {
      enabled: false,
      startHour: 12,
      endHour: 20,
    },
  });

  // Initialize form data when preferences load
  useEffect(() => {
    if (dietaryPreferences) {
      setFormData({
        restrictions: dietaryPreferences.restrictions || [],
        customNotes: dietaryPreferences.customNotes || "",
        intermittentFasting: dietaryPreferences.intermittentFasting || {
          enabled: false,
          startHour: 12,
          endHour: 20,
        },
      });
    }
  }, [dietaryPreferences]);

  const handleSave = async () => {
    await setDietaryPreferences({
      restrictions: formData.restrictions,
      customNotes: formData.customNotes,
      intermittentFasting: formData.intermittentFasting.enabled
        ? {
            enabled: true,
            startHour: formData.intermittentFasting.startHour,
            endHour: formData.intermittentFasting.endHour,
          }
        : undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    // Reset to original values
    if (dietaryPreferences) {
      setFormData({
        restrictions: dietaryPreferences.restrictions || [],
        customNotes: dietaryPreferences.customNotes || "",
        intermittentFasting: dietaryPreferences.intermittentFasting || {
          enabled: false,
          startHour: 12,
          endHour: 20,
        },
      });
    }
    setIsEditing(false);
  };

  const toggleRestriction = (restriction: string) => {
    if (!isEditing) return;

    setFormData((prev) => ({
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
    <div className="mt-4 border border-border rounded-lg">
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-lg text-foreground flex items-center gap-2">
          <Wheat className="h-5 w-5" />
          Dietary Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {/* Dietary Restrictions */}
        <div>
          <Label className="text-foreground mb-2 block">
            Dietary Restrictions
          </Label>
          <p className="text-xs text-muted-foreground mb-3">
            Bob will consider these when suggesting meals
          </p>
          <div className="flex flex-wrap gap-2">
            {COMMON_RESTRICTIONS.map((restriction) => (
              <Badge
                key={restriction}
                variant={
                  formData.restrictions.includes(restriction)
                    ? "default"
                    : "outline"
                }
                className={cn(
                  "cursor-pointer transition-colors capitalize",
                  isEditing && "hover:bg-primary hover:text-primary-foreground",
                  !isEditing && "cursor-default opacity-80",
                )}
                onClick={() => toggleRestriction(restriction)}
              >
                {restriction}
                {formData.restrictions.includes(restriction) && isEditing && (
                  <X className="h-3 w-3 ml-1" />
                )}
              </Badge>
            ))}
          </div>
        </div>

        {/* Custom Notes */}
        <div>
          <Label htmlFor="custom-notes" className="text-foreground mb-2 block">
            Additional Notes
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            Allergies, preferences, or medical conditions
          </p>
          <Textarea
            id="custom-notes"
            placeholder="e.g., Allergic to shellfish, prefer organic, borderline diabetic..."
            value={formData.customNotes}
            onChange={(e) =>
              setFormData({ ...formData, customNotes: e.target.value })
            }
            disabled={!isEditing}
            className="mt-2 bg-input border-border text-foreground disabled:bg-muted disabled:text-muted-foreground min-h-[80px]"
          />
        </div>

        {/* Intermittent Fasting */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Label htmlFor="intermittent-fasting" className="text-foreground">
                Intermittent Fasting
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Bob will remind you about your fasting window
              </p>
            </div>
            <Switch
              id="intermittent-fasting"
              checked={formData.intermittentFasting.enabled}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  intermittentFasting: {
                    ...formData.intermittentFasting,
                    enabled: checked,
                  },
                })
              }
              disabled={!isEditing}
            />
          </div>

          {formData.intermittentFasting.enabled && (
            <div className="ml-4 space-y-3 mt-3">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1">
                    <Label className="text-sm text-muted-foreground">
                      Eating starts
                    </Label>
                    <Select
                      value={formData.intermittentFasting.startHour.toString()}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          intermittentFasting: {
                            ...formData.intermittentFasting,
                            startHour: parseInt(value),
                          },
                        })
                      }
                      disabled={!isEditing}
                    >
                      <SelectTrigger className="mt-1 bg-input border-border text-foreground disabled:bg-muted disabled:text-muted-foreground">
                        <SelectValue>
                          {formatHour(formData.intermittentFasting.startHour)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem
                            key={i}
                            value={i.toString()}
                            className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                          >
                            {formatHour(i)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-muted-foreground">to</span>
                  <div className="flex-1">
                    <Label className="text-sm text-muted-foreground">
                      Eating ends
                    </Label>
                    <Select
                      value={formData.intermittentFasting.endHour.toString()}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          intermittentFasting: {
                            ...formData.intermittentFasting,
                            endHour: parseInt(value),
                          },
                        })
                      }
                      disabled={!isEditing}
                    >
                      <SelectTrigger className="mt-1 bg-input border-border text-foreground disabled:bg-muted disabled:text-muted-foreground">
                        <SelectValue>
                          {formatHour(formData.intermittentFasting.endHour)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem
                            key={i}
                            value={i.toString()}
                            className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                          >
                            {formatHour(i)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              {!isEditing && (
                <div className="text-sm text-muted-foreground">
                  Fasting window:{" "}
                  {(() => {
                    const { startHour, endHour } = formData.intermittentFasting;
                    const eatingHours =
                      endHour > startHour
                        ? endHour - startHour
                        : 24 - startHour + endHour;
                    const fastingHours = 24 - eatingHours;
                    return `${fastingHours}:${eatingHours} (${fastingHours} hours fasting, ${eatingHours} hours eating)`;
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Edit/Save Buttons */}
        <div className="flex gap-2 pt-2">
          {isEditing ? (
            <>
              <Button
                onClick={handleSave}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground transition-opacity hover:opacity-80"
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1 bg-card hover:bg-accent hover:text-accent-foreground text-foreground border-border transition-opacity hover:opacity-80"
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              className="w-full bg-card hover:bg-accent hover:text-accent-foreground text-foreground border-border transition-opacity hover:opacity-80"
            >
              Edit Preferences
            </Button>
          )}
        </div>
      </CardContent>
    </div>
  );
}
