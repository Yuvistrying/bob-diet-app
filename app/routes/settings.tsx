import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/react-router";
import { useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { Button } from "~/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/app/components/ui/card";
import { Label } from "~/app/components/ui/label";
import { Switch } from "~/app/components/ui/switch";
import { Input } from "~/app/components/ui/input";
import { ArrowLeft, Bell, Scale, Sun, Moon } from "lucide-react";
import { useToast } from "~/app/components/ui/use-toast";

export default function Settings() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Queries
  const preferences = useQuery(api.userPreferences.getUserPreferences);
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  
  // Mutations
  const updatePreferences = useMutation(api.userPreferences.updatePreferences);
  
  // Local state
  const [reminderSettings, setReminderSettings] = useState({
    weighInReminder: true,
    mealReminders: false,
    reminderTimes: {
      weighIn: "08:00",
      breakfast: "09:00",
      lunch: "13:00",
      dinner: "19:00"
    }
  });
  
  const [displaySettings, setDisplaySettings] = useState({
    displayMode: "standard",
    darkMode: false,
    cuteMode: false
  });
  
  // Initialize from preferences
  useEffect(() => {
    if (preferences) {
      setReminderSettings(preferences.reminderSettings || {
        weighInReminder: true,
        mealReminders: false,
        reminderTimes: {
          weighIn: "08:00",
          breakfast: "09:00",
          lunch: "13:00",
          dinner: "19:00"
        }
      });
      
      setDisplaySettings({
        displayMode: preferences.displayMode || "standard",
        darkMode: preferences.darkMode || false,
        cuteMode: preferences.cuteMode || false
      });
    }
  }, [preferences]);
  
  // Redirect if not signed in
  useEffect(() => {
    if (isSignedIn === false) {
      navigate("/sign-in");
    }
  }, [isSignedIn, navigate]);
  
  const handleSave = async () => {
    try {
      await updatePreferences({
        reminderSettings,
        displayMode: displaySettings.displayMode,
        darkMode: displaySettings.darkMode,
        cuteMode: displaySettings.cuteMode
      });
      
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  if (isSignedIn === undefined || !preferences || !profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }
  
  if (!isSignedIn) {
    return null;
  }
  
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/chat")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>
      
      {/* Reminder Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Reminder Settings
          </CardTitle>
          <CardDescription>
            Configure when Bob should remind you to log your meals and weight
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Weight Reminder */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="weigh-reminder">Daily Weigh-in Reminder</Label>
                <p className="text-sm text-gray-500">Get reminded to log your weight each morning</p>
              </div>
              <Switch
                id="weigh-reminder"
                checked={reminderSettings.weighInReminder}
                onCheckedChange={(checked) => 
                  setReminderSettings(prev => ({ ...prev, weighInReminder: checked }))
                }
              />
            </div>
            
            {reminderSettings.weighInReminder && (
              <div className="ml-6">
                <Label htmlFor="weigh-time">Reminder Time</Label>
                <Input
                  id="weigh-time"
                  type="time"
                  value={reminderSettings.reminderTimes.weighIn}
                  onChange={(e) => 
                    setReminderSettings(prev => ({
                      ...prev,
                      reminderTimes: { ...prev.reminderTimes, weighIn: e.target.value }
                    }))
                  }
                  className="w-32 mt-1"
                />
              </div>
            )}
          </div>
          
          {/* Meal Reminders */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="meal-reminders">Meal Logging Reminders</Label>
                <p className="text-sm text-gray-500">Get reminded if you haven't logged meals</p>
              </div>
              <Switch
                id="meal-reminders"
                checked={reminderSettings.mealReminders}
                onCheckedChange={(checked) => 
                  setReminderSettings(prev => ({ ...prev, mealReminders: checked }))
                }
              />
            </div>
            
            {reminderSettings.mealReminders && (
              <div className="ml-6 space-y-3">
                <div>
                  <Label htmlFor="breakfast-time">Breakfast Reminder</Label>
                  <Input
                    id="breakfast-time"
                    type="time"
                    value={reminderSettings.reminderTimes.breakfast}
                    onChange={(e) => 
                      setReminderSettings(prev => ({
                        ...prev,
                        reminderTimes: { ...prev.reminderTimes, breakfast: e.target.value }
                      }))
                    }
                    className="w-32 mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lunch-time">Lunch Reminder</Label>
                  <Input
                    id="lunch-time"
                    type="time"
                    value={reminderSettings.reminderTimes.lunch}
                    onChange={(e) => 
                      setReminderSettings(prev => ({
                        ...prev,
                        reminderTimes: { ...prev.reminderTimes, lunch: e.target.value }
                      }))
                    }
                    className="w-32 mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="dinner-time">Dinner Reminder</Label>
                  <Input
                    id="dinner-time"
                    type="time"
                    value={reminderSettings.reminderTimes.dinner}
                    onChange={(e) => 
                      setReminderSettings(prev => ({
                        ...prev,
                        reminderTimes: { ...prev.reminderTimes, dinner: e.target.value }
                      }))
                    }
                    className="w-32 mt-1"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
          <CardDescription>
            Customize how Bob shows your information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stealth Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="stealth-mode">Stealth Mode</Label>
              <p className="text-sm text-gray-500">Hide numbers and focus on habits</p>
            </div>
            <Switch
              id="stealth-mode"
              checked={displaySettings.displayMode === "stealth"}
              onCheckedChange={(checked) => 
                setDisplaySettings(prev => ({ ...prev, displayMode: checked ? "stealth" : "standard" }))
              }
            />
          </div>
          
          {/* Dark Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="dark-mode">Dark Mode</Label>
              <p className="text-sm text-gray-500">Easier on the eyes at night</p>
            </div>
            <Switch
              id="dark-mode"
              checked={displaySettings.darkMode}
              onCheckedChange={(checked) => 
                setDisplaySettings(prev => ({ ...prev, darkMode: checked }))
              }
            />
          </div>
          
          {/* Cute Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="cute-mode">Cute Mode</Label>
              <p className="text-sm text-gray-500">Add more emojis and fun to Bob's personality</p>
            </div>
            <Switch
              id="cute-mode"
              checked={displaySettings.cuteMode}
              onCheckedChange={(checked) => 
                setDisplaySettings(prev => ({ ...prev, cuteMode: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="w-full sm:w-auto">
          Save Changes
        </Button>
      </div>
    </div>
  );
}