# MCP Setup Guide for Bob Diet Coach

## Claude Desktop Setup ✅

Your config has been created at:
`~/Library/Application Support/Claude/claude_desktop_config.json`

### Required Environment Variables

You need to add these to your config file:

1. **GitHub Token**
   - Go to: https://github.com/settings/tokens/new
   - Create a token with `repo` scope
   - Replace `YOUR_GITHUB_TOKEN` in the config

2. **Convex Deploy Key**
   - Run: `npx convex auth`
   - Or find in: https://dashboard.convex.dev/deployment/settings
   - Replace `YOUR_CONVEX_DEPLOY_KEY`

3. **Clerk Secret Key**
   - Find in: https://dashboard.clerk.com/
   - Go to your app → API Keys
   - Replace `YOUR_CLERK_SECRET_KEY`

4. **Polar API Key**
   - Go to: https://dashboard.polar.sh/
   - Settings → API → Create API Key
   - Replace `YOUR_POLAR_API_KEY`

5. **Other tokens (optional for now)**
   - Upstash, Figma, Bright Data - add when needed

### Next Steps:

1. Add your environment variables to the config
2. Restart Claude Desktop
3. Test with: "Show me my Convex tables" or "List my GitHub repos"

## Cursor Setup

For Cursor, you can install MCP extensions:

1. Open Cursor
2. Go to Extensions (Cmd+Shift+X)
3. Search for "MCP" or "Model Context Protocol"
4. Install relevant extensions

### Priority MCPs for Development:

1. **Filesystem** - Already works in Cursor!
2. **Convex** - Query your database
3. **GitHub** - Manage commits
4. **Clerk** - Check user auth
5. **Polar** - Monitor revenue

### Testing Your Setup

Try these commands in Claude Desktop:

- "Show me all users in my Convex database"
- "What's my current GitHub repo status?"
- "List files in my bob diet coach project"
- "Show me today's Polar revenue"
