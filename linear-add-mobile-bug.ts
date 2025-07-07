import { LinearClient } from "@linear/sdk";

async function addMobileBug() {
  const apiKey = process.env.LINEAR_API_KEY || "YOUR_LINEAR_API_KEY";

  if (apiKey === "YOUR_LINEAR_API_KEY") {
    console.error(
      "Please set your Linear API key in the LINEAR_API_KEY environment variable",
    );
    process.exit(1);
  }

  const linear = new LinearClient({ apiKey });

  console.log("Adding critical mobile bug to Linear...\n");

  try {
    // Get team
    const teams = await linear.teams();
    const team = teams.nodes.find((t) => t.key === "BOB");

    if (!team) {
      console.error("Team BOB not found!");
      process.exit(1);
    }

    // Get Bug Fixes project
    const projects = await linear.projects();
    const bugsProject = projects.nodes.find((p) => p.name === "Bug Fixes");

    if (!bugsProject) {
      console.error("Bug Fixes project not found!");
      process.exit(1);
    }

    // Get labels
    const teamLabels = await team.labels();
    const labelMap: Record<string, string> = {};

    teamLabels.nodes.forEach((label) => {
      labelMap[label.name.toLowerCase()] = label.id;
    });

    // Map labels for this issue
    const labels = ["bug", "critical", "mobile", "frontend"];
    const labelIds = labels
      .map((labelName) => labelMap[labelName.toLowerCase()])
      .filter((id) => id !== undefined);

    // Create the issue
    const issue = await linear.createIssue({
      title: "Page Stability Issues on Mobile",
      description: `Entire page scrolls erratically on mobile - up, down, and sideways

Notes:
- Page doesn't stick to position
- Scrolls in all directions making it very hard to use
- Not just chat - affects entire page/viewport
- Critical mobile usability issue
- May be related to viewport settings or CSS overflow issues
- Check for conflicting scroll behaviors or touch event handlers`,
      teamId: team.id,
      projectId: bugsProject.id,
      priority: 1, // Urgent (highest priority)
      labelIds: labelIds,
      estimate: 5,
    });

    console.log(
      `✓ Created critical mobile bug issue: "Page Stability Issues on Mobile"`,
    );
    console.log(`  Priority: Urgent (1)`);
    console.log(`  Labels: ${labels.join(", ")}`);
    console.log(`  Project: Bug Fixes`);
    console.log(`  Estimate: 5 points`);
  } catch (error) {
    console.error("Failed to create issue:", error);
    process.exit(1);
  }
}

// Run it
addMobileBug()
  .then(() => {
    console.log("\nCompleted successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nFailed:", error);
    process.exit(1);
  });
