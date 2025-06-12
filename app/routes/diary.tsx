import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Plus, Utensils, Weight } from "lucide-react";

export default function Logs() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addType, setAddType] = useState<"food" | "weight">("food");
  
  const foodLogs = useQuery(api.foodLogs.getFoodLogsByDate, { date: selectedDate });
  const weightLogs = useQuery(api.weightLogs.getWeightLogs, {});
  const todayStats = useQuery(api.foodLogs.getTodayStats);
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const preferences = useQuery(api.userPreferences.getUserPreferences);
  
  const logWeight = useMutation(api.weightLogs.logWeight);
  
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const isStealthMode = preferences?.displayMode === "stealth";
  
  // Group food logs by date
  const foodLogsByDate = foodLogs?.reduce((acc, log) => {
    const date = log.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {} as Record<string, typeof foodLogs>);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateStr === today.toISOString().split('T')[0]) return "Today";
    if (dateStr === yesterday.toISOString().split('T')[0]) return "Yesterday";
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleAddWeight = async (weight: string) => {
    await logWeight({
      weight: parseFloat(weight),
      unit: "kg",
      notes: ""
    });
    setAddDialogOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="food" className="w-full">
        <div className="bg-white px-4 pt-4">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="food" className="flex items-center gap-2">
              <Utensils className="h-4 w-4" />
              Food
            </TabsTrigger>
            <TabsTrigger value="weight" className="flex items-center gap-2">
              <Weight className="h-4 w-4" />
              Weight
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="food" className="mt-0">
          <div className="flex-1 overflow-y-auto pb-20">
            {/* Today's Summary */}
            {isToday && (
              <div className="grid grid-cols-2 gap-3 p-4 bg-white border-b">
                <Card className={cn(
                  "bg-gray-50",
                  todayStats && profile && todayStats.calories > profile.dailyCalorieTarget && "bg-red-50"
                )}>
                  <CardContent className="p-3">
                    <div className="text-xs text-gray-600 mb-1">Daily Calories</div>
                    <div className="font-semibold">
                      {isStealthMode ? (
                        todayStats && profile && todayStats.calories > profile.dailyCalorieTarget ? "Over" : "On Track"
                      ) : (
                        `${todayStats?.calories || 0}/${profile?.dailyCalorieTarget || 2000}`
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className={cn(
                  "bg-gray-50",
                  todayStats && profile && todayStats.protein < profile.proteinTarget * 0.8 && "bg-yellow-50"
                )}>
                  <CardContent className="p-3">
                    <div className="text-xs text-gray-600 mb-1">Daily Proteins (gr)</div>
                    <div className="font-semibold">
                      {isStealthMode ? (
                        todayStats && profile && todayStats.protein < profile.proteinTarget * 0.8 ? "Need More" : "Good"
                      ) : (
                        `${todayStats?.protein || 0}/${profile?.proteinTarget || 150}`
                      )}
                    </div>
                  </CardContent>
                </Card>

                {!isStealthMode && (
                  <>
                    <Card className="bg-gray-50">
                      <CardContent className="p-3">
                        <div className="text-xs text-gray-600 mb-1">Daily Carbs</div>
                        <div className="font-semibold">
                          {todayStats?.carbs || 0}/{profile?.carbsTarget || 200}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gray-50">
                      <CardContent className="p-3">
                        <div className="text-xs text-gray-600 mb-1">Daily Fats (gr)</div>
                        <div className="font-semibold">
                          {todayStats?.fat || 0}/{profile?.fatTarget || 65}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* Food Logs */}
            <div className="px-4 py-4 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">{formatDate(selectedDate)}</h3>
                <div className="text-sm text-gray-600 mb-3">
                  {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
                
                {foodLogs && foodLogs.length > 0 ? (
                  <div className="space-y-3">
                    {foodLogs.map((log) => (
                      <Card key={log._id} className="bg-gray-50">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-medium">{log.time}</div>
                            {!isStealthMode && (
                              <div className="text-sm text-gray-600">
                                {log.totalCalories} kcal
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-gray-700 mb-2">
                            {log.description}
                          </div>
                          {!isStealthMode && (
                            <div className="text-xs text-gray-500">
                              {log.totalCalories} kcal • {log.totalProtein}g Protein • {log.totalCarbs}g Carbs • {log.totalFat}g Fats
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="bg-gray-50">
                    <CardContent className="p-8 text-center text-gray-500">
                      No food logged for this day
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="weight" className="mt-0">
          <div className="flex-1 overflow-y-auto pb-20">
            {/* Weight Chart Placeholder */}
            <Card className="m-4 bg-gray-50">
              <CardContent className="p-8 text-center">
                <div className="text-lg font-semibold mb-2">Weight Chart</div>
                <div className="text-sm text-gray-600">
                  (Weight trend visualization coming soon)
                </div>
              </CardContent>
            </Card>

            {/* Weight Logs */}
            <div className="px-4 space-y-3">
              {weightLogs && weightLogs.length > 0 ? (
                weightLogs.map((log) => (
                  <Card key={log._id} className="bg-gray-50">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">
                            {formatDate(log.date)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {log.time}
                          </div>
                        </div>
                        <div className="text-xl font-semibold">
                          {log.weight} <span className="text-sm font-normal">{log.unit}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="bg-gray-50">
                  <CardContent className="p-8 text-center text-gray-500">
                    No weight entries yet
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Button */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            className="fixed bottom-20 left-1/2 -translate-x-1/2 rounded-full w-56 bg-gray-800 hover:bg-gray-700"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add or edit entries by chatting
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Add</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Button
              variant="outline"
              className="h-20"
              onClick={() => {
                setAddType("food");
                setAddDialogOpen(false);
                // Navigate to chat
                window.location.href = "/chat";
              }}
            >
              <div className="text-center">
                <Utensils className="h-6 w-6 mx-auto mb-1" />
                <div>Log Food</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-20"
              onClick={() => setAddType("weight")}
            >
              <div className="text-center">
                <Weight className="h-6 w-6 mx-auto mb-1" />
                <div>Log Weight</div>
              </div>
            </Button>
          </div>
          
          {addType === "weight" && (
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  placeholder="Enter weight"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddWeight((e.target as HTMLInputElement).value);
                    }
                  }}
                />
              </div>
              <Button 
                className="w-full"
                onClick={() => {
                  const input = document.getElementById("weight") as HTMLInputElement;
                  if (input?.value) {
                    handleAddWeight(input.value);
                  }
                }}
              >
                Save Weight
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}