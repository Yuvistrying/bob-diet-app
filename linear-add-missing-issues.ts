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

interface MissingIssue {
  title: string;
  description: string;
  project: string;
  priority: number;
  labels: string[];
  estimate?: number;
}

interface MissingIssuesData {
  missed_issues: MissingIssue[];
}

async function addMissingIssues() {
  const apiKey = process.env.LINEAR_API_KEY || 'YOUR_LINEAR_API_KEY';
  
  if (apiKey === 'YOUR_LINEAR_API_KEY') {
    console.error('Please set your Linear API key in the LINEAR_API_KEY environment variable');
    process.exit(1);
  }

  const linear = new LinearClient({ apiKey });

  // Load the missing issues data
  const dataPath = path.join(__dirname, 'missing-issues.json');
  const data: MissingIssuesData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log(`Adding ${data.missed_issues.length} missing issues to Linear...\n`);

  try {
    // Get team
    const teams = await linear.teams();
    const team = teams.nodes.find(t => t.key === 'BOB');
    
    if (!team) {
      console.error('Team BOB not found!');
      process.exit(1);
    }

    // Get all projects
    const projects = await linear.projects();
    const projectMap: Record<string, string> = {
      'CORE': projects.nodes.find(p => p.name === 'Core Features')?.id || '',
      'BUGS': projects.nodes.find(p => p.name === 'Bug Fixes')?.id || '',
      'UIUX': projects.nodes.find(p => p.name === 'UI/UX Polish')?.id || '',
      'BIZ': projects.nodes.find(p => p.name === 'Business & Growth')?.id || '',
      'AI': projects.nodes.find(p => p.name === 'Advanced AI')?.id || '',
    };

    // Get all labels
    const teamLabels = await team.labels();
    const labelMap: Record<string, string> = {};
    
    teamLabels.nodes.forEach(label => {
      labelMap[label.name.toLowerCase()] = label.id;
    });

    // Add missing labels if needed
    const uniqueLabels = new Set<string>();
    data.missed_issues.forEach(issue => {
      issue.labels.forEach(label => uniqueLabels.add(label));
    });

    for (const labelName of uniqueLabels) {
      if (!labelMap[labelName.toLowerCase()]) {
        console.log(`Creating missing label: ${labelName}`);
        try {
          const newLabel = await linear.createIssueLabel({
            name: labelName,
            color: getColorForLabel(labelName),
            teamId: team.id,
          });
          labelMap[labelName.toLowerCase()] = newLabel.id;
          console.log(`  ✓ Created label: ${labelName}`);
        } catch (error: any) {
          console.error(`  ✗ Failed to create label ${labelName}: ${error.message}`);
        }
      }
    }

    console.log('\nCreating issues...\n');

    let successCount = 0;
    let failCount = 0;

    for (const issueData of data.missed_issues) {
      try {
        console.log(`Creating issue: ${issueData.title}`);
        
        // Map label names to label IDs
        const labelIds = issueData.labels
          .map(labelName => labelMap[labelName.toLowerCase()])
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
      } catch (error: any) {
        console.error(`  ✗ Failed to create issue ${issueData.title}: ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n===== Summary =====`);
    console.log(`Issues created: ${successCount}`);
    if (failCount > 0) {
      console.log(`Issues failed: ${failCount}`);
    }
    console.log(`==================`);
    
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

function getColorForLabel(labelName: string): string {
  const colors: Record<string, string> = {
    'bug': '#eb5757',
    'feature': '#2da44e',
    'enhancement': '#1f6feb',
    'performance': '#8250df',
    'critical': '#d73a49',
    'mobile': '#0969da',
    'backend': '#6f42c1',
    'frontend': '#fd8c73',
    'testing': '#f97316',
    'documentation': '#64748b',
    'research': '#06b6d4',
    'marketing': '#ec4899',
    'tooling': '#8b5cf6',
  };
  
  return colors[labelName.toLowerCase()] || '#64748b';
}

// Run the import
addMissingIssues()
  .then(() => {
    console.log('\nImport completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nImport failed:', error);
    process.exit(1);
  });