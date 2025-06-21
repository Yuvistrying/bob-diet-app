import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "~/app/components/ui/button";
import { Input } from "~/app/components/ui/input";
import { Label } from "~/app/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/app/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/app/components/ui/select";
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
  "complete"
];

export default function Onboarding() {
  const navigate = useNavigate();
  const onboardingStatus = useQuery(api.onboarding.getOnboardingStatus);
  const saveProgress = useMutation(api.onboarding.saveOnboardingProgress);
  
  const [currentStep, setCurrentStep] = useState("welcome");
  const [formData, setFormData] = useState<any>({
    display_mode: "standard" // Set default value
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (onboardingStatus) {
      if (onboardingStatus.completed) {
        navigate("/chat");
      } else {
        setCurrentStep(onboardingStatus.currentStep || "welcome");
        setFormData(onboardingStatus.responses || {});
      }
    }
  }, [onboardingStatus, navigate]);

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
        navigate("/chat");
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
              <CardTitle className="text-2xl">Welcome to Bob Diet Coach! 🎯</CardTitle>
              <CardDescription>
                I'm Bob, your personal AI diet coach. Let's get you set up in just a few minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  I'll help you track your food, monitor your progress, and reach your health goals.
                </p>
                <p className="text-sm text-muted-foreground">
                  Ready to start your journey?
                </p>
              </div>
              <Button 
                className="w-full" 
                onClick={() => {
                  setFormData({ ...formData, welcome: true });
                  handleNext();
                }}
              >
                Let's Go! 💪
              </Button>
            </CardContent>
          </Card>
        );

      case "name":
        return (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>What's your name?</CardTitle>
              <CardDescription>
                So I know what to call you!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">First Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  onKeyPress={(e) => e.key === "Enter" && formData.name && handleNext()}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleNext}
                disabled={!formData.name || isLoading}
              >
                Continue
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
                Don't worry, this is just between us!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight</Label>
                <div className="flex gap-2">
                  <Input
                    id="weight"
                    type="number"
                    placeholder="Enter weight"
                    value={formData.current_weight?.weight || ""}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      current_weight: { 
                        ...formData.current_weight,
                        weight: e.target.value 
                      }
                    })}
                  />
                  <Select
                    value={formData.current_weight?.unit || "kg"}
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      current_weight: { 
                        ...formData.current_weight,
                        unit: value 
                      }
                    })}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="lbs">lbs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button 
                className="w-full" 
                onClick={handleNext}
                disabled={!formData.current_weight?.weight || isLoading}
              >
                Continue
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
                What's your goal weight?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="target">Goal Weight</Label>
                <div className="flex gap-2">
                  <Input
                    id="target"
                    type="number"
                    placeholder="Enter target weight"
                    value={formData.target_weight?.weight || ""}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      target_weight: { 
                        ...formData.target_weight,
                        weight: e.target.value 
                      }
                    })}
                  />
                  <div className="w-20 flex items-center justify-center text-sm text-muted-foreground">
                    {formData.current_weight?.unit || "kg"}
                  </div>
                </div>
              </div>
              <Button 
                className="w-full" 
                onClick={handleNext}
                disabled={!formData.target_weight?.weight || isLoading}
              >
                Continue
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
                This helps me calculate your daily needs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  placeholder="Enter height in cm"
                  value={formData.height_age?.height || ""}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    height_age: { 
                      ...formData.height_age,
                      height: e.target.value 
                    }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="Enter age"
                  value={formData.height_age?.age || ""}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    height_age: { 
                      ...formData.height_age,
                      age: e.target.value 
                    }
                  })}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleNext}
                disabled={!formData.height_age?.height || !formData.height_age?.age || isLoading}
              >
                Continue
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
                For accurate calorie calculations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleGroup
                type="single"
                value={formData.gender || ""}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
                className="grid grid-cols-2 gap-4"
              >
                <ToggleGroupItem value="male" className="h-20">
                  <div className="text-center">
                    <div className="text-2xl mb-1">♂️</div>
                    <div>Male</div>
                  </div>
                </ToggleGroupItem>
                <ToggleGroupItem value="female" className="h-20">
                  <div className="text-center">
                    <div className="text-2xl mb-1">♀️</div>
                    <div>Female</div>
                  </div>
                </ToggleGroupItem>
              </ToggleGroup>
              <Button 
                className="w-full" 
                onClick={handleNext}
                disabled={!formData.gender || isLoading}
              >
                Continue
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
                How active are you typically?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleGroup
                type="single"
                value={formData.activity_level || ""}
                onValueChange={(value) => setFormData({ ...formData, activity_level: value })}
                className="flex flex-col gap-2"
              >
                <ToggleGroupItem value="sedentary" className="justify-start">
                  <div className="text-left">
                    <div className="font-medium">Sedentary</div>
                    <div className="text-xs text-muted-foreground">Little or no exercise</div>
                  </div>
                </ToggleGroupItem>
                <ToggleGroupItem value="light" className="justify-start">
                  <div className="text-left">
                    <div className="font-medium">Lightly Active</div>
                    <div className="text-xs text-muted-foreground">Exercise 1-3 days/week</div>
                  </div>
                </ToggleGroupItem>
                <ToggleGroupItem value="moderate" className="justify-start">
                  <div className="text-left">
                    <div className="font-medium">Moderately Active</div>
                    <div className="text-xs text-muted-foreground">Exercise 3-5 days/week</div>
                  </div>
                </ToggleGroupItem>
                <ToggleGroupItem value="active" className="justify-start">
                  <div className="text-left">
                    <div className="font-medium">Very Active</div>
                    <div className="text-xs text-muted-foreground">Exercise 6-7 days/week</div>
                  </div>
                </ToggleGroupItem>
              </ToggleGroup>
              <Button 
                className="w-full" 
                onClick={handleNext}
                disabled={!formData.activity_level || isLoading}
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        );

      case "goal":
        return (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>What's Your Goal?</CardTitle>
              <CardDescription>
                I'll customize your targets based on this
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleGroup
                type="single"
                value={formData.goal || ""}
                onValueChange={(value) => setFormData({ ...formData, goal: value })}
                className="flex flex-col gap-2"
              >
                <ToggleGroupItem value="cut" className="justify-start">
                  <div className="text-left">
                    <div className="font-medium">Lose Weight 🔥</div>
                    <div className="text-xs text-muted-foreground">Cut calories, lose fat</div>
                  </div>
                </ToggleGroupItem>
                <ToggleGroupItem value="maintain" className="justify-start">
                  <div className="text-left">
                    <div className="font-medium">Maintain Weight ⚖️</div>
                    <div className="text-xs text-muted-foreground">Stay at current weight</div>
                  </div>
                </ToggleGroupItem>
                <ToggleGroupItem value="gain" className="justify-start">
                  <div className="text-left">
                    <div className="font-medium">Gain Weight 💪</div>
                    <div className="text-xs text-muted-foreground">Build muscle, bulk up</div>
                  </div>
                </ToggleGroupItem>
              </ToggleGroup>
              <Button 
                className="w-full" 
                onClick={handleNext}
                disabled={!formData.goal || isLoading}
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        );

      case "display_mode":
        return (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Display Preference</CardTitle>
              <CardDescription>
                How would you like to see your progress?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleGroup
                type="single"
                value={formData.display_mode || "standard"}
                onValueChange={(value) => setFormData({ ...formData, display_mode: value })}
                className="flex flex-col gap-2"
              >
                <ToggleGroupItem value="standard" className="justify-start">
                  <div className="text-left">
                    <div className="font-medium">Standard Mode 📊</div>
                    <div className="text-xs text-muted-foreground">See all calories and macros</div>
                  </div>
                </ToggleGroupItem>
                <ToggleGroupItem value="stealth" className="justify-start">
                  <div className="text-left">
                    <div className="font-medium">Stealth Mode 🥷</div>
                    <div className="text-xs text-muted-foreground">Focus on habits, not numbers</div>
                  </div>
                </ToggleGroupItem>
              </ToggleGroup>
              <Button 
                className="w-full" 
                onClick={() => {
                  setFormData({ ...formData, display_mode: formData.display_mode || "standard" });
                  handleNext();
                }}
                disabled={isLoading}
              >
                Complete Setup 🎉
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  const currentStepIndex = ONBOARDING_STEPS.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / (ONBOARDING_STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-[#F5F2ED] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mb-8">
        <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
          <div 
            className="bg-green-500 h-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-center text-sm text-muted-foreground mt-2">
          Step {currentStepIndex + 1} of {ONBOARDING_STEPS.length - 1}
        </p>
      </div>
      
      {renderStep()}
    </div>
  );
}