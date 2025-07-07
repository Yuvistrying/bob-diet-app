# Linear Import Setup Instructions

## Prerequisites

1. Install the Linear SDK:

```bash
npm install @linear/sdk
```

2. Get your Linear API key:
   - Go to Linear Settings → Account → API → Personal API keys
   - Create a new key with full access
   - Copy the key

## Running the Import

### Option 1: Using environment variable (recommended)

```bash
LINEAR_API_KEY="your-api-key-here" npx tsx linear-import.ts
```

### Option 2: Using direct execution

```bash
# First, edit linear-import.ts and replace 'YOUR_LINEAR_API_KEY' with your actual key
npx tsx linear-import.ts
```

### Option 3: Add to package.json

Add this script to your package.json:

```json
"scripts": {
  "linear:import": "tsx linear-import.ts"
}
```

Then run:

```bash
LINEAR_API_KEY="your-api-key-here" npm run linear:import
```

## What the Script Does

1. **Creates/Uses Team**: Creates "Bob Diet Coach" team with key "BOB"
2. **Creates Projects**:
   - Core Features (CORE)
   - Bug Fixes (BUGS)
   - UI/UX Polish (UIUX)
   - Business & Growth (BIZ)
   - Advanced AI (AI)
3. **Creates Labels**: bug, feature, enhancement, performance, critical, mobile, backend, frontend
4. **Creates 37 Issues**: All issues with proper priorities, labels, and estimates

## Notes

- The script handles existing teams gracefully (won't duplicate)
- Projects and labels will be created fresh each run
- Issues will be created fresh each run (may result in duplicates if run multiple times)
- Priority mapping: 0 (Urgent) → 1, 1 (High) → 2, 2 (Medium) → 3, 3 (Low) → 4

## Troubleshooting

- If you get API errors, check your API key permissions
- If imports fail, check the console output for specific errors
- The script will continue even if individual items fail to import
