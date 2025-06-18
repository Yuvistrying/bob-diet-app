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
import { Plus, Utensils, Weight, Pencil, Trash2, TrendingDown, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Logs() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState("food");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addType, setAddType] = useState<"food" | "weight">("food");
  const [editingLog, setEditingLog] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<Id<"foodLogs"> | null>(null);
  const [editingWeightLog, setEditingWeightLog] = useState<any>(null);
  const [editWeightDialogOpen, setEditWeightDialogOpen] = useState(false);
  const [weightForm, setWeightForm] = useState("");
  const [monthOffset, setMonthOffset] = useState(0);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [foodForm, setFoodForm] = useState({
    time: new Date().toTimeString().slice(0, 5),
    description: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: ""
  });
  
  const foodLogs = useQuery(api.foodLogs.getFoodLogsByDate, { date: selectedDate });
  const weightLogs = useQuery(api.weightLogs.getWeightLogs, {});
  const todayStats = useQuery(api.foodLogs.getTodayStats);
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const preferences = useQuery(api.userPreferences.getUserPreferences);
  const currentWeekData = useQuery(api.weightLogs.getCurrentWeekData);
  const weekOverWeekChange = useQuery(api.weightLogs.getWeekOverWeekChange);
  const weeklyTrends = useQuery(api.weightLogs.getWeeklyTrends);
  const monthlyProgress = useQuery(api.weightLogs.getMonthlyProgress, { monthOffset });
  
  const logWeight = useMutation(api.weightLogs.logWeight);
  const updateWeightLog = useMutation(api.weightLogs.updateWeight);
  const logFood = useMutation(api.foodLogs.logFood);
  const updateFoodLog = useMutation(api.foodLogs.updateFoodLog);
  const deleteFoodLog = useMutation(api.foodLogs.deleteFoodLog);
  
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const isStealthMode = preferences?.displayMode === "stealth";
  
  // Check if weight already logged today
  const todayWeightLog = weightLogs?.find(log => log.date === new Date().toISOString().split('T')[0]);
  
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
      unit: profile?.preferredUnits === "imperial" ? "lbs" : "kg",
      notes: ""
    });
    setAddDialogOpen(false);
  };

  const handleEditWeight = async () => {
    if (!editingWeightLog || !weightForm) return;
    
    await updateWeightLog({
      logId: editingWeightLog._id,
      weight: parseFloat(weightForm)
    });
    
    setEditWeightDialogOpen(false);
    setEditingWeightLog(null);
  };

  const openEditWeightDialog = (log: any) => {
    setEditingWeightLog(log);
    setWeightForm(log.weight.toString());
    setEditWeightDialogOpen(true);
  };

  const handleAddFood = async () => {
    if (!foodForm.description || !foodForm.calories) return;
    
    const foods = [{
      name: foodForm.description,
      quantity: "1 serving",
      calories: parseInt(foodForm.calories),
      protein: parseInt(foodForm.protein) || 0,
      carbs: parseInt(foodForm.carbs) || 0,
      fat: parseInt(foodForm.fat) || 0
    }];
    
    await logFood({
      description: foodForm.description,
      foods,
      aiEstimated: false,
      confidence: "high"
    });
    
    setFoodForm({
      time: new Date().toTimeString().slice(0, 5),
      description: "",
      calories: "",
      protein: "",
      carbs: "",
      fat: ""
    });
    setAddDialogOpen(false);
  };

  const handleEditFood = async () => {
    if (!editingLog || !foodForm.description || !foodForm.calories) return;
    
    const foods = [{
      name: foodForm.description,
      quantity: "1 serving",
      calories: parseInt(foodForm.calories),
      protein: parseInt(foodForm.protein) || 0,
      carbs: parseInt(foodForm.carbs) || 0,
      fat: parseInt(foodForm.fat) || 0
    }];
    
    await updateFoodLog({
      logId: editingLog._id,
      description: foodForm.description,
      foods
    });
    
    setEditDialogOpen(false);
    setEditingLog(null);
  };

  const handleDeleteFood = async () => {
    if (!deletingLogId) return;
    
    await deleteFoodLog({ logId: deletingLogId });
    setDeleteConfirmOpen(false);
    setDeletingLogId(null);
  };

  const openEditDialog = (log: any) => {
    setEditingLog(log);
    setFoodForm({
      time: log.time,
      description: log.description,
      calories: log.totalCalories.toString(),
      protein: log.totalProtein.toString(),
      carbs: log.totalCarbs.toString(),
      fat: log.totalFat.toString()
    });
    setEditDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Tabs defaultValue="food" value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
        <div className="px-4 pt-4 border-b">
          <TabsList className="grid w-full grid-cols-2">
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

        <TabsContent value="food" className="mt-0 flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto pb-20">
            {/* Today's Summary */}
            {isToday && (
              <div className="grid grid-cols-2 gap-2 p-3 border-b">
                <Card>
                  <CardContent className="p-2 text-center">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">🔥 Calories</div>
                    <div className="text-lg font-semibold font-mono">
                      {isStealthMode ? (
                        todayStats && profile && todayStats.calories > profile.dailyCalorieTarget ? "Over" : "On Track"
                      ) : (
                        `${todayStats?.calories || 0}/${profile?.dailyCalorieTarget || 2000}`
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-2 text-center">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">🥩 Protein</div>
                    <div className="text-lg font-semibold font-mono">
                      {isStealthMode ? (
                        todayStats && profile && todayStats.protein < profile.proteinTarget * 0.8 ? "Need More" : "Good"
                      ) : (
                        `${todayStats?.protein || 0}g`
                      )}
                    </div>
                    {!isStealthMode && (
                      <div className="text-xs text-muted-foreground font-mono">
                        of {profile?.proteinTarget || 150}g
                      </div>
                    )}
                  </CardContent>
                </Card>

                {!isStealthMode && (
                  <>
                    <Card>
                      <CardContent className="p-2 text-center">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">🍞 Carbs</div>
                        <div className="text-lg font-semibold font-mono">
                          {todayStats?.carbs || 0}g
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          of {profile?.carbsTarget || 200}g
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-2 text-center">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">🥑 Fats</div>
                        <div className="text-lg font-semibold font-mono">
                          {todayStats?.fat || 0}g
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          of {profile?.fatTarget || 65}g
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* Food Logs */}
            <div className="px-3 py-3 space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">📅 {formatDate(selectedDate)}</h3>
                <div className="text-sm text-gray-600 mb-3 font-mono">
                  {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
                
                {foodLogs && foodLogs.length > 0 ? (
                  <div className="space-y-3">
                    {foodLogs.map((log) => (
                      <Card key={log._id}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-medium font-mono">{log.time}</div>
                            <div className="flex items-center gap-1">
                              {!isStealthMode && (
                                <div className="text-sm text-gray-600 font-mono mr-2">
                                  {log.totalCalories} kcal
                                </div>
                              )}
                              {isToday && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => openEditDialog(log)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-red-600 hover:text-red-700"
                                    onClick={() => {
                                      setDeletingLogId(log._id);
                                      setDeleteConfirmOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-700 mb-2">
                            {log.description}
                          </div>
                          {!isStealthMode && (
                            <div className="text-xs text-gray-500 font-mono">
                              {log.totalCalories} kcal • {log.totalProtein}g Protein • {log.totalCarbs}g Carbs • {log.totalFat}g Fats
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground font-mono">
                      No food logged for this day
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="weight" className="mt-0 flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto pb-20 px-3 py-3 space-y-4">
            {/* Current Week Section */}
            {currentWeekData && (
              <Card>
                <CardContent className="p-4">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">Current Week</h3>
                    {currentWeekData.average && (
                      <div className="mt-2">
                        <div className="text-2xl font-bold font-mono">
                          {currentWeekData.average} {profile?.preferredUnits === "imperial" ? "lbs" : "kg"}
                        </div>
                        {weekOverWeekChange && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            {weekOverWeekChange.change > 0 ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : weekOverWeekChange.change < 0 ? (
                              <TrendingDown className="h-4 w-4" />
                            ) : null}
                            <span className="font-mono">
                              {weekOverWeekChange.change > 0 ? "+" : ""}{weekOverWeekChange.change} {profile?.preferredUnits === "imperial" ? "lbs" : "kg"} from last week
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Week days grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {currentWeekData.days.map((day) => (
                      <div 
                        key={day.date} 
                        className={cn(
                          "text-center p-2 rounded-lg border relative",
                          day.isToday ? "border-primary bg-primary/10" : "border-border",
                          day.weight && !day.isToday ? "bg-muted/30" : ""
                        )}
                      >
                        {day.isToday && (
                          <div className="text-xs font-semibold text-primary mb-0.5">
                            📍 Today
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {day.dayName}
                        </div>
                        <div className={cn(
                          "text-sm font-medium",
                          day.isToday && "font-bold"
                        )}>
                          {day.dayNumber}
                        </div>
                        {day.weight && (
                          <div className={cn(
                            "text-xs font-mono mt-1",
                            day.isToday && "font-bold text-primary"
                          )}>
                            {day.weight}
                          </div>
                        )}
                        {day.isToday && day.weight && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 absolute top-0 right-0 m-1"
                            onClick={() => {
                              const todayLog = weightLogs?.find(log => log.date === day.date);
                              if (todayLog) openEditWeightDialog(todayLog);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Trends Section */}
            {weeklyTrends && weeklyTrends.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-lg font-semibold mb-3">Recent Trends</h3>
                  
                  {/* Trend list */}
                  <div className="space-y-2 mb-4">
                    {weeklyTrends.map((week) => (
                      <div key={week.weekNumber} className="flex justify-between items-center">
                        <span className="text-sm">{week.week}</span>
                        <span className="text-sm font-mono font-medium">
                          {week.average} {profile?.preferredUnits === "imperial" ? "lbs" : "kg"} ({week.entryCount} entries)
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Minimal line chart */}
                  {weeklyTrends.length > 1 && (
                    <div className="h-32 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklyTrends} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                          <XAxis 
                            dataKey="week" 
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            hide={true}
                            domain={['dataMin - 0.5', 'dataMax + 0.5']}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '12px'
                            }}
                            formatter={(value: any) => `${value} ${profile?.preferredUnits === "imperial" ? "lbs" : "kg"}`}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="average" 
                            stroke="#6b7280" 
                            strokeWidth={2}
                            dot={{ fill: '#6b7280', r: 3 }}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Monthly Overview */}
            {monthlyProgress && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Monthly Overview</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setMonthOffset(monthOffset - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium w-32 text-center">
                        {monthlyProgress.monthName}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setMonthOffset(monthOffset + 1)}
                        disabled={monthOffset >= 0}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {monthlyProgress.monthAverage && (
                    <div className="mb-4">
                      <div className="text-xl font-bold font-mono">
                        Average: {monthlyProgress.monthAverage} {profile?.preferredUnits === "imperial" ? "lbs" : "kg"}
                      </div>
                      {monthlyProgress.changeFromLastMonth !== null && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          {monthlyProgress.changeFromLastMonth > 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : monthlyProgress.changeFromLastMonth < 0 ? (
                            <TrendingDown className="h-4 w-4" />
                          ) : null}
                          <span className="font-mono">
                            {monthlyProgress.changeFromLastMonth > 0 ? "+" : ""}{monthlyProgress.changeFromLastMonth} {profile?.preferredUnits === "imperial" ? "lbs" : "kg"} from previous month
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Monthly chart */}
                  {monthlyProgress.weeklyData.length > 1 && (
                    <div className="h-32 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyProgress.weeklyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                          <XAxis 
                            dataKey="week" 
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            hide={true}
                            domain={['dataMin - 0.5', 'dataMax + 0.5']}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '12px'
                            }}
                            formatter={(value: any) => `${value} ${profile?.preferredUnits === "imperial" ? "lbs" : "kg"}`}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="average" 
                            stroke="#6b7280" 
                            strokeWidth={2}
                            dot={{ fill: '#6b7280', r: 3 }}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Full Log History (Collapsible) */}
            <Card>
              <CardContent className="p-4">
                <button
                  onClick={() => setShowFullHistory(!showFullHistory)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <h3 className="text-lg font-semibold">Full Log History</h3>
                  {showFullHistory ? (
                    <ChevronLeft className="h-4 w-4 transform rotate-90" />
                  ) : (
                    <ChevronLeft className="h-4 w-4 transform -rotate-90" />
                  )}
                </button>
                
                {showFullHistory && weightLogs && weightLogs.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                    {weightLogs.map((log) => {
                      const isToday = log.date === new Date().toISOString().split('T')[0];
                      return (
                        <div 
                          key={log._id} 
                          className={cn(
                            "flex justify-between items-center p-2 rounded",
                            isToday ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                          )}
                        >
                          <div>
                            {isToday && (
                              <div className="text-xs font-semibold text-primary">
                                📍 Today
                              </div>
                            )}
                            <div className={cn(
                              "text-sm font-medium",
                              isToday && "font-bold"
                            )}>
                              {formatDate(log.date)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {log.time}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-sm font-mono font-medium",
                              isToday && "font-bold text-primary"
                            )}>
                              {log.weight} {log.unit}
                            </span>
                            {isToday && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => openEditWeightDialog(log)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {showFullHistory && (!weightLogs || weightLogs.length === 0) && (
                  <div className="mt-4 text-center text-muted-foreground text-sm">
                    No weight entries yet
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </TabsContent>
      </Tabs>

      {/* Add Button - Context aware */}
      {activeTab === "food" ? (
        <Button 
          className="fixed bottom-20 left-1/2 -translate-x-1/2 rounded-full w-56"
          onClick={() => {
            setAddType("food");
            setFoodForm({
              time: new Date().toTimeString().slice(0, 5),
              description: "",
              calories: "",
              protein: "",
              carbs: "",
              fat: ""
            });
            setAddDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          🍽️ Add Food
        </Button>
      ) : (
        <Button 
          className="fixed bottom-20 left-1/2 -translate-x-1/2 rounded-full w-56"
          onClick={() => {
            setAddType("weight");
            setAddDialogOpen(true);
          }}
          disabled={!!todayWeightLog}
        >
          <Plus className="h-4 w-4 mr-2" />
          {todayWeightLog ? "⚖️ Weight logged today" : "⚖️ Add Weight"}
        </Button>
      )}

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{addType === "food" ? "Add Food Entry" : "Log Weight"}</DialogTitle>
          </DialogHeader>
          
          {addType === "food" && (
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="food-time">Time</Label>
                <Input
                  id="food-time"
                  type="time"
                  value={foodForm.time}
                  onChange={(e) => setFoodForm({ ...foodForm, time: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="food-desc">Description *</Label>
                <Input
                  id="food-desc"
                  placeholder="e.g., Grilled chicken with rice"
                  value={foodForm.description}
                  onChange={(e) => setFoodForm({ ...foodForm, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="food-cal">Calories *</Label>
                  <Input
                    id="food-cal"
                    type="number"
                    placeholder="0"
                    value={foodForm.calories}
                    onChange={(e) => setFoodForm({ ...foodForm, calories: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="food-protein">Protein (g)</Label>
                  <Input
                    id="food-protein"
                    type="number"
                    placeholder="0"
                    value={foodForm.protein}
                    onChange={(e) => setFoodForm({ ...foodForm, protein: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="food-carbs">Carbs (g)</Label>
                  <Input
                    id="food-carbs"
                    type="number"
                    placeholder="0"
                    value={foodForm.carbs}
                    onChange={(e) => setFoodForm({ ...foodForm, carbs: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="food-fat">Fats (g)</Label>
                  <Input
                    id="food-fat"
                    type="number"
                    placeholder="0"
                    value={foodForm.fat}
                    onChange={(e) => setFoodForm({ ...foodForm, fat: e.target.value })}
                  />
                </div>
              </div>
              <Button 
                className="w-full"
                onClick={handleAddFood}
                disabled={!foodForm.description || !foodForm.calories}
              >
                Add Food Entry
              </Button>
            </div>
          )}
          
          {addType === "weight" && (
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="weight">Weight ({profile?.preferredUnits === "imperial" ? "lbs" : "kg"})</Label>
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

      {/* Edit Food Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Food Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-desc">Description *</Label>
              <Input
                id="edit-desc"
                value={foodForm.description}
                onChange={(e) => setFoodForm({ ...foodForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-cal">Calories *</Label>
                <Input
                  id="edit-cal"
                  type="number"
                  value={foodForm.calories}
                  onChange={(e) => setFoodForm({ ...foodForm, calories: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-protein">Protein (g)</Label>
                <Input
                  id="edit-protein"
                  type="number"
                  value={foodForm.protein}
                  onChange={(e) => setFoodForm({ ...foodForm, protein: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-carbs">Carbs (g)</Label>
                <Input
                  id="edit-carbs"
                  type="number"
                  value={foodForm.carbs}
                  onChange={(e) => setFoodForm({ ...foodForm, carbs: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-fat">Fats (g)</Label>
                <Input
                  id="edit-fat"
                  type="number"
                  value={foodForm.fat}
                  onChange={(e) => setFoodForm({ ...foodForm, fat: e.target.value })}
                />
              </div>
            </div>
            <Button 
              className="w-full"
              onClick={handleEditFood}
              disabled={!foodForm.description || !foodForm.calories}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Food Entry?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this food entry? This action cannot be undone.
          </p>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDeleteFood}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Weight Dialog */}
      <Dialog open={editWeightDialogOpen} onOpenChange={setEditWeightDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Weight Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-weight">Weight ({editingWeightLog?.unit || "kg"})</Label>
              <Input
                id="edit-weight"
                type="number"
                step="0.1"
                value={weightForm}
                onChange={(e) => setWeightForm(e.target.value)}
              />
            </div>
            <Button 
              className="w-full"
              onClick={handleEditWeight}
              disabled={!weightForm}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}