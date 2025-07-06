import { LinearClient } from '@linear/sdk';

async function findReferenceIssue() {
  const apiKey = process.env.LINEAR_API_KEY || 'YOUR_LINEAR_API_KEY';
  
  if (apiKey === 'YOUR_LINEAR_API_KEY') {
    console.error('Please set your Linear API key in the LINEAR_API_KEY environment variable');
    process.exit(1);
  }

  const linear = new LinearClient({ apiKey });

  try {
    // Search for the issue by title
    const issues = await linear.issues({
      filter: {
        title: { contains: "Implementation Reference Videos" }
      }
    });

    console.log(`Found ${issues.nodes.length} issues with "Implementation Reference Videos" in title\n`);

    if (issues.nodes.length > 0) {
      for (const issue of issues.nodes) {
        const fullIssue = await linear.issue(issue.id);
        const project = await fullIssue.project;
        const team = await fullIssue.team;
        
        console.log(`Issue: "${issue.title}"`);
        console.log(`ID: ${issue.id}`);
        console.log(`Team: ${team.name}`);
        console.log(`Project: ${project ? project.name : 'No project'}`);
        console.log(`State: ${issue.state.name}`);
        console.log(`Created: ${new Date(issue.createdAt).toLocaleString()}`);
        console.log(`URL: https://linear.app/${team.key}/issue/${issue.identifier}`);
        console.log('---');
      }
    } else {
      console.log('Issue not found. Let me check recent issues...\n');
      
      // Get recent issues
      const recentIssues = await linear.issues({
        orderBy: 'createdAt',
        first: 10
      });
      
      console.log('10 most recent issues:');
      for (const issue of recentIssues.nodes) {
        const team = await issue.team;
        console.log(`- "${issue.title}" (${issue.identifier}) - ${new Date(issue.createdAt).toLocaleString()}`);
      }
    }

  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
}

// Run it
findReferenceIssue()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error);
    process.exit(1);
  });