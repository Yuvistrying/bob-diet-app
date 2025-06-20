import { Card, CardContent } from "~/app/components/ui/card";
import { Button } from "~/app/components/ui/button";
import { AlertCircle, Coffee, Sandwich, UtensilsCrossed, Cookie } from "lucide-react";
import { cn } from "~/lib/utils";

interface MealReminderCardProps {
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  timeWindow: string;
  onLogMeal: () => void;
  onDismiss: () => void;
}

export function MealReminderCard({ mealType, timeWindow, onLogMeal, onDismiss }: MealReminderCardProps) {
  const getMealIcon = () => {
    switch (mealType) {
      case "breakfast":
        return <Coffee className="h-5 w-5" />;
      case "lunch":
        return <Sandwich className="h-5 w-5" />;
      case "dinner":
        return <UtensilsCrossed className="h-5 w-5" />;
      case "snack":
        return <Cookie className="h-5 w-5" />;
    }
  };
  
  const getMealEmoji = () => {
    switch (mealType) {
      case "breakfast":
        return "🥐";
      case "lunch":
        return "🥗";
      case "dinner":
        return "🍽️";
      case "snack":
        return "🍿";
    }
  };
  
  return (
    <Card className="bg-amber-50 border-amber-200 mb-4">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="bg-amber-100 p-2 rounded-lg">
            {getMealIcon()}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-amber-900">
                Time to log your {mealType}! {getMealEmoji()}
              </h3>
            </div>
            <p className="text-sm text-amber-700">
              {mealType === "breakfast" && "Start your day right by tracking your morning meal."}
              {mealType === "lunch" && "Don't forget to log your midday fuel!"}
              {mealType === "dinner" && "End your day strong by logging your evening meal."}
              {mealType === "snack" && "Had a snack? Every bite counts!"}
            </p>
            <p className="text-xs text-amber-600">
              Typical time: {timeWindow}
            </p>
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={onLogMeal}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Log {mealType}
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={onDismiss}
                className="text-amber-700 hover:text-amber-800"
              >
                Remind me later
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MissedMealsSummaryProps {
  missedMeals: string[];
  onAddMeals: () => void;
}

export function MissedMealsSummary({ missedMeals, onAddMeals }: MissedMealsSummaryProps) {
  if (missedMeals.length === 0) return null;
  
  return (
    <Card className="bg-orange-50 border-orange-200 mb-4">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <h3 className="font-medium text-orange-900">
              You missed logging {missedMeals.length} meal{missedMeals.length > 1 ? 's' : ''} today
            </h3>
            <p className="text-sm text-orange-700">
              {missedMeals.join(", ")} - Would you like to add them now? It's not too late!
            </p>
            <Button 
              size="sm" 
              onClick={onAddMeals}
              className="mt-2 bg-orange-600 hover:bg-orange-700 text-white"
            >
              Add missed meals
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}