import { LinearClient } from "@linear/sdk";

async function addReferencesIssue() {
  const apiKey = process.env.LINEAR_API_KEY || "YOUR_LINEAR_API_KEY";

  if (apiKey === "YOUR_LINEAR_API_KEY") {
    console.error(
      "Please set your Linear API key in the LINEAR_API_KEY environment variable",
    );
    process.exit(1);
  }

  const linear = new LinearClient({ apiKey });

  console.log("Adding reference documentation issue to Linear...\n");

  try {
    // Get team
    const teams = await linear.teams();
    const team = teams.nodes.find((t) => t.key === "BOB");

    if (!team) {
      console.error("Team BOB not found!");
      process.exit(1);
    }

    // Get Core Features project
    const projects = await linear.projects();
    const coreProject = projects.nodes.find((p) => p.name === "Core Features");

    if (!coreProject) {
      console.error("Core Features project not found!");
      process.exit(1);
    }

    // Get documentation label
    const teamLabels = await team.labels();
    const docLabel = teamLabels.nodes.find(
      (l) => l.name.toLowerCase() === "documentation",
    );

    // Create the issue description with all references
    const description = `# Implementation Reference Videos

## Video Resources

### General Implementation
1. **Reference Implementation Video**
   - URL: https://youtu.be/_9T-6dw-CZs?si=fC_aMqh9Hzb92xc8
   - Topics: General Implementation

2. **Additional Reference**
   - URL: https://youtu.be/NkoaMsh8q5Q?si=asdBl9e23H2nfOlN
   - Topics: General Implementation

3. **Additional Implementation Resource**
   - URL: https://youtu.be/eIUYSC6SilA?si=gbPb5m-AzDfUD5dO
   - Topics: General Implementation

### Developer Experience
1. **MCP Setup Tutorial**
   - URL: https://youtu.be/GOHdTwKdT14?si=SoWqsmU1isFk0X1g
   - Topics: MCP Integration, Developer Experience

2. **Stagewise for Cursor/Claude Code**
   - URL: https://youtu.be/U1_nzjWUpL4?si=iAlMwl2UB0PMIATN
   - Topics: Landing Page, UI Development, Developer Experience

### UI/UX Resources
1. **Magic UI Landing Page**
   - URL: https://youtu.be/w2QPMup46Os?si=O1DToiZ_McA5IHdu
   - Topics: Landing Page, UI/UX Polish

## Usage Notes
These videos contain valuable implementation details, best practices, and specific techniques that should be reviewed when working on related features.`;

    // Create the issue
    const issue = await linear.createIssue({
      title: "Implementation Reference Videos",
      description: description,
      teamId: team.id,
      projectId: coreProject.id,
      priority: 3, // Medium priority
      labelIds: docLabel ? [docLabel.id] : [],
      estimate: 1, // Minimal estimate for documentation
    });

    console.log(
      `✓ Created reference documentation issue: "Implementation Reference Videos"`,
    );
    console.log(`  Issue URL: ${issue.url}`);
  } catch (error) {
    console.error("Failed to create issue:", error);
    process.exit(1);
  }
}

// Run it
addReferencesIssue()
  .then(() => {
    console.log("\nCompleted successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nFailed:", error);
    process.exit(1);
  });
