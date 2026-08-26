# Ticket 4: Context Builder Service Implementation

## Overview
This ticket implements a context builder service that transforms activity data into plain-text summaries for AI prompts. The service processes activities from GitHub, Jira, and Slack sources to create structured context for AI consumption.

## Files Created
- `server/src/ai/services/context-builder.service.js` - Main context builder service

## Functions Implemented

### summarizeActivities(activities)
Transforms an array of activity objects into a structured summary containing:
- Total activity count
- Breakdown by source (github, slack, jira)
- Breakdown by activity type
- List of unique actors
- Date range of activities

### buildContext(activities)
Creates a comprehensive plain-text summary formatted for AI prompts including:
- Engineering activity summary header
- Time period and total activity count
- Activity breakdown by source and type
- Active contributors list
- Detailed recent activities (limited to 20 for prompt efficiency)

### buildGitHubContext(activities)
Generates GitHub-specific context including:
- PRs opened, merged, and closed (without merge)
- PR review count

### buildJiraContext(activities)
Generates Jira-specific context including:
- Issues created, updated, and completed

### buildSlackContext(activities)
Generates Slack-specific context including:
- Messages sent
- File shares

## Usage
```javascript
const contextBuilder = require('./src/ai/services/context-builder.service');

// Get activities from database
const activities = await Activity.find({ organizationId: orgId });

// Build comprehensive context
const context = contextBuilder.buildContext(activities);

// Build platform-specific contexts
const githubContext = contextBuilder.buildGitHubContext(activities);
const jiraContext = contextBuilder.buildJiraContext(activities);
const slackContext = contextBuilder.buildSlackContext(activities);

// Use contexts in AI prompts
```

## Data Structure
The service expects activity objects with the following structure (matching the Activity model):
```javascript
{
  organizationId: ObjectId,
  source: 'github' | 'slack' | 'jira',
  sourceId: String,
  actor: String,
  timestamp: Date,
  type: String,
  metadata: Object // Platform-specific data
}
```

## Implementation Notes
- All functions are implemented in plain JavaScript (no TypeScript) to match existing codebase patterns
- Functions handle empty activity arrays gracefully
- Recent activities are limited to 20 items to prevent overly long AI prompts
- Context formatting uses clear section headers and bullet points for readability
- Date formatting uses locale-specific date strings for readability