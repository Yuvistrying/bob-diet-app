"use client";

import { cn } from "~/lib/utils";
import { designTokens } from "~/app/design-system/tokens";

interface StatsCardsProps {
  profile?: any;
  todayStats?: any;
  latestWeight?: any;
  preferences?: any;
  isStealthMode?: boolean;
}

export function StatsCards({
  profile,
  todayStats,
  latestWeight,
  preferences,
  isStealthMode = false,
}: StatsCardsProps) {
  const getProgressColor = (value: number, target: number) => {
    const percentage = (value / target) * 100;
    if (percentage < 80) return "text-foreground-secondary";
    if (percentage < 100) return "text-warning";
    return "text-destructive";
  };

  const getProgressPercentage = (value: number, target: number) => {
    return Math.min((value / target) * 100, 100);
  };

  return (
    <div className="px-4 py-3 space-y-3 bg-background-secondary border-b border-separator">
      {/* Weight & Goal Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Goal Card */}
        <div className="bg-background-elevated rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-caption text-foreground-secondary">Goal</span>
          </div>
          <div className="text-body font-semibold text-foreground">
            {profile?.goal === "cut"
              ? "Cut"
              : profile?.goal === "gain"
                ? "Gain"
                : "Maintain"}
          </div>
          {profile?.targetWeight && (
            <div className="text-caption text-foreground-tertiary mt-0.5">
              Target: {profile.targetWeight}{" "}
              {profile?.preferredUnits === "imperial" ? "lbs" : "kg"}
            </div>
          )}
        </div>

        {/* Current Weight Card */}
        <div className="bg-background-elevated rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-caption text-foreground-secondary">
              Weight
            </span>
          </div>
          <div className="text-body font-semibold text-foreground">
            {latestWeight?.weight || profile?.currentWeight || "—"}
            <span className="text-caption text-foreground-secondary ml-1">
              {latestWeight?.unit ||
                (profile?.preferredUnits === "imperial" ? "lbs" : "kg")}
            </span>
          </div>
          {!latestWeight && (
            <div className="text-caption text-warning mt-0.5">
              Weigh in today
            </div>
          )}
        </div>
      </div>

      {/* Nutrition Card */}
      <div className="bg-background-elevated rounded-xl p-3">
        <div className="text-caption text-foreground-secondary mb-2">
          Today&apos;s Progress
        </div>

        {/* Calories */}
        <div className="space-y-2">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-body-small text-foreground">Calories</span>
              <span
                className={cn(
                  "text-body-small font-medium",
                  todayStats && profile
                    ? getProgressColor(
                        todayStats.calories,
                        profile.dailyCalorieTarget,
                      )
                    : "",
                )}
              >
                {isStealthMode
                  ? todayStats &&
                    profile &&
                    todayStats.calories > profile.dailyCalorieTarget
                    ? "Over"
                    : "OK"
                  : `${todayStats?.calories || 0} / ${profile?.dailyCalorieTarget || 2000}`}
              </span>
            </div>
            <div className="h-1.5 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{
                  width: `${getProgressPercentage(todayStats?.calories || 0, profile?.dailyCalorieTarget || 2000)}%`,
                }}
              />
            </div>
          </div>

          {/* Protein */}
          {preferences?.showProtein !== false && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-body-small text-foreground">Protein</span>
                <span
                  className={cn(
                    "text-body-small font-medium",
                    todayStats && profile?.proteinTarget
                      ? getProgressColor(
                          todayStats.protein,
                          profile.proteinTarget,
                        )
                      : "",
                  )}
                >
                  {isStealthMode
                    ? todayStats &&
                      profile &&
                      todayStats.protein < profile.proteinTarget * 0.8
                      ? "Low"
                      : "OK"
                    : `${todayStats?.protein || 0}g / ${profile?.proteinTarget || 150}g`}
                </span>
              </div>
              <div className="h-1.5 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all duration-300"
                  style={{
                    width: `${getProgressPercentage(todayStats?.protein || 0, profile?.proteinTarget || 150)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Carbs - Only show if not stealth mode */}
          {!isStealthMode && preferences?.showCarbs !== false && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-body-small text-foreground">Carbs</span>
                <span className="text-body-small font-medium text-foreground-secondary">
                  {todayStats?.carbs || 0}g / {profile?.carbsTarget || 200}g
                </span>
              </div>
              <div className="h-1.5 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-warning rounded-full transition-all duration-300"
                  style={{
                    width: `${getProgressPercentage(todayStats?.carbs || 0, profile?.carbsTarget || 200)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Fats - Only show if not stealth mode */}
          {!isStealthMode && preferences?.showFats !== false && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-body-small text-foreground">Fats</span>
                <span className="text-body-small font-medium text-foreground-secondary">
                  {todayStats?.fat || 0}g / {profile?.fatTarget || 65}g
                </span>
              </div>
              <div className="h-1.5 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary rounded-full transition-all duration-300"
                  style={{
                    width: `${getProgressPercentage(todayStats?.fat || 0, profile?.fatTarget || 65)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
