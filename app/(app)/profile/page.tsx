"use client";

import { useState, Suspense, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/app/components/ui/card";
import { Button } from "~/app/components/ui/button";
import { Input } from "~/app/components/ui/input";
import { Label } from "~/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/components/ui/select";
import { Switch } from "~/app/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "~/app/components/ui/toggle-group";
import { useAuth } from "@clerk/nextjs";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";
import {
  LogOut,
  User,
  Settings,
  Flag,
  Scale,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { BottomNav } from "~/app/components/BottomNav";
import { DietaryPreferencesCard } from "~/app/components/DietaryPreferencesCard";

export default function Profile() {
  const { signOut } = useAuth();
  const router = useRouter();
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const preferences = useQuery(api.userPreferences.getUserPreferences);
  const latestWeight = useQuery(api.weightLogs.getLatestWeight);

  const updateProfile = useMutation(api.userProfiles.updateProfileField);
  const updatePreferences = useMutation(api.userPreferences.updatePreferences);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    age: 0,
    height: 170,
    targetWeight: 70,
    gender: "other",
    activityLevel: "moderate",
    goal: "maintain",
  });

  const [validationWarning, setValidationWarning] = useState<string | null>(
    null,
  );

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        age: profile.age || 0,
        height: profile.height || 170,
        targetWeight: profile.targetWeight || 70,
        gender: profile.gender || "other",
        activityLevel: profile.activityLevel || "moderate",
        goal: profile.goal || "maintain",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    // Validate goal and weight consistency
    let finalFormData = { ...formData };
    const currentWeight = latestWeight?.weight || profile?.currentWeight || 70;

    // Check for conflicts and auto-adjust
    if (formData.goal === "cut" && formData.targetWeight >= currentWeight) {
      setValidationWarning(
        "Target weight should be less than current weight for cutting. Adjusting goal to 'maintain'.",
      );
      finalFormData.goal = "maintain";
    } else if (
      formData.goal === "gain" &&
      formData.targetWeight <= currentWeight
    ) {
      setValidationWarning(
        "Target weight should be more than current weight for gaining. Adjusting goal to 'maintain'.",
      );
      finalFormData.goal = "maintain";
    } else if (formData.goal === "maintain") {
      finalFormData.targetWeight = currentWeight;
    }

    // Update each field individually
    if (finalFormData.name !== profile?.name) {
      await updateProfile({ field: "name", value: finalFormData.name });
    }
    if (finalFormData.age !== profile?.age) {
      await updateProfile({ field: "age", value: finalFormData.age });
    }
    if (finalFormData.height !== profile?.height) {
      await updateProfile({ field: "height", value: finalFormData.height });
    }
    if (finalFormData.targetWeight !== profile?.targetWeight) {
      await updateProfile({
        field: "targetWeight",
        value: finalFormData.targetWeight,
      });
    }

    // Goal will be updated as part of profile update
    if (finalFormData.gender !== profile?.gender) {
      await updateProfile({ field: "gender", value: finalFormData.gender });
    }
    if (finalFormData.activityLevel !== profile?.activityLevel) {
      await updateProfile({
        field: "activityLevel",
        value: finalFormData.activityLevel,
      });
    }
    if (finalFormData.goal !== profile?.goal) {
      await updateProfile({ field: "goal", value: finalFormData.goal });
    }

    setIsEditing(false);

    // Clear warning after 3 seconds
    if (validationWarning) {
      setTimeout(() => setValidationWarning(null), 3000);
    }
  };

  const handleToggleMode = async (checked: boolean) => {
    await updatePreferences({
      darkMode: checked,
    });
  };

  const handleToggleCuteMode = async (checked: boolean) => {
    await updatePreferences({
      cuteMode: checked,
    });
  };

  return (
    <div className="flex flex-col bg-background h-full">
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden bg-background pb-20"
        style={{ overscrollBehavior: "contain" }}
      >
        <div className="max-w-lg mx-auto px-4">
          {/* Always show sign out button at the top */}
          <div className="pt-4">
            <Button
              variant="outline"
              className="w-full text-destructive transition-opacity hover:opacity-80"
              style={{ borderColor: "var(--border)" }}
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>

          {!profile ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">Loading profile...</p>
              </div>
            </div>
          ) : (
            <>
              {/* About You Section */}
              <div className="mt-4 border border-border rounded-lg">
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-lg text-foreground flex items-center gap-2">
                    <User className="h-5 w-5" />
                    About you
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div>
                    <Label htmlFor="name" className="text-foreground mb-1">
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={isEditing ? formData.name : profile?.name || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      disabled={!isEditing}
                      className="mt-2 bg-input border-border text-foreground disabled:bg-muted disabled:text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                    />
                  </div>

                  <div>
                    <Label htmlFor="age" className="text-foreground mb-1">
                      Age
                    </Label>
                    <Input
                      id="age"
                      type="number"
                      value={isEditing ? formData.age : profile?.age || 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          age: parseInt(e.target.value),
                        })
                      }
                      disabled={!isEditing}
                      className="mt-2 bg-input border-border text-foreground disabled:bg-muted disabled:text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                    />
                  </div>

                  <div>
                    <Label htmlFor="height" className="text-foreground mb-1">
                      Height (cm)
                    </Label>
                    <Input
                      id="height"
                      type="number"
                      value={isEditing ? formData.height : profile?.height || 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          height: parseInt(e.target.value),
                        })
                      }
                      disabled={!isEditing}
                      className="mt-2 bg-input border-border text-foreground disabled:bg-muted disabled:text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                    />
                  </div>

                  {/* Starting Weight */}
                  <div>
                    <Label className="text-foreground mb-2">
                      Starting Weight
                    </Label>
                    <div className="mt-2 p-2 bg-muted rounded-md border border-border">
                      <div className="text-lg font-semibold text-foreground">
                        <span className="flex items-center gap-1">
                          <Flag className="h-4 w-4" />
                          {profile?.currentWeight || "—"}{" "}
                          {profile?.preferredUnits === "imperial"
                            ? "lbs"
                            : "kg"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Current Weight */}
                  <div>
                    <Label className="text-foreground mb-2">
                      Current Weight
                    </Label>
                    <div className="mt-2 p-2 bg-muted rounded-md border border-border">
                      <div className="text-lg font-semibold text-foreground">
                        <span className="flex items-center gap-1">
                          <Scale className="h-4 w-4" />
                          {latestWeight?.weight ||
                            profile?.currentWeight ||
                            "—"}{" "}
                          {latestWeight?.unit ||
                            (profile?.preferredUnits === "imperial"
                              ? "lbs"
                              : "kg")}
                        </span>
                      </div>
                      {latestWeight && (
                        <div className="text-xs text-muted-foreground">
                          Last logged:{" "}
                          {new Date(
                            latestWeight._creationTime,
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label
                      htmlFor="targetWeight"
                      className="text-foreground mb-2"
                    >
                      Target Weight (
                      {profile?.preferredUnits === "imperial" ? "lbs" : "kg"})
                    </Label>
                    <Input
                      id="targetWeight"
                      type="number"
                      step="0.1"
                      value={
                        isEditing
                          ? formData.targetWeight
                          : profile?.targetWeight || 0
                      }
                      onChange={(e) => {
                        const newTarget = parseFloat(e.target.value);
                        setFormData({ ...formData, targetWeight: newTarget });
                        const currentWeight =
                          latestWeight?.weight || profile?.currentWeight || 70;
                        // Check for conflicts
                        if (
                          formData.goal === "cut" &&
                          newTarget >= currentWeight
                        ) {
                          setValidationWarning(
                            "For cutting, target weight should be less than current weight",
                          );
                        } else if (
                          formData.goal === "gain" &&
                          newTarget <= currentWeight
                        ) {
                          setValidationWarning(
                            "For gaining, target weight should be more than current weight",
                          );
                        } else {
                          setValidationWarning(null);
                        }
                      }}
                      disabled={!isEditing}
                      placeholder={
                        !profile?.targetWeight && !isEditing ? "—" : ""
                      }
                      className="mt-2 bg-input border-border text-foreground disabled:bg-muted disabled:text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                    />
                  </div>

                  <div>
                    <Label className="text-foreground mb-1">Gender</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Asking because this affects calorie and nutrient
                      recommendations
                    </p>
                    <ToggleGroup
                      type="single"
                      value={
                        isEditing ? formData.gender : profile?.gender || "other"
                      }
                      onValueChange={(value) =>
                        setFormData({ ...formData, gender: value })
                      }
                      disabled={!isEditing}
                      className="grid grid-cols-3 gap-2 mt-2"
                    >
                      <ToggleGroupItem
                        value="female"
                        className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-border hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                      >
                        Female
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="male"
                        className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-border hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                      >
                        Male
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="other"
                        className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-border hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                      >
                        Rather not say
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div>
                    <Label className="text-foreground mb-1">
                      Activity Level
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      How active are you on a typical day?
                    </p>
                    <Select
                      value={
                        isEditing
                          ? formData.activityLevel
                          : profile?.activityLevel || "moderate"
                      }
                      onValueChange={(value) =>
                        setFormData({ ...formData, activityLevel: value })
                      }
                      disabled={!isEditing}
                    >
                      <SelectTrigger className="mt-2 bg-input border-border text-foreground disabled:bg-muted disabled:text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem
                          value="sedentary"
                          className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          Sedentary (little to no exercise)
                        </SelectItem>
                        <SelectItem
                          value="light"
                          className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          Light (exercise 1-3 days/week)
                        </SelectItem>
                        <SelectItem
                          value="moderate"
                          className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          Moderate (exercise 3-5 days/week)
                        </SelectItem>
                        <SelectItem
                          value="active"
                          className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          Very Active (exercise 6-7 days/week)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-foreground mb-1">Current Goal</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Your daily recommendations will change based on this
                      selection
                    </p>
                    <ToggleGroup
                      type="single"
                      value={
                        isEditing ? formData.goal : profile?.goal || "maintain"
                      }
                      onValueChange={(value) => {
                        setFormData({ ...formData, goal: value });
                        const currentWeight =
                          latestWeight?.weight || profile?.currentWeight || 70;
                        // Check for conflicts
                        if (
                          value === "cut" &&
                          formData.targetWeight >= currentWeight
                        ) {
                          setValidationWarning(
                            "For cutting, target weight should be less than current weight",
                          );
                        } else if (
                          value === "gain" &&
                          formData.targetWeight <= currentWeight
                        ) {
                          setValidationWarning(
                            "For gaining, target weight should be more than current weight",
                          );
                        } else if (value === "maintain") {
                          setValidationWarning(
                            "Target weight will be set to match current weight",
                          );
                        } else {
                          setValidationWarning(null);
                        }
                      }}
                      disabled={!isEditing}
                      className="grid grid-cols-3 gap-2 mt-2"
                    >
                      <ToggleGroupItem
                        value="gain"
                        className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-border hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                      >
                        Gain
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="cut"
                        className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-border hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                      >
                        Cut
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="maintain"
                        className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-border hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                      >
                        Maintain
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  {/* Validation Warning */}
                  {validationWarning && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-1.5 rounded-md text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {validationWarning}
                    </div>
                  )}

                  <div className="flex gap-2">
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
                          onClick={() => {
                            setIsEditing(false);
                            setFormData({
                              name: profile?.name || "",
                              age: profile?.age || 0,
                              height: profile?.height || 170,
                              targetWeight: profile?.targetWeight || 70,
                              gender: profile?.gender || "other",
                              activityLevel:
                                profile?.activityLevel || "moderate",
                              goal: profile?.goal || "maintain",
                            });
                          }}
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
                        Edit Profile
                      </Button>
                    )}
                  </div>
                </CardContent>
              </div>

              {/* Service Preferences */}
              <div className="mt-4 border border-border rounded-lg">
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-lg text-foreground flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Service Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div>
                    <Label htmlFor="language" className="text-foreground mb-1">
                      Language
                    </Label>
                    <Select defaultValue={preferences?.language || "en"}>
                      <SelectTrigger className="mt-2 bg-input border-border text-foreground disabled:bg-muted disabled:text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem
                          value="en"
                          className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          English
                        </SelectItem>
                        <SelectItem
                          value="he"
                          className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          Hebrew
                        </SelectItem>
                        <SelectItem
                          value="es"
                          className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          Spanish
                        </SelectItem>
                        <SelectItem
                          value="fr"
                          className="text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          French
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <Label htmlFor="dark-mode" className="text-foreground">
                      Dark mode
                    </Label>
                    <Switch
                      id="dark-mode"
                      checked={preferences?.darkMode || false}
                      onCheckedChange={handleToggleMode}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <Label htmlFor="cute-mode" className="text-foreground">
                      Cute mode
                    </Label>
                    <Switch
                      id="cute-mode"
                      checked={preferences?.cuteMode || false}
                      onCheckedChange={handleToggleCuteMode}
                    />
                  </div>

                  {/* Macro Visibility Settings */}
                  <div className="border-t border-border pt-3 mt-3">
                    <div className="text-sm font-medium mb-3 text-foreground">
                      Macro Display Settings
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <Label
                        htmlFor="show-all-macros"
                        className="text-foreground"
                      >
                        Show Macros
                      </Label>
                      <Switch
                        id="show-all-macros"
                        checked={
                          preferences?.showProtein !== false &&
                          preferences?.showCarbs !== false &&
                          preferences?.showFats !== false
                        }
                        onCheckedChange={async (checked) => {
                          await updatePreferences({
                            showProtein: checked,
                            showCarbs: checked,
                            showFats: checked,
                          });
                        }}
                      />
                    </div>

                    {/* Individual macro controls - only show if at least one is enabled */}
                    {(preferences?.showProtein !== false ||
                      preferences?.showCarbs !== false ||
                      preferences?.showFats !== false) && (
                      <div className="ml-4 space-y-2 mt-2">
                        <div className="flex items-center justify-between py-1">
                          <Label
                            htmlFor="show-protein"
                            className="text-sm text-muted-foreground"
                          >
                            Protein
                          </Label>
                          <Switch
                            id="show-protein"
                            checked={preferences?.showProtein !== false}
                            onCheckedChange={async (checked) => {
                              await updatePreferences({ showProtein: checked });
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between py-1">
                          <Label
                            htmlFor="show-carbs"
                            className="text-sm text-muted-foreground"
                          >
                            Carbs
                          </Label>
                          <Switch
                            id="show-carbs"
                            checked={preferences?.showCarbs !== false}
                            onCheckedChange={async (checked) => {
                              await updatePreferences({ showCarbs: checked });
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between py-1">
                          <Label
                            htmlFor="show-fats"
                            className="text-sm text-muted-foreground"
                          >
                            Fats
                          </Label>
                          <Switch
                            id="show-fats"
                            checked={preferences?.showFats !== false}
                            onCheckedChange={async (checked) => {
                              await updatePreferences({ showFats: checked });
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </div>

              {/* Dietary Preferences */}
              <DietaryPreferencesCard />

              {/* Account Actions */}
              <div className="space-y-3 mb-8 mt-4">
                <Button
                  variant="outline"
                  className="w-full bg-card hover:bg-muted hover:text-foreground text-foreground transition-opacity hover:opacity-80"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() => router.push("/subscription-required")}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Manage Subscription
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
