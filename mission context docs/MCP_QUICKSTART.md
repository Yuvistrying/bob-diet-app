# 🚀 MCP Quick Start for Bob Diet Coach

## Claude Desktop Setup

### ✅ Already Configured:
- **Filesystem** - Browse your project files
- **Convex** - Query your database directly
- **Clerk** - Manage user authentication  
- **Polar** - Check subscriptions and revenue
- **Puppeteer** - Browser automation

### 🔴 Still Need GitHub Token:
1. Go to: https://github.com/settings/tokens/new
2. Name: "Claude Desktop MCP"
3. Expiration: 90 days
4. Scopes: Select `repo` (Full control of private repositories)
5. Click "Generate token"
6. Copy the token and update the config file

### How to Use:
1. **Restart Claude Desktop** (Cmd+Q then reopen)
2. Try these commands:
   - "List all users in my Convex database"
   - "Show me today's food logs"
   - "Check active Polar subscriptions"
   - "Browse files in bob_diet_coach"

## Cursor Setup

### For Cursor Integration:
1. Open Cursor Settings (Cmd+,)
2. Search for "MCP" or check Extensions
3. The filesystem MCP already works in Cursor!

### Best Practices:
- **Use Cursor** for active coding (you're already there!)
- **Use Claude Desktop** for:
  - Debugging production data
  - Complex database queries
  - Checking user issues
  - Revenue analytics

## Testing Your MCPs

### Test Convex:
```
"Show me the last 5 users who signed up"
"How many food logs were created today?"
"List all pro users"
```

### Test Clerk:
```
"Show me active user sessions"
"Check authentication status for user X"
```

### Test Polar:
```
"What's my MRR?"
"Show recent subscriptions"
"List active pro users from Polar"
```

### Test Filesystem:
```
"Read the chat.tsx file"
"Show me the convex schema"
"List all TypeScript files in routes"
```

## Troubleshooting

If an MCP doesn't work:
1. Check if the npm package exists: `npm info @package-name`
2. Restart Claude Desktop
3. Check Claude Desktop logs
4. Some MCPs might not exist yet (context7, brightdata, etc.)

## Next Steps

1. Add your GitHub token
2. Restart Claude Desktop
3. Start using MCPs to supercharge your development!

Remember: MCPs make Claude Desktop aware of your project context, so you can ask questions about your actual data and get real answers!