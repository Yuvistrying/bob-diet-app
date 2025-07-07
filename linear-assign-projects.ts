import { LinearClient } from "@linear/sdk";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ImportData {
  issues: Array<{
    title: string;
    project: string;
  }>;
}

async function assignProjectsToIssues() {
  const apiKey = process.env.LINEAR_API_KEY || "YOUR_LINEAR_API_KEY";

  if (apiKey === "YOUR_LINEAR_API_KEY") {
    console.error(
      "Please set your Linear API key in the LINEAR_API_KEY environment variable",
    );
    process.exit(1);
  }

  const linear = new LinearClient({ apiKey });

  // Load the import data to get project mappings
  const dataPath = path.join(__dirname, "linear-import.json");
  const data: ImportData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  console.log("Assigning projects to issues...\n");

  try {
    // Get team
    const teams = await linear.teams();
    const team = teams.nodes.find((t) => t.key === "BOB");

    if (!team) {
      console.error("Team BOB not found!");
      process.exit(1);
    }

    // Get all projects
    const projects = await linear.projects();
    const projectMap: Record<string, string> = {
      CORE: projects.nodes.find((p) => p.name === "Core Features")?.id || "",
      BUGS: projects.nodes.find((p) => p.name === "Bug Fixes")?.id || "",
      UIUX: projects.nodes.find((p) => p.name === "UI/UX Polish")?.id || "",
      BIZ: projects.nodes.find((p) => p.name === "Business & Growth")?.id || "",
      AI: projects.nodes.find((p) => p.name === "Advanced AI")?.id || "",
    };

    console.log("Project mappings:");
    Object.entries(projectMap).forEach(([key, id]) => {
      console.log(`  ${key} -> ${id}`);
    });

    // Get all issues
    const issues = await linear.issues({
      filter: {
        team: { id: { eq: team.id } },
      },
    });

    console.log(`\nFound ${issues.nodes.length} issues to process`);

    let successCount = 0;
    let failCount = 0;

    // Process each issue
    for (const issue of issues.nodes) {
      // Find the corresponding issue in our data
      const issueData = data.issues.find((i) => i.title === issue.title);

      if (issueData && issueData.project) {
        const projectId = projectMap[issueData.project];

        if (projectId && !issue.project) {
          try {
            await linear.updateIssue(issue.id, {
              projectId: projectId,
            });
            console.log(
              `✓ Assigned "${issue.title}" to project ${issueData.project}`,
            );
            successCount++;
          } catch (error: any) {
            console.error(
              `✗ Failed to assign "${issue.title}": ${error.message}`,
            );
            failCount++;
          }
        } else if (issue.project) {
          console.log(`→ "${issue.title}" already has a project`);
        }
      }
    }

    console.log(`\n===== Summary =====`);
    console.log(`Issues assigned to projects: ${successCount}`);
    console.log(`Issues failed: ${failCount}`);
    console.log(`==================`);
  } catch (error) {
    console.error("Failed:", error);
    process.exit(1);
  }
}

// Run it
assignProjectsToIssues()
  .then(() => {
    console.log("\nCompleted!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nFailed:", error);
    process.exit(1);
  });
