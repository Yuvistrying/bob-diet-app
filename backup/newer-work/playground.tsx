import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { useAuth } from "@clerk/react-router";
import { useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { 
  Code, 
  Database, 
  MessageSquare, 
  Activity, 
  Zap,
  Calendar,
  Target,
  ChefHat,
  TrendingUp,
  AlertCircle
} from "lucide-react";

export default function Playground() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [testPrompt, setTestPrompt] = useState("");
  const [testThreadId, setTestThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [selectedTool, setSelectedTool] = useState<string>("chat");
  
  // Queries
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const usageStats = useQuery(api.usageTracking.getUsageStats, {});
  const agentUsage = useQuery(api.agentUsageTracking.getRecentUsage, { limit: 10 });
  const calibrationNeeded = useQuery(api.calibrationHistory.shouldCalibrate);
  
  // Actions
  const chat = useAction(api.agentActions.chat);
  const streamChat = useAction(api.agentActions.streamChat);
  const generateMealPlan = useAction(api.structuredGeneration.generateDetailedMealPlan);
  const generateCalibration = useAction(api.structuredGeneration.generateCalibrationReport);
  
  // Redirect if not signed in
  if (!isSignedIn) {
    navigate("/sign-in");
    return null;
  }
  
  // Test scenarios
  const testScenarios = [
    {
      category: "Food Logging",
      scenarios: [
        { prompt: "I had a chicken salad for lunch", icon: "🥗" },
        { prompt: "Just ate 2 slices of pizza and a coke", icon: "🍕" },
        { prompt: "Had oatmeal with berries and a protein shake", icon: "🥣" },
      ]
    },
    {
      category: "Weight & Progress",
      scenarios: [
        { prompt: "My weight today is 75.5kg", icon: "⚖️" },
        { prompt: "How am I doing with my goals?", icon: "📊" },
        { prompt: "Show me my progress this week", icon: "📈" },
      ]
    },
    {
      category: "Meal Search",
      scenarios: [
        { prompt: "What did I eat yesterday?", icon: "🔍" },
        { prompt: "Show me high protein meals from last week", icon: "💪" },
        { prompt: "Find meals under 400 calories", icon: "🎯" },
      ]
    },
    {
      category: "Planning & Analysis",
      scenarios: [
        { prompt: "Create a 3-day meal plan for me", icon: "📅" },
        { prompt: "Analyze my progress for the last 2 weeks", icon: "📊" },
        { prompt: "Should I adjust my calorie target?", icon: "🎯" },
      ]
    }
  ];
  
  const handleTest = async (prompt: string) => {
    setIsLoading(true);
    setResponse(null);
    
    try {
      let result;
      switch (selectedTool) {
        case "stream":
          result = await streamChat({ 
            prompt, 
            threadId: testThreadId || undefined 
          });
          break;
        case "meal_plan":
          result = await generateMealPlan({ 
            days: 3,
            threadId: testThreadId || undefined 
          });
          break;
        case "calibration":
          result = await generateCalibration({ 
            periodDays: 14,
            threadId: testThreadId || undefined 
          });
          break;
        default:
          result = await chat({ 
            prompt, 
            threadId: testThreadId || undefined 
          });
      }
      
      setResponse(result);
      if (result.threadId && !testThreadId) {
        setTestThreadId(result.threadId);
      }
    } catch (error) {
      console.error("Test error:", error);
      setResponse({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bob Agent Playground</h1>
        <p className="text-gray-600">Test and debug Bob's Convex Agent capabilities</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Stats & Info */}
        <div className="space-y-4">
          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="w-4 h-4" />
                User Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{profile?.name || "Not set"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Goal:</span>
                <Badge variant="outline">{profile?.goal || "Not set"}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Daily Target:</span>
                <span className="font-medium">{profile?.dailyCalorieTarget || 0} cal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Thread ID:</span>
                <span className="font-mono text-xs">
                  {testThreadId ? testThreadId.slice(0, 8) + "..." : "New thread"}
                </span>
              </div>
            </CardContent>
          </Card>
          
          {/* Usage Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Usage Today
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Chats:</span>
                <span>{usageStats?.totals.totalChats || 0} / 5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Photos:</span>
                <span>{usageStats?.totals.totalPhotos || 0} / 2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Est. Cost:</span>
                <span>${usageStats?.estimatedCost.total.toFixed(3) || 0}</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Calibration Status */}
          {calibrationNeeded?.needed && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                  Calibration Available
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">{calibrationNeeded.reason}</p>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Middle Panel - Testing Interface */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tool Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Test Tools</CardTitle>
              <CardDescription>Select which agent capability to test</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button
                  variant={selectedTool === "chat" ? "default" : "outline"}
                  onClick={() => setSelectedTool("chat")}
                  className="h-auto flex-col py-3"
                >
                  <MessageSquare className="w-4 h-4 mb-1" />
                  <span className="text-xs">Chat</span>
                </Button>
                <Button
                  variant={selectedTool === "stream" ? "default" : "outline"}
                  onClick={() => setSelectedTool("stream")}
                  className="h-auto flex-col py-3"
                >
                  <Zap className="w-4 h-4 mb-1" />
                  <span className="text-xs">Stream</span>
                </Button>
                <Button
                  variant={selectedTool === "meal_plan" ? "default" : "outline"}
                  onClick={() => setSelectedTool("meal_plan")}
                  className="h-auto flex-col py-3"
                >
                  <ChefHat className="w-4 h-4 mb-1" />
                  <span className="text-xs">Meal Plan</span>
                </Button>
                <Button
                  variant={selectedTool === "calibration" ? "default" : "outline"}
                  onClick={() => setSelectedTool("calibration")}
                  className="h-auto flex-col py-3"
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs">Calibrate</span>
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Test Scenarios */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Tests</CardTitle>
              <CardDescription>Click any scenario to test</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="food">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="food">Food</TabsTrigger>
                  <TabsTrigger value="weight">Weight</TabsTrigger>
                  <TabsTrigger value="search">Search</TabsTrigger>
                  <TabsTrigger value="planning">Planning</TabsTrigger>
                </TabsList>
                {testScenarios.map((category, idx) => (
                  <TabsContent 
                    key={idx} 
                    value={category.category.toLowerCase().split(" ")[0]}
                    className="space-y-2"
                  >
                    {category.scenarios.map((scenario, sidx) => (
                      <Button
                        key={sidx}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          setTestPrompt(scenario.prompt);
                          handleTest(scenario.prompt);
                        }}
                      >
                        <span className="mr-2">{scenario.icon}</span>
                        {scenario.prompt}
                      </Button>
                    ))}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
          
          {/* Custom Input */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Enter your test prompt..."
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => handleTest(testPrompt)}
                  disabled={!testPrompt || isLoading}
                  className="flex-1"
                >
                  {isLoading ? "Testing..." : "Send Test"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTestThreadId(null);
                    setResponse(null);
                  }}
                >
                  New Thread
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Response Display */}
          {response && (
            <Card>
              <CardHeader>
                <CardTitle>Response</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {response.error ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
                      <p className="font-medium">Error:</p>
                      <p className="text-sm">{response.error}</p>
                    </div>
                  ) : (
                    <>
                      {response.text && (
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Text Response:</p>
                          <div className="p-3 bg-gray-50 rounded whitespace-pre-wrap">
                            {response.text}
                          </div>
                        </div>
                      )}
                      
                      {response.toolCalls && response.toolCalls.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Tool Calls:</p>
                          <div className="space-y-2">
                            {response.toolCalls.map((tool: any, idx: number) => (
                              <div key={idx} className="p-3 bg-blue-50 rounded">
                                <p className="font-medium text-blue-700">{tool.toolName}</p>
                                <pre className="text-xs mt-1 overflow-auto">
                                  {JSON.stringify(tool.args, null, 2)}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {(response.mealPlan || response.report) && (
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Structured Output:</p>
                          <div className="p-3 bg-gray-50 rounded">
                            <pre className="text-xs overflow-auto">
                              {JSON.stringify(response.mealPlan || response.report, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                      
                      {response.usageInfo && (
                        <div className="p-3 bg-yellow-50 rounded">
                          <p className="text-sm text-yellow-700">
                            {response.usageInfo.remaining !== undefined
                              ? `${response.usageInfo.remaining} chats remaining today`
                              : "Unlimited (Pro user)"}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Recent Agent Usage */}
          {agentUsage && agentUsage.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Agent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {agentUsage.slice(0, 5).map((usage: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm py-2 border-b last:border-0">
                      <div>
                        <span className="font-medium">{usage.model}</span>
                        <span className="text-gray-500 ml-2">
                          {new Date(usage.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-600">{usage.totalTokens} tokens</span>
                        <span className="text-green-600 ml-2">${usage.cost.toFixed(4)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}