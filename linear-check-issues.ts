import { LinearClient } from '@linear/sdk';

async function checkIssues() {
  const apiKey = process.env.LINEAR_API_KEY || 'YOUR_LINEAR_API_KEY';
  
  if (apiKey === 'YOUR_LINEAR_API_KEY') {
    console.error('Please set your Linear API key in the LINEAR_API_KEY environment variable');
    process.exit(1);
  }

  const linear = new LinearClient({ apiKey });

  try {
    // Get team
    const teams = await linear.teams();
    const team = teams.nodes.find(t => t.key === 'BOB');
    
    if (!team) {
      console.error('Team BOB not found!');
      process.exit(1);
    }

    console.log(`\nChecking team: ${team.name} (${team.id})`);

    // Get all issues for this team with project data
    const issues = await linear.issues({
      filter: {
        team: { id: { eq: team.id } }
      },
      includeArchived: false
    });

    console.log(`\nFound ${issues.nodes.length} issues in the team`);

    // Get all projects (no filter needed, will get all)
    const projects = await linear.projects();

    console.log(`\nProjects (${projects.nodes.length}):`);
    projects.nodes.forEach(p => {
      console.log(`  - ${p.name} (${p.id})`);
    });

    // Get all labels
    const labels = await team.labels();
    console.log(`\nLabels (${labels.nodes.length}):`);
    labels.nodes.forEach(l => {
      console.log(`  - ${l.name} (${l.color})`);
    });

    // Show first 5 issues as examples
    console.log(`\nFirst 5 issues:`);
    for (const issue of issues.nodes.slice(0, 5)) {
      // Fetch the full issue with project data
      const fullIssue = await linear.issue(issue.id);
      
      console.log(`  - "${fullIssue.title}"`);
      console.log(`    Priority: ${fullIssue.priority}`);
      
      // Properly fetch project if it exists
      try {
        const project = await fullIssue.project;
        console.log(`    Project: ${project ? project.name : 'No project'}`);
      } catch {
        console.log(`    Project: No project`);
      }
      
      // Fetch labels
      try {
        const labels = await fullIssue.labels();
        console.log(`    Labels: ${labels.nodes.length > 0 ? labels.nodes.map(l => l.name).join(', ') : 'None'}`);
      } catch {
        console.log(`    Labels: None`);
      }
    }

    // Summary of issues by project
    console.log(`\n\nIssues by Project:`);
    const projectCounts: Record<string, number> = {
      'No project': 0
    };
    
    for (const issue of issues.nodes) {
      try {
        const fullIssue = await linear.issue(issue.id);
        const project = await fullIssue.project;
        const projectName = project ? project.name : 'No project';
        projectCounts[projectName] = (projectCounts[projectName] || 0) + 1;
      } catch {
        projectCounts['No project']++;
      }
    }
    
    Object.entries(projectCounts).forEach(([projectName, count]) => {
      if (count > 0) {
        console.log(`  ${projectName}: ${count} issues`);
      }
    });

  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
}

// Run it
checkIssues()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error);
    process.exit(1);
  });