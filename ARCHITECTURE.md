# Bob Diet Coach - Architecture Documentation

## Overview

Bob Diet Coach is a diet tracking application built with Next.js, Convex, and AI (Claude). It provides conversational diet coaching with food logging, photo analysis, and progress tracking.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Convex (real-time database and serverless functions)
- **AI**: Anthropic Claude (Sonnet for chat, Opus for analysis)
- **Auth**: Clerk
- **Storage**: Convex file storage for photos
- **Payments**: Polar subscriptions

## Database Schema (Convex)

### Core Tables

#### `userProfiles`

- User's personal info (weight, height, age, gender)
- Diet goals (cut/gain/maintain)
- Calorie and macro targets
- Onboarding status

#### `foodLogs`

- Daily food entries with date/time
- Food items array with nutrition info
- Total calories/macros
- AI confidence level
- Links to photo analysis if applicable

#### `chatHistory`

- All messages between user and Bob
- Metadata includes:
  - `foodLogId`: Links to food log if message resulted in logging
  - `toolCalls`: AI tool calls for persistence (CRITICAL for confirmation bubbles)
  - `threadId`: Daily conversation thread
  - `storageId`: Photo reference if uploaded
  - `usage`: Token usage tracking

#### `dailyThreads`

- One thread per user per day
- Tracks message count and timestamps
- Used for conversation continuity

#### `pendingConfirmations`

- Temporary storage for food confirmations
- Expires after 5 minutes
- Allows "yes" to confirm without re-analyzing

## Data Flow

### 1. Food Logging Flow

```mermaid
graph TD
    A[User Message/Photo] --> B[Stream API]
    B --> C{Intent Detection}
    C -->|Food Related| D[AI Tools]
    C -->|Query| E[Show Progress]
    D --> F[analyzeAndConfirmPhoto]
    F --> G[Confirmation Bubble]
    G -->|User Confirms| H[logFood Mutation]
    H --> I[Save to foodLogs]
    H --> J[Save to chatHistory with foodLogId]
    G -->|Via Stream| K[Send "yes" Message]
    K --> B
```

### 2. Photo Analysis Flow

1. User uploads photo → Convex storage
2. `analyzeAndConfirmPhoto` tool calls Claude Vision
3. Returns structured food data with nutrition estimates
4. Creates pending confirmation
5. Shows confirmation bubble for user approval

### 3. Message Streaming Flow

1. Client sends message to `/api/chat/stream-v2`
2. Server:
   - Loads recent context (5 messages)
   - Detects intent (food log vs query)
   - Loads appropriate AI tools
   - Streams response with Server-Sent Events (SSE)
3. During streaming:
   - Tool calls collected from chunks (type: 'tool-call')
   - Tool results merged into args (type: 'tool-result')
   - Text accumulated from deltas (type: 'text-delta')
4. On stream finish:
   - Collected tool calls attached to message
   - Message saved to `chatHistory` with toolCalls
5. Client updates UI with tool calls for confirmation bubbles

## State Management

### Client State (React)

- `messages`: Current chat messages
- `confirmedFoodLogs`: Set of confirmed food IDs
- `editedFoodItems`: User edits to food items
- `threadId`: Current daily thread
- `isStreaming`: Active AI response

### Persisted State

- **localStorage**:
  - `foodConfirmations`: Today's confirmations (cleared daily)
  - Theme preferences
- **Convex**: All chat history and food logs

## AI Tools

### Available Tools

1. **confirmFood**: Show food for user confirmation
2. **logFood**: Actually log food to database
3. **analyzePhoto**: Analyze food photo (deprecated)
4. **analyzeAndConfirmPhoto**: Analyze + confirm in one step
5. **logWeight**: Log user's weight
6. **showProgress**: Show daily calories/macros
7. **findSimilarMeals**: Vector search past meals

### Tool Selection Logic

- Intent detection prevents tools for queries ("what did I eat")
- Minimal tools loaded based on context
- Confirmation + pending state = only logFood tool

## Key Features

### 1. Confirmation Bubbles

- Show food details for user approval
- Editable before confirming
- Minimize to compact view after logging
- **Issue**: Must wait for user click, not auto-confirm

### 2. Direct Food Logging

- Clicking "Yes, log it!" logs directly via mutation
- Bypasses streaming API for faster response
- Must save chat history with foodLogId

### 3. Context Management

- Only last 5 messages sent to AI (token optimization)
- Summaries provide older context
- Skip embeddings for simple messages

### 4. Duplicate Prevention

- Track recent logs (30-second window)
- Prevent double-clicks from creating duplicates
- Active request tracking

## API Routes

### `/api/chat/stream-v2`

Main streaming endpoint for AI responses:

- Token optimization (5 message context)
- Intent detection
- Tool loading
- SSE streaming
- Message persistence

### `/api/webhooks/polar`

Subscription webhook handling

## Common Issues & Solutions

### 1. Confirmation Bubbles Auto-Confirming

**Problem**: Bubbles show as already logged
**Solution**: Don't restore confirmed state from localStorage on mount

### 2. Food Logs Not Showing in History

**Problem**: "0 food logs" despite logging
**Solution**: Save foodLogId to chat history metadata

### 3. Persistence Across Tabs ✅ FIXED

**Problem**: Confirmation bubbles disappearing on tab switch
**Root Cause**: Tool calls not being saved to database
**Solution**: Collect tool calls from streaming chunks and persist to database
**Details**: See [TOOLCALLS_PERSISTENCE_FIX.md](./docs/TOOLCALLS_PERSISTENCE_FIX.md)

### 4. Duplicate Food Logs

**Problem**: Multiple clicks create duplicates
**Solution**: Track active requests and recent logs

## Performance Optimizations

1. **Message Limits**: 5 recent messages to AI
2. **Embedding Skips**: Simple messages don't generate embeddings
3. **Memoized Components**: ChatMessage and ConfirmationBubble
4. **Smart Scrolling**: Only auto-scroll when appropriate
5. **Debounced Saves**: localStorage updates throttled

## Security Considerations

1. All mutations require authentication
2. User can only access their own data
3. File uploads validated and stored securely
4. Subscription status checked before premium features
