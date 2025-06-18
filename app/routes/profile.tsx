import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useAuth } from "@clerk/react-router";
import { cn } from "~/lib/utils";

export default function Profile() {
  const { signOut } = useAuth();
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const preferences = useQuery(api.userPreferences.getUserPreferences, {});
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
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-lg mx-auto px-4">
      {/* Always show sign out button at the top */}
      <div className="pt-4">
        <Button 
          variant="outline" 
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => signOut()}
        >
          🚀 Sign Out
        </Button>
      </div>

      {/* Show loading if profile not ready */}
      {(!profile || !preferences) ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Loading profile...</p>
          </div>
        </div>
      ) : (
        <>
      {/* About You Section */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">👤 About you</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={isEditing ? formData.name : profile.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={!isEditing}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              value={isEditing ? formData.age : profile.age}
              onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) })}
              disabled={!isEditing}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="height">Height (cm)</Label>
            <Input
              id="height"
              type="number"
              value={isEditing ? formData.height : profile.height}
              onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) })}
              disabled={!isEditing}
              className="mt-1"
            />
          </div>

          {/* Starting Weight */}
          <div>
            <Label>Starting Weight</Label>
            <div className="mt-1 p-2 bg-muted/30 rounded-md">
              <div className="text-lg font-semibold font-mono">
                🏁 {activeGoal?.startingWeight || profile?.currentWeight || "—"} {activeGoal?.startingUnit || (profile?.preferredUnits === "imperial" ? "lbs" : "kg")}
              </div>
              {activeGoal && (
                <div className="text-xs text-muted-foreground font-mono">
                  Goal started: {new Date(activeGoal.startedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Current Weight */}
          <div>
            <Label>Current Weight</Label>
            <div className="mt-1 p-2 bg-muted/30 rounded-md">
              <div className="text-lg font-semibold font-mono">
                ⚖️ {latestWeight?.weight || profile?.currentWeight || "—"} {latestWeight?.unit || (profile?.preferredUnits === "imperial" ? "lbs" : "kg")}
              </div>
              {latestWeight && (
                <div className="text-xs text-muted-foreground font-mono">
                  Last logged: {new Date(latestWeight._creationTime).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="targetWeight">Target Weight ({profile?.preferredUnits === "imperial" ? "lbs" : "kg"})</Label>
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
              className="mt-1"
            />
          </div>

          <div>
            <Label>Gender</Label>
            <p className="text-xs text-gray-600 mb-2 font-mono">
              Asking because this affects calorie and nutrient recommendations
            </p>
            <ToggleGroup
              type="single"
              value={isEditing ? formData.gender : profile.gender}
              onValueChange={(value) => setFormData({ ...formData, gender: value })}
              disabled={!isEditing}
              className="grid grid-cols-3 gap-2 mt-1"
            >
              <ToggleGroupItem value="female">
                Female
              </ToggleGroupItem>
              <ToggleGroupItem value="male">
                Male
              </ToggleGroupItem>
              <ToggleGroupItem value="other">
                Rather not say
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div>
            <Label>Activity Level</Label>
            <p className="text-xs text-gray-600 mb-2 font-mono">
              How active are you on a typical day?
            </p>
            <Select 
              value={isEditing ? formData.activityLevel : profile.activityLevel}
              onValueChange={(value) => setFormData({ ...formData, activityLevel: value })}
              disabled={!isEditing}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentary (little to no exercise)</SelectItem>
                <SelectItem value="light">Light (exercise 1-3 days/week)</SelectItem>
                <SelectItem value="moderate">Moderate (exercise 3-5 days/week)</SelectItem>
                <SelectItem value="active">Very Active (exercise 6-7 days/week)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Current Goal</Label>
            <p className="text-xs text-gray-600 mb-2 font-mono">
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
              <ToggleGroupItem value="gain">
                Gain
              </ToggleGroupItem>
              <ToggleGroupItem value="cut">
                Cut
              </ToggleGroupItem>
              <ToggleGroupItem value="maintain">
                Maintain
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Validation Warning */}
          {validationWarning && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-2 py-1.5 rounded-md text-sm font-mono">
              ⚠️ {validationWarning}
            </div>
          )}

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button 
                  onClick={handleSave}
                  className="flex-1"
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
                  className="flex-1"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="w-full"
              >
                Edit Profile
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Service Preferences */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">⚙️ Service Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="language">Language</Label>
            <Select defaultValue={preferences.language || "en"}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="he">Hebrew</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-2">
            <Label htmlFor="dark-mode">Dark mode</Label>
            <Switch
              id="dark-mode"
              checked={preferences.darkMode}
              onCheckedChange={handleToggleMode}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <Label htmlFor="cute-mode">Cute mode</Label>
            <Switch
              id="cute-mode"
              checked={preferences.cuteMode}
              onCheckedChange={handleToggleCuteMode}
            />
          </div>

          {/* Macro Visibility Settings */}
          <div className="border-t pt-3 mt-3">
            <div className="text-sm font-medium mb-3">Macro Display Settings</div>
            
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="show-all-macros">Show Macros</Label>
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
                  <Label htmlFor="show-protein" className="text-sm">Protein</Label>
                  <Switch
                    id="show-protein"
                    checked={preferences.showProtein !== false}
                    onCheckedChange={async (checked) => {
                      await updatePreferences({ showProtein: checked });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <Label htmlFor="show-carbs" className="text-sm">Carbs</Label>
                  <Switch
                    id="show-carbs"
                    checked={preferences.showCarbs !== false}
                    onCheckedChange={async (checked) => {
                      await updatePreferences({ showCarbs: checked });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <Label htmlFor="show-fats" className="text-sm">Fats</Label>
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
          className="w-full"
          onClick={() => window.location.href = "/subscription-required"}
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