import { LinearClient } from '@linear/sdk';

async function fixIssues() {
  const apiKey = process.env.LINEAR_API_KEY || 'YOUR_LINEAR_API_KEY';
  
  if (apiKey === 'YOUR_LINEAR_API_KEY') {
    console.error('Please set your Linear API key');
    process.exit(1);
  }

  const linear = new LinearClient({ apiKey });

  try {
    // Get all issues
    const issues = await linear.issues();
    console.log(`\nChecking ${issues.nodes.length} issues...`);

    // Get all projects
    const projects = await linear.projects();
    
    // Create a map of project names to IDs
    const projectMap: Record<string, string> = {};
    projects.nodes.forEach(p => {
      projectMap[p.name] = p.id;
      console.log(`Project: ${p.name} (${p.id})`);
    });

    // Check first few issues
    console.log('\nFirst 10 issues:');
    for (let i = 0; i < Math.min(10, issues.nodes.length); i++) {
      const issue = issues.nodes[i];
      
      // Get full issue data
      const fullIssue = await linear.issue(issue.id);
      const project = await fullIssue.project;
      
      console.log(`\n${i + 1}. "${issue.title}"`);
      console.log(`   ID: ${issue.id}`);
      console.log(`   Priority: ${issue.priority}`);
      console.log(`   Project: ${project ? project.name : 'NO PROJECT'}`);
      console.log(`   State: ${issue.state.name}`);
    }

  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
}

// Run it
fixIssues()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error);
    process.exit(1);
  });