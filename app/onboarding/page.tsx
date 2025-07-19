"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "~/app/components/ui/button";
import { Input } from "~/app/components/ui/input";
import { Label } from "~/app/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "~/app/components/ui/toggle-group";
import { cn } from "~/lib/utils";

const ONBOARDING_STEPS = [
  "welcome",
  "name",
  "current_weight",
  "target_weight",
  "height_age",
  "gender",
  "activity_level",
  "goal",
  "display_mode",
  "complete",
];

export default function Onboarding() {
  const router = useRouter();
  const onboardingStatus = useQuery(api.onboarding.getOnboardingStatus);
  const saveProgress = useMutation(api.onboarding.saveOnboardingProgress);

  const [currentStep, setCurrentStep] = useState("welcome");
  const [formData, setFormData] = useState<any>({
    display_mode: "standard", // Set default value
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (onboardingStatus) {
      if (onboardingStatus.completed) {
        router.push("/chat");
      } else {
        setCurrentStep(onboardingStatus.currentStep || "welcome");
        setFormData(onboardingStatus.responses || {});
      }
    }
  }, [onboardingStatus, router]);

  const handleNext = async () => {
    setIsLoading(true);
    try {
      await saveProgress({
        step: currentStep,
        response: formData[currentStep],
      });

      const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
      const nextStep = ONBOARDING_STEPS[currentIndex + 1];

      if (nextStep === "complete") {
        router.push("/chat");
      } else {
        setCurrentStep(nextStep);
      }
    } catch (error) {
      console.error("Error saving progress:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                Welcome to Bob Diet Coach! 🎯
              </CardTitle>
              <CardDescription>
                I'm Bob, your personal AI diet coach. Let's get you set up in
                just a few minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  I'll help you track your food, monitor your progress, and
                  reach your health goals.
                </p>
              </div>
              <Button
                onClick={() => {
                  setFormData({ ...formData, welcome: true });
                  setCurrentStep("name");
                }}
                className="w-full"
              >
                Let's Get Started 🚀
              </Button>
            </CardContent>
          </Card>
        );

      case "name":
        return (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>What should I call you?</CardTitle>
              <CardDescription>
                Let's start with your name so I can personalize your experience.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter your name"
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleNext}
                disabled={!formData.name || isLoading}
                className="w-full"
              >
                Next
              </Button>
            </CardContent>
          </Card>
        );

      case "current_weight":
        return (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Current Weight</CardTitle>
              <CardDescription>
                What's your current weight? This helps me track your progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Weight Unit</Label>
                <ToggleGroup
                  type="single"
                  value={
                    formData.current_weight?.unit ||
                    (formData.current_weight ? "kg" : "")
                  }
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      current_weight: {
                        ...formData.current_weight,
                        unit: value,
                      },
                    })
                  }
                >
                  <ToggleGroupItem value="kg" className="flex-1">
                    Kilograms (kg)
                  </ToggleGroupItem>
                  <ToggleGroupItem value="lbs" className="flex-1">
                    Pounds (lbs)
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div>
                <Label htmlFor="weight">Your Weight</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="weight"
                    type="number"
                    value={formData.current_weight?.weight || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        current_weight: {
                          ...formData.current_weight,
                          weight: parseFloat(e.target.value),
                        },
                      })
                    }
                    placeholder="Enter weight"
                    className="flex-1"
                  />
                  <span className="flex items-center px-3 text-muted-foreground">
                    {formData.current_weight?.unit || "kg"}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleNext}
                disabled={
                  !formData.current_weight?.weight ||
                  !formData.current_weight?.unit ||
                  isLoading
                }
                className="w-full"
              >
                Next
              </Button>
            </CardContent>
          </Card>
        );

      case "target_weight":
        return (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Target Weight</CardTitle>
              <CardDescription>
                What's your goal weight? This helps me calculate the right
                approach for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="target">Target Weight</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="target"
                    type="number"
                    value={formData.target_weight?.weight || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        target_weight: {
                          weight: parseFloat(e.target.value),
                          unit: formData.current_weight?.unit || "kg",
                        },
                      })
                    }
                    placeholder="Enter target weight"
                    className="flex-1"
                  />
                  <span className="flex items-center px-3 text-muted-foreground">
                    {formData.current_weight?.unit || "kg"}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg text-sm">
                <p className="font-medium">
                  {formData.current_weight?.weight >
                  formData.target_weight?.weight
                    ? "🎯 Weight Loss Goal"
                    : formData.current_weight?.weight <
                        formData.target_weight?.weight
                      ? "💪 Weight Gain Goal"
                      : "✨ Maintenance Goal"}
                </p>
                <p className="text-muted-foreground mt-1">
                  {formData.current_weight?.weight &&
                  formData.target_weight?.weight
                    ? `${Math.abs(formData.current_weight.weight - formData.target_weight.weight).toFixed(1)} ${formData.current_weight?.unit || "kg"} to go`
                    : "Enter your target weight"}
                </p>
              </div>

              <Button
                onClick={handleNext}
                disabled={!formData.target_weight?.weight || isLoading}
                className="w-full"
              >
                Next
              </Button>
            </CardContent>
          </Card>
        );

      case "height_age":
        return (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Height & Age</CardTitle>
              <CardDescription>
                These help me calculate your calorie needs more accurately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Height Unit</Label>
                <ToggleGroup
                  type="single"
                  value={formData.height_age?.height_unit || ""}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      height_age: {
                        ...formData.height_age,
                        height_unit: value,
                      },
                    })
                  }
                >
                  <ToggleGroupItem value="cm" className="flex-1">
                    Centimeters (cm)
                  </ToggleGroupItem>
                  <ToggleGroupItem value="ft" className="flex-1">
                    Feet (ft)
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div>
                <Label htmlFor="height">Your Height</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="height"
                    type="number"
                    value={formData.height_age?.height || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        height_age: {
                          ...formData.height_age,
                          height: parseFloat(e.target.value),
                        },
                      })
                    }
                    placeholder="Enter height"
                    className="flex-1"
                  />
                  <span className="flex items-center px-3 text-muted-foreground">
                    {formData.height_age?.height_unit || "cm"}
                  </span>
                </div>
              </div>

              <div>
                <Label htmlFor="age">Your Age</Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.height_age?.age || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      height_age: {
                        ...formData.height_age,
                        age: parseInt(e.target.value),
                      },
                    })
                  }
                  placeholder="Enter age"
                  className="mt-1"
                />
              </div>

              <Button
                onClick={handleNext}
                disabled={
                  !formData.height_age?.height ||
                  !formData.height_age?.age ||
                  !formData.height_age?.height_unit ||
                  isLoading
                }
                className="w-full"
              >
                Next
              </Button>
            </CardContent>
          </Card>
        );

      case "gender":
        return (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Biological Sex</CardTitle>
              <CardDescription>
                This affects your metabolic calculations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select your biological sex</Label>
                <ToggleGroup
                  type="single"
                  value={formData.gender || ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, gender: value })
                  }
                  className="grid grid-cols-3 gap-2"
                >
                  <ToggleGroupItem
                    value="male"
                    className="data-[state=on]:bg-primary"
                  >
                    Male
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="female"
                    className="data-[state=on]:bg-primary"
                  >
                    Female
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="other"
                    className="data-[state=on]:bg-primary"
                  >
                    Other
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <Button
                onClick={handleNext}
                disabled={!formData.gender || isLoading}
                className="w-full"
              >
                Next
              </Button>
            </CardContent>
          </Card>
        );

      case "activity_level":
        return (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Activity Level</CardTitle>
              <CardDescription>
                How active are you in your daily life?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select your activity level</Label>
                <Select
                  value={formData.activity_level || ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, activity_level: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose activity level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">
                      <div>
                        <div className="font-medium">Sedentary</div>
                        <div className="text-sm text-muted-foreground">
                          Little to no exercise, desk job
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="light">
                      <div>
                        <div className="font-medium">Lightly Active</div>
                        <div className="text-sm text-muted-foreground">
                          Light exercise 1-3 days/week
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="moderate">
                      <div>
                        <div className="font-medium">Moderately Active</div>
                        <div className="text-sm text-muted-foreground">
                          Exercise 3-5 days/week
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="active">
                      <div>
                        <div className="font-medium">Very Active</div>
                        <div className="text-sm text-muted-foreground">
                          Hard exercise 6-7 days/week
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleNext}
                disabled={!formData.activity_level || isLoading}
                className="w-full"
              >
                Next
              </Button>
            </CardContent>
          </Card>
        );

      case "goal":
        return (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Your Goal</CardTitle>
              <CardDescription>What are you trying to achieve?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select your primary goal</Label>
                <ToggleGroup
                  type="single"
                  value={formData.goal || ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, goal: value })
                  }
                  className="grid grid-cols-1 gap-2"
                >
                  <ToggleGroupItem
                    value="cut"
                    className={cn("justify-start p-4", {
                      "border-primary": formData.goal === "cut",
                    })}
                  >
                    <div className="text-left">
                      <div className="font-medium">🎯 Cut (Lose Weight)</div>
                      <div className="text-sm text-muted-foreground">
                        Focus on fat loss while preserving muscle
                      </div>
                    </div>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="gain"
                    className={cn("justify-start p-4", {
                      "border-primary": formData.goal === "gain",
                    })}
                  >
                    <div className="text-left">
                      <div className="font-medium">💪 Gain (Build Muscle)</div>
                      <div className="text-sm text-muted-foreground">
                        Build muscle with controlled weight gain
                      </div>
                    </div>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="maintain"
                    className={cn("justify-start p-4", {
                      "border-primary": formData.goal === "maintain",
                    })}
                  >
                    <div className="text-left">
                      <div className="font-medium">⚖️ Maintain</div>
                      <div className="text-sm text-muted-foreground">
                        Maintain current weight and improve health
                      </div>
                    </div>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <Button
                onClick={handleNext}
                disabled={!formData.goal || isLoading}
                className="w-full"
              >
                Next
              </Button>
            </CardContent>
          </Card>
        );

      case "display_mode":
        return (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Display Mode</CardTitle>
              <CardDescription>
                How would you like to see your nutrition data?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Choose your display preference</Label>
                <ToggleGroup
                  type="single"
                  value={formData.display_mode || "standard"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, display_mode: value })
                  }
                  className="grid grid-cols-1 gap-2"
                >
                  <ToggleGroupItem
                    value="standard"
                    className={cn("justify-start p-4", {
                      "border-primary": formData.display_mode === "standard",
                    })}
                  >
                    <div className="text-left">
                      <div className="font-medium">📊 Standard Mode</div>
                      <div className="text-sm text-muted-foreground">
                        See detailed calories and macros for everything
                      </div>
                    </div>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="stealth"
                    className={cn("justify-start p-4", {
                      "border-primary": formData.display_mode === "stealth",
                    })}
                  >
                    <div className="text-left">
                      <div className="font-medium">🥷 Stealth Mode</div>
                      <div className="text-sm text-muted-foreground">
                        Hide numbers, just get simple ✅/❌ feedback
                      </div>
                    </div>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <Button
                onClick={handleNext}
                disabled={isLoading}
                className="w-full"
              >
                Complete Setup
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
  const progress = (currentIndex / (ONBOARDING_STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step indicator */}
        <p className="text-center text-sm text-muted-foreground">
          Step {currentIndex + 1} of {ONBOARDING_STEPS.length - 1}
        </p>

        {/* Current step content */}
        {renderStep()}
      </div>
    </div>
  );
}
