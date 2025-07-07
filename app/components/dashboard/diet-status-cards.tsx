import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/app/components/ui/card";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/app/components/ui/skeleton";

export function DietStatusCards() {
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const todayStats = useQuery(api.foodLogs.getTodayStats);
  const latestWeight = useQuery(api.weightLogs.getLatestWeight);
  const preferences = useQuery(api.userPreferences.getUserPreferences);

  if (!profile || !preferences) {
    return <StatusCardsSkeleton />;
  }

  const isStealthMode = preferences.displayMode === "stealth";

  // Calculate progress percentages
  const calorieProgress = todayStats
    ? (todayStats.calories / profile.dailyCalorieTarget) * 100
    : 0;
  const proteinProgress = todayStats
    ? (todayStats.protein / profile.proteinTarget) * 100
    : 0;
  const carbsProgress = todayStats
    ? (todayStats.carbs / profile.carbsTarget) * 100
    : 0;
  const fatsProgress = todayStats
    ? (todayStats.fat / profile.fatTarget) * 100
    : 0;

  // Get status colors
  const getProgressColor = (progress: number, isGoal?: boolean) => {
    if (isGoal) return "text-green-600 bg-green-50";
    if (progress < 80) return "text-yellow-600 bg-yellow-50";
    if (progress <= 100) return "text-green-600 bg-green-50";
    return "text-red-600 bg-red-50";
  };

  const goalEmoji =
    profile.goal === "cut" ? "🔥" : profile.goal === "gain" ? "💪" : "⚖️";
  const goalText =
    profile.goal === "cut"
      ? "Cutting"
      : profile.goal === "gain"
        ? "Bulking"
        : "Maintaining";

  return (
    <div className="grid grid-cols-2 gap-3 px-4 lg:px-6 lg:grid-cols-3">
      {/* Goal Card */}
      <Card
        className={cn(
          "transition-all hover:shadow-md",
          getProgressColor(0, true),
        )}
      >
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Goal
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{goalEmoji}</span>
            <span className="text-xl font-semibold">{goalText}</span>
          </div>
        </CardContent>
      </Card>

      {/* Calories Card */}
      <Card
        className={cn(
          "transition-all hover:shadow-md",
          getProgressColor(calorieProgress),
        )}
      >
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Calories
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {isStealthMode ? (
            <div className="space-y-1">
              <div className="text-xl font-semibold">
                {calorieProgress < 80
                  ? "On Track"
                  : calorieProgress <= 100
                    ? "Great!"
                    : "Over"}
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    calorieProgress < 80
                      ? "bg-yellow-500"
                      : calorieProgress <= 100
                        ? "bg-green-500"
                        : "bg-red-500",
                  )}
                  style={{ width: `${Math.min(calorieProgress, 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="text-xl font-semibold">
                {todayStats?.calories || 0} / {profile.dailyCalorieTarget}
              </div>
              <div className="text-xs text-muted-foreground">
                {profile.dailyCalorieTarget - (todayStats?.calories || 0)}{" "}
                remaining
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Weight Card */}
      <Card className="transition-all hover:shadow-md">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Weight
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-xl font-semibold">
            {latestWeight?.weight || profile.currentWeight}{" "}
            {latestWeight?.unit || "kg"}
          </div>
          {latestWeight?.trend && (
            <div className="text-xs text-muted-foreground">
              {latestWeight.trend > 0 ? "↑" : "↓"}{" "}
              {Math.abs(latestWeight.trend).toFixed(1)} this week
            </div>
          )}
        </CardContent>
      </Card>

      {/* Protein Card */}
      <Card
        className={cn(
          "transition-all hover:shadow-md",
          getProgressColor(proteinProgress),
        )}
      >
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Protein
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {isStealthMode ? (
            <div className="space-y-1">
              <div className="text-xl font-semibold">
                {proteinProgress < 80 ? "Need More" : "Good!"}
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    proteinProgress < 80 ? "bg-yellow-500" : "bg-green-500",
                  )}
                  style={{ width: `${Math.min(proteinProgress, 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="text-xl font-semibold">
                {todayStats?.protein || 0}g / {profile.proteinTarget}g
              </div>
              <div className="text-xs text-muted-foreground">
                {profile.proteinTarget - (todayStats?.protein || 0)}g remaining
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Carbs Card */}
      {!isStealthMode && (
        <Card
          className={cn(
            "transition-all hover:shadow-md",
            getProgressColor(carbsProgress),
          )}
        >
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Carbs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-semibold">
              {todayStats?.carbs || 0}g / {profile.carbsTarget}g
            </div>
            <div className="text-xs text-muted-foreground">
              {profile.carbsTarget - (todayStats?.carbs || 0)}g remaining
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fats Card */}
      {!isStealthMode && (
        <Card
          className={cn(
            "transition-all hover:shadow-md",
            getProgressColor(fatsProgress),
          )}
        >
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fats
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-semibold">
              {todayStats?.fat || 0}g / {profile.fatTarget}g
            </div>
            <div className="text-xs text-muted-foreground">
              {profile.fatTarget - (todayStats?.fat || 0)}g remaining
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 px-4 lg:px-6 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="p-4 pb-2">
            <Skeleton className="h-4 w-16" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
