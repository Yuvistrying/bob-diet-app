import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useClerk } from "@clerk/react-router";

export default function Settings() {
  const { signOut } = useClerk();
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const preferences = useQuery(api.userPreferences.getUserPreferences);
  
  const updateProfile = useMutation(api.userProfiles.updateProfileField);
  const updatePreferences = useMutation(api.userPreferences.updatePreferences);
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: profile?.name || "",
    age: profile?.age || 0,
    gender: profile?.gender || "other",
    goal: profile?.goal || "maintain",
  });

  const handleSave = async () => {
    // Update each field individually
    if (formData.name !== profile?.name) {
      await updateProfile({ field: "name", value: formData.name });
    }
    if (formData.age !== profile?.age) {
      await updateProfile({ field: "age", value: formData.age });
    }
    if (formData.gender !== profile?.gender) {
      await updateProfile({ field: "gender", value: formData.gender });
    }
    if (formData.goal !== profile?.goal) {
      await updateProfile({ field: "goal", value: formData.goal });
    }
    setIsEditing(false);
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

  if (!profile || !preferences) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      {/* About You Section */}
      <Card className="m-4">
        <CardHeader>
          <CardTitle>About you</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Label>Gender</Label>
            <p className="text-xs text-gray-600 mb-2">
              Asking because this affects calorie and nutrient recommendations
            </p>
            <ToggleGroup
              type="single"
              value={isEditing ? formData.gender : profile.gender}
              onValueChange={(value) => setFormData({ ...formData, gender: value })}
              disabled={!isEditing}
              className="grid grid-cols-3 gap-2 mt-1"
            >
              <ToggleGroupItem value="female" className="data-[state=on]:bg-gray-800 data-[state=on]:text-white">
                Female
              </ToggleGroupItem>
              <ToggleGroupItem value="male" className="data-[state=on]:bg-gray-800 data-[state=on]:text-white">
                Male
              </ToggleGroupItem>
              <ToggleGroupItem value="other" className="data-[state=on]:bg-gray-800 data-[state=on]:text-white">
                Rather not say
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div>
            <Label>Current Goal</Label>
            <p className="text-xs text-gray-600 mb-2">
              Your daily recommendations will change based on this selection
            </p>
            <ToggleGroup
              type="single"
              value={isEditing ? formData.goal : profile.goal}
              onValueChange={(value) => setFormData({ ...formData, goal: value })}
              disabled={!isEditing}
              className="grid grid-cols-3 gap-2 mt-1"
            >
              <ToggleGroupItem value="gain" className="data-[state=on]:bg-gray-800 data-[state=on]:text-white">
                Gain
              </ToggleGroupItem>
              <ToggleGroupItem value="cut" className="data-[state=on]:bg-gray-800 data-[state=on]:text-white">
                Cut
              </ToggleGroupItem>
              <ToggleGroupItem value="maintain" className="data-[state=on]:bg-gray-800 data-[state=on]:text-white">
                Maintain
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex gap-2 pt-2">
            {isEditing ? (
              <>
                <Button 
                  onClick={handleSave}
                  className="flex-1 bg-gray-800 hover:bg-gray-700"
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
                      gender: profile.gender,
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
      <Card className="m-4">
        <CardHeader>
          <CardTitle>Service Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      {/* Account Actions */}
      <div className="px-4 space-y-3 mb-8">
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => window.location.href = "/subscription-required"}
        >
          Manage Subscription
        </Button>
        
        <Button 
          variant="outline" 
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => signOut()}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}