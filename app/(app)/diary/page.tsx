"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
// Removed Card imports - using divs instead
import { Button } from "~/app/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/app/components/ui/tabs";
import { cn } from "~/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/app/components/ui/dialog";
import { Input } from "~/app/components/ui/input";
import { Label } from "~/app/components/ui/label";
import {
  Plus,
  Utensils,
  Weight,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Calendar,
  BarChart3,
  LineChart as LineChartIcon,
} from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BottomNav } from "~/app/components/BottomNav";

export default function Logs() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [activeTab, setActiveTab] = useState("food");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addType, setAddType] = useState<"food" | "weight">("food");
  const [editingLog, setEditingLog] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<Id<"foodLogs"> | null>(
    null,
  );
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
    fat: "",
  });

  const foodLogs = useQuery(api.foodLogs.getFoodLogsByDate, {
    date: selectedDate,
  });
  const weightLogs = useQuery(api.weightLogs.getWeightLogs, {});
  const todayStats = useQuery(api.foodLogs.getTodayStats);
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const preferences = useQuery(api.userPreferences.getUserPreferences);
  const currentWeekData = useQuery(api.weightLogs.getCurrentWeekData);
  const weekOverWeekChange = useQuery(api.weightLogs.getWeekOverWeekChange);
  const weeklyTrends = useQuery(api.weightLogs.getWeeklyTrends);
  const monthlyProgress = useQuery(api.weightLogs.getMonthlyProgress, {
    monthOffset,
  });

  const logWeight = useMutation(api.weightLogs.logWeight);
  const updateWeightLog = useMutation(api.weightLogs.updateWeight);
  const logFood = useMutation(api.foodLogs.logFood);
  const updateFoodLog = useMutation(api.foodLogs.updateFoodLog);
  const deleteFoodLog = useMutation(api.foodLogs.deleteFoodLog);

  const isToday = selectedDate === new Date().toISOString().split("T")[0];
  const isStealthMode = preferences?.displayMode === "stealth";

  // Check if weight already logged today
  const todayWeightLog = weightLogs?.find(
    (log) => log.date === new Date().toISOString().split("T")[0],
  );

  // Group food logs by date
  const foodLogsByDate = foodLogs?.reduce(
    (acc, log) => {
      const date = log.date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(log);
      return acc;
    },
    {} as Record<string, typeof foodLogs>,
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split("T")[0]) return "Today";
    if (dateStr === yesterday.toISOString().split("T")[0]) return "Yesterday";

    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const handleAddWeight = async (weight: string) => {
    await logWeight({
      weight: parseFloat(weight),
      unit: profile?.preferredUnits === "imperial" ? "lbs" : "kg",
      notes: "",
    });
    setAddDialogOpen(false);
  };

  const handleEditWeight = async () => {
    if (!editingWeightLog || !weightForm) return;

    await updateWeightLog({
      logId: editingWeightLog._id,
      weight: parseFloat(weightForm),
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

    const foods = [
      {
        name: foodForm.description,
        quantity: "1 serving",
        calories: parseInt(foodForm.calories),
        protein: parseInt(foodForm.protein) || 0,
        carbs: parseInt(foodForm.carbs) || 0,
        fat: parseInt(foodForm.fat) || 0,
      },
    ];

    await logFood({
      description: foodForm.description,
      foods,
      aiEstimated: false,
      confidence: "high",
    });

    setFoodForm({
      time: new Date().toTimeString().slice(0, 5),
      description: "",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
    });
    setAddDialogOpen(false);
  };

  const handleEditFood = async () => {
    if (!editingLog || !foodForm.description || !foodForm.calories) return;

    const foods = [
      {
        name: foodForm.description,
        quantity: "1 serving",
        calories: parseInt(foodForm.calories),
        protein: parseInt(foodForm.protein) || 0,
        carbs: parseInt(foodForm.carbs) || 0,
        fat: parseInt(foodForm.fat) || 0,
      },
    ];

    await updateFoodLog({
      logId: editingLog._id,
      description: foodForm.description,
      foods,
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
      fat: log.totalFat.toString(),
    });
    setEditDialogOpen(true);
  };

  return (
    <>
      <div className="fixed inset-x-0 top-0 bottom-16 bg-background flex flex-col">
        <Tabs
          defaultValue="food"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full h-full flex flex-col"
        >
          {/* Fixed tabs header */}
          <div className="border-b border-border flex-shrink-0">
            <div className="max-w-lg mx-auto px-4 pt-4 pb-2">
              <TabsList className="grid w-full grid-cols-2 bg-muted p-1 h-auto">
                <TabsTrigger
                  value="food"
                  className="flex items-center gap-2 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md py-2"
                >
                  <Utensils className="h-4 w-4" />
                  Food
                </TabsTrigger>
                <TabsTrigger
                  value="weight"
                  className="flex items-center gap-2 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md py-2"
                >
                  <Weight className="h-4 w-4" />
                  Weight
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="food" className="mt-0 flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto pb-20">
              <div className="max-w-lg mx-auto">
                {/* Today's Summary */}
                {isToday && (
                  <div className="border-b border-border">
                    <div className="grid grid-cols-2 gap-2 p-3">
                      <div className="border border-border rounded-lg h-20">
                        <div className="p-2 text-center flex flex-col justify-center h-full">
                          <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                            <Flame className="h-3 w-3" />
                            Calories
                          </div>
                          <div className="text-lg font-semibold text-foreground">
                            {isStealthMode
                              ? todayStats &&
                                profile &&
                                todayStats.calories > profile.dailyCalorieTarget
                                ? "Over"
                                : "On Track"
                              : `${Math.round(todayStats?.calories || 0)}/${profile?.dailyCalorieTarget || 2000}`}
                          </div>
                        </div>
                      </div>

                      <div className="border border-border rounded-lg h-20">
                        <div className="p-2 text-center flex flex-col justify-center h-full">
                          <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                            <Beef className="h-3 w-3" />
                            Protein
                          </div>
                          <div className="text-lg font-semibold text-foreground">
                            {isStealthMode
                              ? todayStats &&
                                profile &&
                                todayStats.protein < profile.proteinTarget * 0.8
                                ? "Need More"
                                : "Good"
                              : `${Math.round(todayStats?.protein || 0)}g`}
                          </div>
                          {!isStealthMode && (
                            <div className="text-xs text-muted-foreground">
                              of {profile?.proteinTarget || 150}g
                            </div>
                          )}
                        </div>
                      </div>

                      {!isStealthMode && (
                        <>
                          <div className="border border-border rounded-lg h-20">
                            <div className="p-2 text-center flex flex-col justify-center h-full">
                              <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                                <Wheat className="h-3 w-3" />
                                Carbs
                              </div>
                              <div className="text-lg font-semibold text-foreground">
                                {Math.round(todayStats?.carbs || 0)}g
                              </div>
                              <div className="text-xs text-muted-foreground">
                                of {profile?.carbsTarget || 200}g
                              </div>
                            </div>
                          </div>

                          <div className="border border-border rounded-lg h-20">
                            <div className="p-2 text-center flex flex-col justify-center h-full">
                              <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                                <Droplet className="h-3 w-3" />
                                Fats
                              </div>
                              <div className="text-lg font-semibold text-foreground">
                                {Math.round(todayStats?.fat || 0)}g
                              </div>
                              <div className="text-xs text-muted-foreground">
                                of {profile?.fatTarget || 65}g
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Food Logs */}
                <div className="px-3 py-3 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {formatDate(selectedDate)}
                    </h3>
                    <div className="text-sm text-muted-foreground mb-3">
                      {new Date(selectedDate).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>

                    {isToday && (
                      <div
                        className="mb-3 cursor-pointer transition-opacity duration-200 hover:opacity-80 border border-border rounded-lg"
                        onClick={() => {
                          setAddType("food");
                          setFoodForm({
                            time: new Date().toTimeString().slice(0, 5),
                            description: "",
                            calories: "",
                            protein: "",
                            carbs: "",
                            fat: "",
                          });
                          setAddDialogOpen(true);
                        }}
                      >
                        <div className="p-4 flex items-center justify-center gap-3">
                          <div className="bg-muted rounded-full p-2">
                            <Plus className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <span className="font-medium text-foreground">
                            Add food entry
                          </span>
                        </div>
                      </div>
                    )}

                    {foodLogs && foodLogs.length > 0 ? (
                      <div className="space-y-3">
                        {foodLogs.map((log) => (
                          <div
                            key={log._id}
                            className="border border-border rounded-lg"
                          >
                            <div className="p-3">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-medium text-foreground">
                                  {/* Display time in user's local timezone */}
                                  {log.createdAt
                                    ? new Date(
                                        log.createdAt,
                                      ).toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                      })
                                    : log.time}
                                </div>
                                <div className="flex items-center gap-1">
                                  {!isStealthMode && (
                                    <div className="text-sm text-muted-foreground mr-2">
                                      {Math.round(log.totalCalories)} kcal
                                    </div>
                                  )}
                                  {isToday && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground transition-opacity hover:opacity-70"
                                        onClick={() => openEditDialog(log)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive transition-opacity hover:opacity-70"
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
                              <div className="text-sm text-foreground mb-2">
                                {log.description}
                              </div>
                              {!isStealthMode && (
                                <div className="text-xs text-muted-foreground">
                                  {Math.round(log.totalCalories)} kcal •{" "}
                                  {Math.round(log.totalProtein)}g Protein •{" "}
                                  {Math.round(log.totalCarbs)}g Carbs •{" "}
                                  {Math.round(log.totalFat)}g Fats
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border border-border rounded-lg">
                        <div className="p-8 text-center text-muted-foreground">
                          No food logged for this day
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="weight" className="mt-0 flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto pb-24">
              <div className="max-w-lg mx-auto px-3 py-3 space-y-4">
                {/* Current Week Section */}
                {currentWeekData && (
                  <div className="border border-border rounded-lg">
                    <div className="p-4">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          This Week
                        </h3>
                        {currentWeekData.average && (
                          <div className="mt-2">
                            <div className="text-2xl font-bold text-foreground">
                              Average: {currentWeekData.average}{" "}
                              {profile?.preferredUnits === "imperial"
                                ? "lbs"
                                : "kg"}
                            </div>
                            {weekOverWeekChange && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                {weekOverWeekChange.change > 0 ? (
                                  <TrendingUp className="h-4 w-4" />
                                ) : weekOverWeekChange.change < 0 ? (
                                  <TrendingDown className="h-4 w-4" />
                                ) : null}
                                <span className="">
                                  {weekOverWeekChange.change > 0 ? "+" : ""}
                                  {weekOverWeekChange.change}{" "}
                                  {profile?.preferredUnits === "imperial"
                                    ? "lbs"
                                    : "kg"}{" "}
                                  from last week
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Today's Weight - Prominent */}
                      {(() => {
                        const today = currentWeekData.days.find(
                          (d) => d.isToday,
                        );
                        if (!today) return null;

                        return (
                          <div className="mb-4">
                            <div
                              className="border border-border bg-muted/50 cursor-pointer transition-opacity hover:opacity-80 rounded-lg"
                              onClick={() => {
                                if (today.weight) {
                                  const todayLog = weightLogs?.find(
                                    (log) => log.date === today.date,
                                  );
                                  if (todayLog) openEditWeightDialog(todayLog);
                                } else {
                                  setAddType("weight");
                                  setAddDialogOpen(true);
                                }
                              }}
                            >
                              <div className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg font-semibold text-foreground">
                                        Today
                                      </span>
                                      <span className="text-sm text-muted-foreground">
                                        {today.dayName},{" "}
                                        {new Date(
                                          today.date,
                                        ).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </span>
                                    </div>
                                    {today.weight ? (
                                      <div className="text-2xl font-bold text-foreground mt-1">
                                        {today.weight}{" "}
                                        {profile?.preferredUnits === "imperial"
                                          ? "lbs"
                                          : "kg"}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 mt-2">
                                        <Plus className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">
                                          Log weight
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  {today.weight && (
                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Past days of the week */}
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                          Previous Days
                        </h4>
                        <div className="space-y-2">
                          {currentWeekData.days
                            .filter(
                              (day) =>
                                !day.isToday && new Date(day.date) < new Date(),
                            )
                            .reverse()
                            .map((day) => (
                              <div
                                key={day.date}
                                className={cn(
                                  "flex items-center justify-between p-2 rounded-lg border",
                                  day.weight ? "bg-muted/30" : "",
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div>
                                    <div className="text-sm font-medium text-foreground">
                                      {day.dayName}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(day.date).toLocaleDateString(
                                        "en-US",
                                        { month: "short", day: "numeric" },
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm font-mono font-medium text-foreground">
                                  {day.weight ? (
                                    <>
                                      {day.weight}{" "}
                                      {profile?.preferredUnits === "imperial"
                                        ? "lbs"
                                        : "kg"}
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Trends Section */}
                {weeklyTrends && weeklyTrends.length > 0 && (
                  <div className="border border-border rounded-lg">
                    <div className="p-4">
                      <h3 className="text-lg font-semibold mb-3 text-foreground">
                        Recent Trends
                      </h3>

                      {/* Trend list */}
                      <div className="space-y-2 mb-4">
                        {weeklyTrends.map((week) => (
                          <div
                            key={week.weekNumber}
                            className="flex justify-between items-center"
                          >
                            <span className="text-sm text-foreground">
                              {week.week}
                            </span>
                            <span className="text-sm font-mono font-medium text-foreground">
                              {week.average}{" "}
                              {profile?.preferredUnits === "imperial"
                                ? "lbs"
                                : "kg"}{" "}
                              ({week.entryCount} entries)
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Minimal line chart */}
                      {weeklyTrends.length > 1 && (
                        <div className="h-32 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={weeklyTrends}
                              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                            >
                              <XAxis
                                dataKey="week"
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                              />
                              <YAxis
                                hide={true}
                                domain={["dataMin - 0.5", "dataMax + 0.5"]}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "rgb(255, 255, 255)",
                                  border: "1px solid rgb(229, 231, 235)",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                }}
                                formatter={(value: any) =>
                                  `${value} ${profile?.preferredUnits === "imperial" ? "lbs" : "kg"}`
                                }
                              />
                              <Line
                                type="monotone"
                                dataKey="average"
                                stroke="#6b7280"
                                strokeWidth={2}
                                dot={{ fill: "#6b7280", r: 3 }}
                                activeDot={{ r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Monthly Overview */}
                {monthlyProgress && (
                  <div className="border border-border rounded-lg">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-foreground">
                          Monthly Overview
                        </h3>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setMonthOffset(monthOffset - 1)}
                          >
                            <ChevronLeft className="h-4 w-4 text-foreground" />
                          </Button>
                          <span className="text-sm font-medium w-32 text-center text-foreground">
                            {monthlyProgress.monthName}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setMonthOffset(monthOffset + 1)}
                            disabled={monthOffset >= 0}
                          >
                            <ChevronRight className="h-4 w-4 text-foreground" />
                          </Button>
                        </div>
                      </div>

                      {monthlyProgress.monthAverage && (
                        <div className="mb-4">
                          <div className="text-xl font-bold font-mono text-foreground">
                            Average: {monthlyProgress.monthAverage}{" "}
                            {profile?.preferredUnits === "imperial"
                              ? "lbs"
                              : "kg"}
                          </div>
                          {monthlyProgress.changeFromLastMonth !== null && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              {monthlyProgress.changeFromLastMonth > 0 ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : monthlyProgress.changeFromLastMonth < 0 ? (
                                <TrendingDown className="h-4 w-4" />
                              ) : null}
                              <span className="">
                                {monthlyProgress.changeFromLastMonth > 0
                                  ? "+"
                                  : ""}
                                {monthlyProgress.changeFromLastMonth}{" "}
                                {profile?.preferredUnits === "imperial"
                                  ? "lbs"
                                  : "kg"}{" "}
                                from previous month
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Monthly chart */}
                      {monthlyProgress.weeklyData.length > 1 && (
                        <div className="h-32 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={monthlyProgress.weeklyData}
                              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                            >
                              <XAxis
                                dataKey="week"
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                              />
                              <YAxis
                                hide={true}
                                domain={["dataMin - 0.5", "dataMax + 0.5"]}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "rgb(255, 255, 255)",
                                  border: "1px solid rgb(229, 231, 235)",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                }}
                                formatter={(value: any) =>
                                  `${value} ${profile?.preferredUnits === "imperial" ? "lbs" : "kg"}`
                                }
                              />
                              <Line
                                type="monotone"
                                dataKey="average"
                                stroke="#6b7280"
                                strokeWidth={2}
                                dot={{ fill: "#6b7280", r: 3 }}
                                activeDot={{ r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Full Log History (Collapsible) */}
                <div className="max-w-lg mx-auto mb-4 border border-border rounded-lg">
                  <div className="p-4">
                    <button
                      onClick={() => setShowFullHistory(!showFullHistory)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h3 className="text-lg font-semibold text-foreground">
                        Full Log History
                      </h3>
                      {showFullHistory ? (
                        <ChevronLeft className="h-4 w-4 transform rotate-90 text-foreground" />
                      ) : (
                        <ChevronLeft className="h-4 w-4 transform -rotate-90 text-foreground" />
                      )}
                    </button>

                    {showFullHistory && weightLogs && weightLogs.length > 0 && (
                      <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                        {weightLogs
                          .filter(
                            (log) =>
                              log.date !==
                              new Date().toISOString().split("T")[0],
                          ) // Exclude today's entry
                          .map((log) => {
                            return (
                              <div
                                key={log._id}
                                className="flex justify-between items-center p-2 rounded hover:bg-muted/50 dark:hover:bg-gray-800"
                              >
                                <div>
                                  <div className="text-sm font-medium text-foreground">
                                    {formatDate(log.date)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {log.time}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">
                                    {log.weight} {log.unit}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {showFullHistory &&
                      (!weightLogs || weightLogs.length === 0) && (
                        <div className="mt-4 text-center text-muted-foreground text-sm">
                          No weight entries yet
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {addType === "food" ? "Add Food Entry" : "Log Weight"}
            </DialogTitle>
          </DialogHeader>

          {addType === "food" && (
            <div className="mt-4 space-y-4">
              <div>
                <Label
                  htmlFor="food-time"
                  className="text-muted-foreground mb-2"
                >
                  Time
                </Label>
                <Input
                  id="food-time"
                  type="time"
                  value={foodForm.time}
                  onChange={(e) =>
                    setFoodForm({ ...foodForm, time: e.target.value })
                  }
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div>
                <Label
                  htmlFor="food-desc"
                  className="text-muted-foreground mb-2"
                >
                  Description *
                </Label>
                <Input
                  id="food-desc"
                  placeholder="e.g., Grilled chicken with rice"
                  value={foodForm.description}
                  onChange={(e) =>
                    setFoodForm({ ...foodForm, description: e.target.value })
                  }
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="food-cal"
                    className="text-muted-foreground mb-2"
                  >
                    Calories *
                  </Label>
                  <Input
                    id="food-cal"
                    type="number"
                    placeholder="0"
                    value={foodForm.calories}
                    onChange={(e) =>
                      setFoodForm({ ...foodForm, calories: e.target.value })
                    }
                    className="bg-input border-border text-foreground"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="food-protein"
                    className="text-muted-foreground mb-2"
                  >
                    Protein (g)
                  </Label>
                  <Input
                    id="food-protein"
                    type="number"
                    placeholder="0"
                    value={foodForm.protein}
                    onChange={(e) =>
                      setFoodForm({ ...foodForm, protein: e.target.value })
                    }
                    className="bg-input border-border text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="food-carbs"
                    className="text-muted-foreground mb-2"
                  >
                    Carbs (g)
                  </Label>
                  <Input
                    id="food-carbs"
                    type="number"
                    placeholder="0"
                    value={foodForm.carbs}
                    onChange={(e) =>
                      setFoodForm({ ...foodForm, carbs: e.target.value })
                    }
                    className="bg-input border-border text-foreground"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="food-fat"
                    className="text-muted-foreground mb-2"
                  >
                    Fats (g)
                  </Label>
                  <Input
                    id="food-fat"
                    type="number"
                    placeholder="0"
                    value={foodForm.fat}
                    onChange={(e) =>
                      setFoodForm({ ...foodForm, fat: e.target.value })
                    }
                    className="bg-input border-border text-foreground"
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
                <Label htmlFor="weight" className="text-muted-foreground mb-2">
                  Weight (
                  {profile?.preferredUnits === "imperial" ? "lbs" : "kg"})
                </Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  placeholder="Enter weight"
                  className="bg-input border-border text-foreground"
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
                  const input = document.getElementById(
                    "weight",
                  ) as HTMLInputElement;
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
        <DialogContent className="border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Edit Food Entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-desc" className="text-muted-foreground mb-2">
                Description *
              </Label>
              <Input
                id="edit-desc"
                value={foodForm.description}
                onChange={(e) =>
                  setFoodForm({ ...foodForm, description: e.target.value })
                }
                className="bg-input border-border text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="edit-cal"
                  className="text-muted-foreground mb-2"
                >
                  Calories *
                </Label>
                <Input
                  id="edit-cal"
                  type="number"
                  value={foodForm.calories}
                  onChange={(e) =>
                    setFoodForm({ ...foodForm, calories: e.target.value })
                  }
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div>
                <Label
                  htmlFor="edit-protein"
                  className="text-muted-foreground mb-2"
                >
                  Protein (g)
                </Label>
                <Input
                  id="edit-protein"
                  type="number"
                  value={foodForm.protein}
                  onChange={(e) =>
                    setFoodForm({ ...foodForm, protein: e.target.value })
                  }
                  className="bg-input border-border text-foreground"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="edit-carbs"
                  className="text-muted-foreground mb-2"
                >
                  Carbs (g)
                </Label>
                <Input
                  id="edit-carbs"
                  type="number"
                  value={foodForm.carbs}
                  onChange={(e) =>
                    setFoodForm({ ...foodForm, carbs: e.target.value })
                  }
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div>
                <Label
                  htmlFor="edit-fat"
                  className="text-muted-foreground mb-2"
                >
                  Fats (g)
                </Label>
                <Input
                  id="edit-fat"
                  type="number"
                  value={foodForm.fat}
                  onChange={(e) =>
                    setFoodForm({ ...foodForm, fat: e.target.value })
                  }
                  className="bg-input border-border text-foreground"
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
        <DialogContent className="border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Delete Food Entry?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this food entry? This action cannot
            be undone.
          </p>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="flex-1 transition-opacity hover:opacity-80"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 transition-opacity hover:opacity-80"
              onClick={handleDeleteFood}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Weight Dialog */}
      <Dialog
        open={editWeightDialogOpen}
        onOpenChange={setEditWeightDialogOpen}
      >
        <DialogContent className="border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Edit Weight Entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label
                htmlFor="edit-weight"
                className="text-muted-foreground mb-2"
              >
                Weight ({editingWeightLog?.unit || "kg"})
              </Label>
              <Input
                id="edit-weight"
                type="number"
                step="0.1"
                value={weightForm}
                onChange={(e) => setWeightForm(e.target.value)}
                className="bg-input border-border text-foreground"
              />
            </div>
            <Button
              className="w-full transition-opacity hover:opacity-80"
              onClick={handleEditWeight}
              disabled={!weightForm}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <BottomNav />
    </>
  );
}
