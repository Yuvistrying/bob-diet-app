import { LinearClient } from '@linear/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Priority mapping from Linear's priority system
const PRIORITY_MAP = {
  0: 1, // Urgent (your 0) -> Linear's 1
  1: 2, // High (your 1) -> Linear's 2  
  2: 3, // Medium (your 2) -> Linear's 3
  3: 4, // Low (your 3) -> Linear's 4
};

interface ImportData {
  teams: Array<{ name: string; key: string }>;
  projects: Array<{
    name: string;
    key: string;
    description: string;
    icon: string;
  }>;
  labels: Array<{ name: string; color: string }>;
  issues: Array<{
    title: string;
    description: string;
    project: string;
    priority: number;
    labels: string[];
    estimate?: number;
  }>;
}

async function importToLinear() {
  // Initialize Linear client - you'll need to replace this with your actual API key
  const apiKey = process.env.LINEAR_API_KEY || 'YOUR_LINEAR_API_KEY';
  
  if (apiKey === 'YOUR_LINEAR_API_KEY') {
    console.error('Please set your Linear API key in the LINEAR_API_KEY environment variable');
    process.exit(1);
  }

  const linear = new LinearClient({ apiKey });

  // Load the import data
  const dataPath = path.join(__dirname, 'linear-import.json');
  const data: ImportData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log('Starting Linear import...');

  try {
    // Step 1: Get or create team
    console.log('\n1. Setting up team...');
    const existingTeams = await linear.teams();
    let team = existingTeams.nodes.find(t => t.key === data.teams[0].key);
    
    if (!team) {
      console.log(`Creating team: ${data.teams[0].name}`);
      team = await linear.createTeam({
        name: data.teams[0].name,
        key: data.teams[0].key,
      });
    } else {
      console.log(`Using existing team: ${team.name}`);
    }

    // Step 2: Create projects
    console.log('\n2. Creating projects...');
    const projectMap: Record<string, string> = {};
    
    for (const projectData of data.projects) {
      try {
        console.log(`Creating project: ${projectData.name}`);
        const project = await linear.createProject({
          name: projectData.name,
          description: projectData.description,
          // Note: Linear doesn't support emoji icons
          teamIds: [team.id],
        });
        projectMap[projectData.key] = project.id;
        console.log(`  ✓ Created project: ${projectData.name}`);
      } catch (error) {
        console.error(`  ✗ Failed to create project ${projectData.name}:`, error);
      }
    }

    // Step 3: Create labels
    console.log('\n3. Creating labels...');
    const labelMap: Record<string, string> = {};
    
    for (const labelData of data.labels) {
      try {
        console.log(`Creating label: ${labelData.name}`);
        const label = await linear.createIssueLabel({
          name: labelData.name,
          color: labelData.color,
          teamId: team.id,
        });
        labelMap[labelData.name] = label.id;
        console.log(`  ✓ Created label: ${labelData.name}`);
      } catch (error) {
        console.error(`  ✗ Failed to create label ${labelData.name}:`, error);
      }
    }

    // Step 4: Create issues
    console.log('\n4. Creating issues...');
    let successCount = 0;
    let failCount = 0;

    for (const issueData of data.issues) {
      try {
        console.log(`Creating issue: ${issueData.title}`);
        
        // Map label names to label IDs
        const labelIds = issueData.labels
          .map(labelName => labelMap[labelName])
          .filter(id => id !== undefined);

        // Create the issue
        const issue = await linear.createIssue({
          title: issueData.title,
          description: issueData.description,
          teamId: team.id,
          projectId: projectMap[issueData.project],
          priority: PRIORITY_MAP[issueData.priority] || 3,
          labelIds: labelIds,
          estimate: issueData.estimate,
        });
        
        console.log(`  ✓ Created issue: ${issueData.title}`);
        successCount++;
      } catch (error) {
        console.error(`  ✗ Failed to create issue ${issueData.title}:`, error);
        failCount++;
      }
    }

    // Summary
    console.log('\n===== Import Summary =====');
    console.log(`Team: ${team.name}`);
    console.log(`Projects created: ${Object.keys(projectMap).length}`);
    console.log(`Labels created: ${Object.keys(labelMap).length}`);
    console.log(`Issues created: ${successCount}`);
    if (failCount > 0) {
      console.log(`Issues failed: ${failCount}`);
    }
    console.log('=========================');
    
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

// Run the import
importToLinear()
  .then(() => {
    console.log('\nImport completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nImport failed:', error);
    process.exit(1);
  });