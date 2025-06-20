#!/bin/bash

# Base URL for raw files
BASE_URL="https://raw.githubusercontent.com/Yuvistrying/bob-diet-app/main"

# Download Convex functions
echo "Downloading Convex functions..."
curl -s "$BASE_URL/convex/foodLogs.ts" > convex/foodLogs.ts
curl -s "$BASE_URL/convex/weightLogs.ts" > convex/weightLogs.ts
curl -s "$BASE_URL/convex/userProfiles.ts" > convex/userProfiles.ts
curl -s "$BASE_URL/convex/chatHistory.ts" > convex/chatHistory.ts
curl -s "$BASE_URL/convex/agentActions.ts" > convex/agentActions.ts
curl -s "$BASE_URL/convex/files.ts" > convex/files.ts

# Download route components
echo "Downloading route components..."
mkdir -p app/routes-original
curl -s "$BASE_URL/app/routes/chat.tsx" > app/routes-original/chat.tsx
curl -s "$BASE_URL/app/routes/diary.tsx" > app/routes-original/diary.tsx
curl -s "$BASE_URL/app/routes/profile.tsx" > app/routes-original/profile.tsx

# Download components
echo "Downloading components..."
mkdir -p app/components-original
curl -s "$BASE_URL/app/components/ManualFoodEntry.tsx" > app/components/ManualFoodEntry.tsx

echo "Done!"