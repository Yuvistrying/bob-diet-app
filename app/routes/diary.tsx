import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "~/app/components/ui/card";
import { Button } from "~/app/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/app/components/ui/tabs";
import { cn } from "~/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/app/components/ui/dialog";
import { Input } from "~/app/components/ui/input";
import { Label } from "~/app/components/ui/label";
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
    <div className="flex flex-col bg-gray-100 dark:bg-gray-950" style={{ height: "100vh", minHeight: "-webkit-fill-available" }}>
      <Tabs defaultValue="food" value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
        <div className="px-4 pt-4 border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-950">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-950">
            <TabsTrigger 
              value="food" 
              className="flex items-center gap-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:text-white"
            >
              <Utensils className="h-4 w-4" />
              Food
            </TabsTrigger>
            <TabsTrigger 
              value="weight" 
              className="flex items-center gap-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:text-white"
            >
              <Weight className="h-4 w-4" />
              Weight
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="food" className="mt-0 flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto" style={{ paddingBottom: "80px" }}>
            {/* Today's Summary */}
            {isToday && (
              <div className="grid grid-cols-2 gap-2 p-3 border-b border-gray-200 dark:border-gray-800">
                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                  <CardContent className="p-2 text-center">
                    <div className="text-xs text-muted-foreground dark:text-gray-400 uppercase tracking-wider font-mono">🔥 Calories</div>
                    <div className="text-lg font-semibold font-mono text-gray-900 dark:text-gray-100">
                      {isStealthMode ? (
                        todayStats && profile && todayStats.calories > profile.dailyCalorieTarget ? "Over" : "On Track"
                      ) : (
                        `${todayStats?.calories || 0}/${profile?.dailyCalorieTarget || 2000}`
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                  <CardContent className="p-2 text-center">
                    <div className="text-xs text-muted-foreground dark:text-gray-400 uppercase tracking-wider font-mono">🥩 Protein</div>
                    <div className="text-lg font-semibold font-mono text-gray-900 dark:text-gray-100">
                      {isStealthMode ? (
                        todayStats && profile && todayStats.protein < profile.proteinTarget * 0.8 ? "Need More" : "Good"
                      ) : (
                        `${todayStats?.protein || 0}g`
                      )}
                    </div>
                    {!isStealthMode && (
                      <div className="text-xs text-muted-foreground dark:text-gray-400 font-mono">
                        of {profile?.proteinTarget || 150}g
                      </div>
                    )}
                  </CardContent>
                </Card>

                {!isStealthMode && (
                  <>
                    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                      <CardContent className="p-2 text-center">
                        <div className="text-xs text-muted-foreground dark:text-gray-400 uppercase tracking-wider font-mono">🍞 Carbs</div>
                        <div className="text-lg font-semibold font-mono text-gray-900 dark:text-gray-100">
                          {todayStats?.carbs || 0}g
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 font-mono">
                          of {profile?.carbsTarget || 200}g
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                      <CardContent className="p-2 text-center">
                        <div className="text-xs text-muted-foreground dark:text-gray-400 uppercase tracking-wider font-mono">🥑 Fats</div>
                        <div className="text-lg font-semibold font-mono text-gray-900 dark:text-gray-100">
                          {todayStats?.fat || 0}g
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 font-mono">
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
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">📅 {formatDate(selectedDate)}</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-mono">
                  {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
                
                {isToday && (
                  <Card 
                    className="mb-3 cursor-pointer bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 transition-all duration-200 transform hover:scale-[1.02] border-2 border-dashed border-primary/30 dark:border-primary/40 hover:border-primary/50"
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
                    <CardContent className="p-4 flex items-center justify-center gap-3">
                      <div className="bg-primary/20 dark:bg-primary/30 rounded-full p-2">
                        <Plus className="h-5 w-5 text-primary dark:text-primary" />
                      </div>
                      <span className="font-medium text-primary dark:text-primary">Add food entry</span>
                    </CardContent>
                  </Card>
                )}
                
                {foodLogs && foodLogs.length > 0 ? (
                  <div className="space-y-3">
                    {foodLogs.map((log) => (
                      <Card key={log._id} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-medium font-mono text-gray-900 dark:text-gray-100">{log.time}</div>
                            <div className="flex items-center gap-1">
                              {!isStealthMode && (
                                <div className="text-sm text-gray-600 dark:text-gray-400 font-mono mr-2">
                                  {log.totalCalories} kcal
                                </div>
                              )}
                              {isToday && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                                    onClick={() => openEditDialog(log)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
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
                          <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                            {log.description}
                          </div>
                          {!isStealthMode && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                              {log.totalCalories} kcal • {log.totalProtein}g Protein • {log.totalCarbs}g Carbs • {log.totalFat}g Fats
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardContent className="p-8 text-center text-muted-foreground dark:text-gray-400 font-mono">
                      No food logged for this day
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="weight" className="mt-0 flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto px-3 py-3 space-y-4" style={{ paddingBottom: "140px" }}>
            {/* Current Week Section */}
            {currentWeekData && (
              <Card className="max-w-lg mx-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">📅 This Week</h3>
                    {currentWeekData.average && (
                      <div className="mt-2">
                        <div className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">
                          Average: {currentWeekData.average} {profile?.preferredUnits === "imperial" ? "lbs" : "kg"}
                        </div>
                        {weekOverWeekChange && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground dark:text-gray-400 mt-1">
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
                  
                  {/* Today's Weight - Prominent */}
                  {(() => {
                    const today = currentWeekData.days.find(d => d.isToday);
                    if (!today) return null;
                    
                    return (
                      <div className="mb-4">
                        <Card 
                          className="border-primary bg-primary/5 dark:bg-primary/10 cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors"
                          onClick={() => {
                            if (today.weight) {
                              const todayLog = weightLogs?.find(log => log.date === today.date);
                              if (todayLog) openEditWeightDialog(todayLog);
                            } else {
                              setAddType("weight");
                              setAddDialogOpen(true);
                            }
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">📍 Today</span>
                                  <span className="text-sm text-muted-foreground dark:text-gray-400">
                                    {today.dayName}, {new Date(today.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                                {today.weight ? (
                                  <div className="text-2xl font-bold font-mono text-primary dark:text-primary mt-1">
                                    {today.weight} {profile?.preferredUnits === "imperial" ? "lbs" : "kg"}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 mt-2">
                                    <Plus className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
                                    <span className="text-sm text-muted-foreground dark:text-gray-400">Log weight</span>
                                  </div>
                                )}
                              </div>
                              {today.weight && (
                                <Pencil className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()}
                  
                  {/* Past days of the week */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground dark:text-gray-400">Previous Days</h4>
                    <div className="space-y-2">
                      {currentWeekData.days
                        .filter(day => !day.isToday && new Date(day.date) < new Date())
                        .reverse()
                        .map((day) => (
                          <div 
                            key={day.date}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-lg border",
                              day.weight ? "bg-muted/30" : ""
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{day.dayName}</div>
                                <div className="text-xs text-muted-foreground dark:text-gray-400">
                                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">
                              {day.weight ? (
                                <>{day.weight} {profile?.preferredUnits === "imperial" ? "lbs" : "kg"}</>
                              ) : (
                                <span className="text-muted-foreground dark:text-gray-400">—</span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Trends Section */}
            {weeklyTrends && weeklyTrends.length > 0 && (
              <Card className="max-w-lg mx-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardContent className="p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Recent Trends</h3>
                  
                  {/* Trend list */}
                  <div className="space-y-2 mb-4">
                    {weeklyTrends.map((week) => (
                      <div key={week.weekNumber} className="flex justify-between items-center">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{week.week}</span>
                        <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">
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
                              backgroundColor: 'rgb(255, 255, 255)',
                              border: '1px solid rgb(229, 231, 235)',
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
              <Card className="max-w-lg mx-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Monthly Overview</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setMonthOffset(monthOffset - 1)}
                      >
                        <ChevronLeft className="h-4 w-4 text-gray-900 dark:text-gray-100" />
                      </Button>
                      <span className="text-sm font-medium w-32 text-center text-gray-900 dark:text-gray-100">
                        {monthlyProgress.monthName}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setMonthOffset(monthOffset + 1)}
                        disabled={monthOffset >= 0}
                      >
                        <ChevronRight className="h-4 w-4 text-gray-900 dark:text-gray-100" />
                      </Button>
                    </div>
                  </div>
                  
                  {monthlyProgress.monthAverage && (
                    <div className="mb-4">
                      <div className="text-xl font-bold font-mono text-gray-900 dark:text-gray-100">
                        Average: {monthlyProgress.monthAverage} {profile?.preferredUnits === "imperial" ? "lbs" : "kg"}
                      </div>
                      {monthlyProgress.changeFromLastMonth !== null && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground dark:text-gray-400 mt-1">
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
                              backgroundColor: 'rgb(255, 255, 255)',
                              border: '1px solid rgb(229, 231, 235)',
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
            <Card className="max-w-lg mx-auto mb-16 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardContent className="p-4">
                <button
                  onClick={() => setShowFullHistory(!showFullHistory)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Full Log History</h3>
                  {showFullHistory ? (
                    <ChevronLeft className="h-4 w-4 transform rotate-90 text-gray-900 dark:text-gray-100" />
                  ) : (
                    <ChevronLeft className="h-4 w-4 transform -rotate-90 text-gray-900 dark:text-gray-100" />
                  )}
                </button>
                
                {showFullHistory && weightLogs && weightLogs.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                    {weightLogs
                      .filter(log => log.date !== new Date().toISOString().split('T')[0]) // Exclude today's entry
                      .map((log) => {
                      return (
                        <div 
                          key={log._id} 
                          className="flex justify-between items-center p-2 rounded hover:bg-muted/50 dark:hover:bg-gray-800"
                        >
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {formatDate(log.date)}
                            </div>
                            <div className="text-xs text-muted-foreground dark:text-gray-400">
                              {log.time}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">
                              {log.weight} {log.unit}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {showFullHistory && (!weightLogs || weightLogs.length === 0) && (
                  <div className="mt-4 text-center text-muted-foreground dark:text-gray-400 text-sm">
                    No weight entries yet
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </TabsContent>
      </Tabs>


      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">{addType === "food" ? "Add Food Entry" : "Log Weight"}</DialogTitle>
          </DialogHeader>
          
          {addType === "food" && (
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="food-time" className="text-gray-700 dark:text-gray-300">Time</Label>
                <Input
                  id="food-time"
                  type="time"
                  value={foodForm.time}
                  onChange={(e) => setFoodForm({ ...foodForm, time: e.target.value })}
                  className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <Label htmlFor="food-desc" className="text-gray-700 dark:text-gray-300">Description *</Label>
                <Input
                  id="food-desc"
                  placeholder="e.g., Grilled chicken with rice"
                  value={foodForm.description}
                  onChange={(e) => setFoodForm({ ...foodForm, description: e.target.value })}
                  className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="food-cal" className="text-gray-700 dark:text-gray-300">Calories *</Label>
                  <Input
                    id="food-cal"
                    type="number"
                    placeholder="0"
                    value={foodForm.calories}
                    onChange={(e) => setFoodForm({ ...foodForm, calories: e.target.value })}
                    className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <Label htmlFor="food-protein" className="text-gray-700 dark:text-gray-300">Protein (g)</Label>
                  <Input
                    id="food-protein"
                    type="number"
                    placeholder="0"
                    value={foodForm.protein}
                    onChange={(e) => setFoodForm({ ...foodForm, protein: e.target.value })}
                    className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="food-carbs" className="text-gray-700 dark:text-gray-300">Carbs (g)</Label>
                  <Input
                    id="food-carbs"
                    type="number"
                    placeholder="0"
                    value={foodForm.carbs}
                    onChange={(e) => setFoodForm({ ...foodForm, carbs: e.target.value })}
                    className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <Label htmlFor="food-fat" className="text-gray-700 dark:text-gray-300">Fats (g)</Label>
                  <Input
                    id="food-fat"
                    type="number"
                    placeholder="0"
                    value={foodForm.fat}
                    onChange={(e) => setFoodForm({ ...foodForm, fat: e.target.value })}
                    className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
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
                <Label htmlFor="weight" className="text-gray-700 dark:text-gray-300">Weight ({profile?.preferredUnits === "imperial" ? "lbs" : "kg"})</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  placeholder="Enter weight"
                  className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
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
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">Edit Food Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-desc" className="text-gray-700 dark:text-gray-300">Description *</Label>
              <Input
                id="edit-desc"
                value={foodForm.description}
                onChange={(e) => setFoodForm({ ...foodForm, description: e.target.value })}
                className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-cal" className="text-gray-700 dark:text-gray-300">Calories *</Label>
                <Input
                  id="edit-cal"
                  type="number"
                  value={foodForm.calories}
                  onChange={(e) => setFoodForm({ ...foodForm, calories: e.target.value })}
                  className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <Label htmlFor="edit-protein" className="text-gray-700 dark:text-gray-300">Protein (g)</Label>
                <Input
                  id="edit-protein"
                  type="number"
                  value={foodForm.protein}
                  onChange={(e) => setFoodForm({ ...foodForm, protein: e.target.value })}
                  className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-carbs" className="text-gray-700 dark:text-gray-300">Carbs (g)</Label>
                <Input
                  id="edit-carbs"
                  type="number"
                  value={foodForm.carbs}
                  onChange={(e) => setFoodForm({ ...foodForm, carbs: e.target.value })}
                  className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <Label htmlFor="edit-fat" className="text-gray-700 dark:text-gray-300">Fats (g)</Label>
                <Input
                  id="edit-fat"
                  type="number"
                  value={foodForm.fat}
                  onChange={(e) => setFoodForm({ ...foodForm, fat: e.target.value })}
                  className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
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
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">Delete Food Entry?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
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
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">Edit Weight Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-weight" className="text-gray-700 dark:text-gray-300">Weight ({editingWeightLog?.unit || "kg"})</Label>
              <Input
                id="edit-weight"
                type="number"
                step="0.1"
                value={weightForm}
                onChange={(e) => setWeightForm(e.target.value)}
                className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
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