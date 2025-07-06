import { LinearClient } from '@linear/sdk';

async function addProjects() {
  const apiKey = process.env.LINEAR_API_KEY || 'YOUR_LINEAR_API_KEY';
  
  if (apiKey === 'YOUR_LINEAR_API_KEY') {
    console.error('Please set your Linear API key in the LINEAR_API_KEY environment variable');
    process.exit(1);
  }

  const linear = new LinearClient({ apiKey });

  const projects = [
    {
      name: 'Core Features',
      key: 'CORE',
      description: 'Essential functionality completion',
    },
    {
      name: 'Bug Fixes',
      key: 'BUGS',
      description: 'Critical issues and stability',
    },
    {
      name: 'UI/UX Polish',
      key: 'UIUX',
      description: 'Design and user experience improvements',
    },
    {
      name: 'Business & Growth',
      key: 'BIZ',
      description: 'Monetization and marketing features',
    },
    {
      name: 'Advanced AI',
      key: 'AI',
      description: 'Metabolism calibration and pattern recognition',
    }
  ];

  console.log('Adding missing projects to Linear...\n');

  try {
    // Get team
    const teams = await linear.teams();
    const team = teams.nodes.find(t => t.key === 'BOB');
    
    if (!team) {
      console.error('Team BOB not found!');
      process.exit(1);
    }

    let successCount = 0;
    let failCount = 0;

    for (const projectData of projects) {
      try {
        console.log(`Creating project: ${projectData.name}`);
        const project = await linear.createProject({
          name: projectData.name,
          description: projectData.description,
          teamIds: [team.id],
        });
        console.log(`  ✓ Created project: ${projectData.name}`);
        successCount++;
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`  → Project already exists: ${projectData.name}`);
        } else {
          console.error(`  ✗ Failed to create project ${projectData.name}:`, error.message);
          failCount++;
        }
      }
    }

    console.log(`\n===== Summary =====`);
    console.log(`Projects created: ${successCount}`);
    console.log(`Projects failed: ${failCount}`);
    console.log(`==================`);
    
  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
}

// Run it
addProjects()
  .then(() => {
    console.log('\nCompleted!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error);
    process.exit(1);
  });