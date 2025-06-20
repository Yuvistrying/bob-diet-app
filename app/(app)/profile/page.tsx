"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "~/app/components/ui/card";
import { Button } from "~/app/components/ui/button";
import { Input } from "~/app/components/ui/input";
import { Label } from "~/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/app/components/ui/select";
import { Switch } from "~/app/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "~/app/components/ui/toggle-group";
import { useAuth } from "@clerk/nextjs";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";

export default function Profile() {
  const { signOut } = useAuth();
  const router = useRouter();
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const preferences = useQuery(api.userPreferences.getUserPreferences);
  const latestWeight = useQuery(api.weightLogs.getLatestWeight);
  const activeGoal = useQuery(api.goalHistory.getActiveGoal);
  
  const updateProfile = useMutation(api.userProfiles.updateProfileField);
  const updatePreferences = useMutation(api.userPreferences.updatePreferences);
  const createGoal = useMutation(api.goalHistory.createGoal);
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: profile?.name || "",
    age: profile?.age || 0,
    height: profile?.height || 170,
    targetWeight: profile?.targetWeight || 70,
    gender: profile?.gender || "other",
    activityLevel: profile?.activityLevel || "moderate",
    goal: profile?.goal || "maintain",
  });
  
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  const handleSave = async () => {
    // Validate goal and weight consistency
    let finalFormData = { ...formData };
    const currentWeight = latestWeight?.weight || profile?.currentWeight || 70;
    
    // Check for conflicts and auto-adjust
    if (formData.goal === "cut" && formData.targetWeight >= currentWeight) {
      setValidationWarning("Target weight should be less than current weight for cutting. Adjusting goal to 'maintain'.");
      finalFormData.goal = "maintain";
    } else if (formData.goal === "gain" && formData.targetWeight <= currentWeight) {
      setValidationWarning("Target weight should be more than current weight for gaining. Adjusting goal to 'maintain'.");
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
      await updateProfile({ field: "targetWeight", value: finalFormData.targetWeight });
    }
    
    // Check if we need to create/update goal history
    if (finalFormData.goal !== profile?.goal || !activeGoal) {
      await createGoal({
        goal: finalFormData.goal,
        startingWeight: currentWeight,
        targetWeight: finalFormData.targetWeight,
        startingUnit: profile?.preferredUnits === "imperial" ? "lbs" : "kg"
      });
    }
    if (finalFormData.gender !== profile?.gender) {
      await updateProfile({ field: "gender", value: finalFormData.gender });
    }
    if (finalFormData.activityLevel !== profile?.activityLevel) {
      await updateProfile({ field: "activityLevel", value: finalFormData.activityLevel });
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
      darkMode: checked
    });
  };

  const handleToggleCuteMode = async (checked: boolean) => {
    await updatePreferences({
      cuteMode: checked
    });
  };

  return (
    <div className="flex flex-col bg-gray-100 dark:bg-gray-950" style={{ height: "100vh", minHeight: "-webkit-fill-available" }}>
      <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-950" style={{ paddingBottom: "60px" }}>
        <div className="max-w-lg mx-auto px-4">
      {/* Always show sign out button at the top */}
      <div className="pt-4">
        <Button 
          variant="outline" 
          className="w-full text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 border-gray-200 dark:border-gray-800"
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
        >
          🚀 Sign Out
        </Button>
      </div>

      {/* Show loading if profile not ready */}
      {(!profile || !preferences) ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">Loading profile...</p>
          </div>
        </div>
      ) : (
        <>
      {/* About You Section */}
      <Card className="mt-4 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-gray-900 dark:text-gray-100">👤 About you</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">Name</Label>
            <Input
              id="name"
              value={isEditing ? formData.name : profile.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={!isEditing}
              className="mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-400"
            />
          </div>

          <div>
            <Label htmlFor="age" className="text-gray-700 dark:text-gray-300">Age</Label>
            <Input
              id="age"
              type="number"
              value={isEditing ? formData.age : profile.age}
              onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) })}
              disabled={!isEditing}
              className="mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-400"
            />
          </div>

          <div>
            <Label htmlFor="height" className="text-gray-700 dark:text-gray-300">Height (cm)</Label>
            <Input
              id="height"
              type="number"
              value={isEditing ? formData.height : profile.height}
              onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) })}
              disabled={!isEditing}
              className="mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-400"
            />
          </div>

          {/* Starting Weight */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">Starting Weight</Label>
            <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
              <div className="text-lg font-semibold font-mono text-gray-900 dark:text-gray-100">
                🏁 {activeGoal?.startingWeight || profile?.currentWeight || "—"} {activeGoal?.startingUnit || (profile?.preferredUnits === "imperial" ? "lbs" : "kg")}
              </div>
              {activeGoal && (
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  Goal started: {new Date(activeGoal.startedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Current Weight */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">Current Weight</Label>
            <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
              <div className="text-lg font-semibold font-mono text-gray-900 dark:text-gray-100">
                ⚖️ {latestWeight?.weight || profile?.currentWeight || "—"} {latestWeight?.unit || (profile?.preferredUnits === "imperial" ? "lbs" : "kg")}
              </div>
              {latestWeight && (
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  Last logged: {new Date(latestWeight._creationTime).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="targetWeight" className="text-gray-700 dark:text-gray-300">Target Weight ({profile?.preferredUnits === "imperial" ? "lbs" : "kg"})</Label>
            <Input
              id="targetWeight"
              type="number"
              step="0.1"
              value={isEditing ? formData.targetWeight : profile.targetWeight}
              onChange={(e) => {
                const newTarget = parseFloat(e.target.value);
                setFormData({ ...formData, targetWeight: newTarget });
                const currentWeight = latestWeight?.weight || profile?.currentWeight || 70;
                // Check for conflicts
                if (formData.goal === "cut" && newTarget >= currentWeight) {
                  setValidationWarning("For cutting, target weight should be less than current weight");
                } else if (formData.goal === "gain" && newTarget <= currentWeight) {
                  setValidationWarning("For gaining, target weight should be more than current weight");
                } else {
                  setValidationWarning(null);
                }
              }}
              disabled={!isEditing}
              className="mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-400"
            />
          </div>

          <div>
            <Label className="text-gray-700 dark:text-gray-300">Gender</Label>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-mono">
              Asking because this affects calorie and nutrient recommendations
            </p>
            <ToggleGroup
              type="single"
              value={isEditing ? formData.gender : profile.gender}
              onValueChange={(value) => setFormData({ ...formData, gender: value })}
              disabled={!isEditing}
              className="grid grid-cols-3 gap-2 mt-1"
            >
              <ToggleGroupItem value="female" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
                Female
              </ToggleGroupItem>
              <ToggleGroupItem value="male" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
                Male
              </ToggleGroupItem>
              <ToggleGroupItem value="other" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
                Rather not say
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div>
            <Label className="text-gray-700 dark:text-gray-300">Activity Level</Label>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-mono">
              How active are you on a typical day?
            </p>
            <Select 
              value={isEditing ? formData.activityLevel : profile.activityLevel}
              onValueChange={(value) => setFormData({ ...formData, activityLevel: value })}
              disabled={!isEditing}
            >
              <SelectTrigger className="mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectItem value="sedentary" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Sedentary (little to no exercise)</SelectItem>
                <SelectItem value="light" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Light (exercise 1-3 days/week)</SelectItem>
                <SelectItem value="moderate" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Moderate (exercise 3-5 days/week)</SelectItem>
                <SelectItem value="active" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Very Active (exercise 6-7 days/week)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-700 dark:text-gray-300">Current Goal</Label>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-mono">
              Your daily recommendations will change based on this selection
            </p>
            <ToggleGroup
              type="single"
              value={isEditing ? formData.goal : profile.goal}
              onValueChange={(value) => {
                setFormData({ ...formData, goal: value });
                const currentWeight = latestWeight?.weight || profile?.currentWeight || 70;
                // Check for conflicts
                if (value === "cut" && formData.targetWeight >= currentWeight) {
                  setValidationWarning("For cutting, target weight should be less than current weight");
                } else if (value === "gain" && formData.targetWeight <= currentWeight) {
                  setValidationWarning("For gaining, target weight should be more than current weight");
                } else if (value === "maintain") {
                  setValidationWarning("Target weight will be set to match current weight");
                } else {
                  setValidationWarning(null);
                }
              }}
              disabled={!isEditing}
              className="grid grid-cols-3 gap-2 mt-1"
            >
              <ToggleGroupItem value="gain" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
                Gain
              </ToggleGroupItem>
              <ToggleGroupItem value="cut" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
                Cut
              </ToggleGroupItem>
              <ToggleGroupItem value="maintain" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
                Maintain
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Validation Warning */}
          {validationWarning && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-1.5 rounded-md text-sm font-mono">
              ⚠️ {validationWarning}
            </div>
          )}

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button 
                  onClick={handleSave}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Save Changes
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: profile.name,
                      age: profile.age,
                      height: profile.height,
                      targetWeight: profile.targetWeight,
                      gender: profile.gender,
                      activityLevel: profile.activityLevel,
                      goal: profile.goal,
                    });
                  }}
                  className="flex-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="w-full bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700"
              >
                Edit Profile
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Service Preferences */}
      <Card className="mt-4 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-gray-900 dark:text-gray-100">⚙️ Service Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="language" className="text-gray-700 dark:text-gray-300">Language</Label>
            <Select defaultValue={preferences.language || "en"}>
              <SelectTrigger className="mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectItem value="en" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">English</SelectItem>
                <SelectItem value="he" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Hebrew</SelectItem>
                <SelectItem value="es" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">Spanish</SelectItem>
                <SelectItem value="fr" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">French</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-2">
            <Label htmlFor="dark-mode" className="text-gray-700 dark:text-gray-300">Dark mode</Label>
            <Switch
              id="dark-mode"
              checked={preferences.darkMode}
              onCheckedChange={handleToggleMode}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <Label htmlFor="cute-mode" className="text-gray-700 dark:text-gray-300">Cute mode</Label>
            <Switch
              id="cute-mode"
              checked={preferences.cuteMode}
              onCheckedChange={handleToggleCuteMode}
            />
          </div>

          {/* Macro Visibility Settings */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
            <div className="text-sm font-medium mb-3 text-gray-900 dark:text-gray-100">Macro Display Settings</div>
            
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="show-all-macros" className="text-gray-700 dark:text-gray-300">Show Macros</Label>
              <Switch
                id="show-all-macros"
                checked={preferences.showProtein !== false && preferences.showCarbs !== false && preferences.showFats !== false}
                onCheckedChange={async (checked) => {
                  await updatePreferences({ 
                    showProtein: checked,
                    showCarbs: checked,
                    showFats: checked
                  });
                }}
              />
            </div>

            {/* Individual macro controls - only show if at least one is enabled */}
            {(preferences.showProtein !== false || preferences.showCarbs !== false || preferences.showFats !== false) && (
              <div className="ml-4 space-y-2 mt-2">
                <div className="flex items-center justify-between py-1">
                  <Label htmlFor="show-protein" className="text-sm text-gray-700 dark:text-gray-300">Protein</Label>
                  <Switch
                    id="show-protein"
                    checked={preferences.showProtein !== false}
                    onCheckedChange={async (checked) => {
                      await updatePreferences({ showProtein: checked });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <Label htmlFor="show-carbs" className="text-sm text-gray-700 dark:text-gray-300">Carbs</Label>
                  <Switch
                    id="show-carbs"
                    checked={preferences.showCarbs !== false}
                    onCheckedChange={async (checked) => {
                      await updatePreferences({ showCarbs: checked });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <Label htmlFor="show-fats" className="text-sm text-gray-700 dark:text-gray-300">Fats</Label>
                  <Switch
                    id="show-fats"
                    checked={preferences.showFats !== false}
                    onCheckedChange={async (checked) => {
                      await updatePreferences({ showFats: checked });
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <div className="space-y-3 mb-8 mt-4">
        <Button 
          variant="outline" 
          className="w-full bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700"
          onClick={() => router.push("/subscription-required")}
        >
          💳 Manage Subscription
        </Button>
      </div>
      </>
      )}
        </div>
      </div>
    </div>
  );
}