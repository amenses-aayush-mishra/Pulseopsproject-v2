# Ticket 5: Single Gemini call with structured output

## Overview
Implements a route that fetches activities, builds context, calls Gemini with structured output, and returns AI-generated engineering health summary.

## Files Created
- `server/src/services/ai/gemini.service.js` - Enhanced Gemini service with structured output
- `server/src/routes/ai-summaries.js` - POST /api/ai-summaries and GET /api/ai-summaries/latest routes

## Files Updated
- `server/src/models/AISummary.js` - Expanded schema for key_metrics, top_contributors, risks, recommendations
- `server/src/server.js` - Registered new AI summaries routes

## API Endpoints

### POST /api/ai-summaries
Generate AI summary for organization activities.
- Requires: organizationId
- Optional: type (default: weekly), startDate, endDate
- Returns: AI summary with structured data

### GET /api/ai-summaries/latest
Get latest AI summary for organization.
- Requires: organizationId query parameter
- Returns: Most recent AI summary

## Dependencies
- @google/generative-ai (already installed)
- Existing context-builder and activity services
- Mongoose models and Express infrastructure

## Implementation
- Uses gemini-1.5-pro with temperature 0.3, JSON response mode
- Includes prompt engineering for consistent structured output
- Validates and sanitizes response data (integers, arrays)
- Comprehensive error handling and validation
- Reuses existing services for activity fetching and context building
# Ticket 5: Single Gemini call with structured output

## Overview
Implements a route that fetches activities, builds context, calls Gemini with structured output, and returns AI-generated engineering health summary.

## Files Created
- `server/src/services/ai/gemini.service.js` - Enhanced Gemini service with structured output
- `server/src/routes/ai-summaries.js` - POST /api/ai-summaries and GET /api/ai-summaries/latest routes

## Files Updated
- `server/src/models/AISummary.js` - Expanded schema for key_metrics, top_contributors, risks, recommendations
- `server/src/server.js` - Registered new AI summaries routes

## API Endpoints

### POST /api/ai-summaries
Generate AI summary for organization activities.
- Requires: organizationId
- Optional: type (default: weekly), startDate, endDate
- Returns: AI summary with structured data

### GET /api/ai-summaries/latest
Get latest AI summary for organization.
- Requires: organizationId query parameter
- Returns: Most recent AI summary

## Dependencies
- @google/generative-ai (already installed)
- Existing context-builder and activity services
- Mongoose models and Express infrastructure

## Implementation
- Uses gemini-1.5-pro with temperature 0.3, JSON response mode
- Includes prompt engineering for consistent structured output
- Validates and sanitizes response data (integers, arrays)
- Comprehensive error handling and validation
- Reuses existing services for activity fetching and context building
### 2. Created: `server/src/routes/ai-summaries.js`
- POST `/api/ai-summaries` - Generate new AI summary for organization activities
- GET `/api/ai-summaries/latest` - Retrieve latest AI summary for organization
- Proper validation, error handling, and response formatting
- Uses existing activity service and context builder service

### 3. Updated: `server/src/models/AISummary.js`
- Expanded schema to include all fields from ticket requirements:
  - summary (string)
  - key_metrics object with prs_merged, prs_opened, active_developers, jira_issues_completed, jira_issues_created, slack_messages
  - top_contributors array of strings
  - risks array of strings
  - recommendations array of strings
  - organizationId, type, startDate/endDate, and timestamps

### 4. Updated: `server/src/server.js`
- Registered the new AI summaries routes: `app.use('/api/ai-summaries', aiSummariesRoutes)`
# Ticket 5: Single Gemini call with structured output

## API Endpoints

### POST /api/ai-summaries
Generate a new AI summary for organization activities.

**Request Body:**
```json
{
  "organizationId": "string (required)",
  "type": "string (optional, default: 'weekly')",
  "startDate": "ISO date string (optional)",
  "endDate": "ISO date string (optional)"
}
```

## Implementation Details

### Gemini Service Features:
- Uses `@google/generative-ai` package (already installed)
- Implements generation config: temperature 0.3, topK 32, topP 0.95, maxOutputTokens 1024
- Forces JSON response mime type for reliable structured output
- Includes comprehensive prompt engineering for consistent output format
- Validates and sanitizes response data (ensures integers, proper arrays)
- Graceful error handling with informative logging
- Fallback defaults for missing metrics (0 values)

### Route Handler Features:
- Validates required organizationId parameter
- Handles date range defaults (last 7 days when not specified)
- Uses existing `activity.service.js` for data fetching (`getActivityForRange`)
## Dependencies:
- ✅ `@google/generative-ai` already installed (v0.21.0)
- ✅ Existing context-builder service (from Ticket 4) is functional
- ✅ Existing activity service is functional
- ✅ Mongoose models and database connection already in place
- ✅ Express routing infrastructure already configured

## Usage Example:
```javascript
// Generate a weekly summary
fetch('/api/ai-summaries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    organizationId: '507f1f77bcf86cd799439011',
    type: 'weekly'
  })
})

// Get latest summary
fetch('/api/ai-summaries/latest?organizationId=507f1f77bcf86cd799439011')
```

## Integration Points:
1. **Activity Service**: Reuses existing `getActivityForRange` function
2. **Context Builder**: Reuses existing `buildContext` function from Ticket 4
3. **Gemini AI**: New service with structured output capabilities
4. **Database**: Stores generated summaries in AISummary collection
5. **REST API**: New routes integrated into existing Express server

## Testing Verification:
- ✅ All files pass syntax check with `node -c`
- ✅ Model validation works correctly
- ✅ Service imports successfully
- ✅ Route imports successfully
- ✅ Server starts without syntax errors
- ✅ Dependencies are properly installed

The implementation fulfills all requirements from Ticket 5:
- Single Gemini call with structured output
- Proper prompt engineering for consistent JSON responses
- Integration with existing activity fetching and context building
- Complete CRUD operations for AI summaries (creation and retrieval)
- Proper error handling and validation
- Consistent with existing codebase patterns (JavaScript, not TypeScript)
- Uses existing `context-builder.service.js` for context building (`buildContext`)
- Comprehensive error handling for:
  - Missing organizationId (400)
  - No activity data found (400)
  - Gemini API failures (500)
  - JSON parsing errors (500)
  - Database errors (500)
- Returns appropriate HTTP status codes (201 for creation, 200 for retrieval, 400/404/500 for errors)

### Model Updates:
- Extended AISummary schema to match ticket specification exactly
- Added proper indexes for organization-based queries (`{ organizationId: 1, type: 1, createdAt: -1 }`)
- Maintains timestamps for tracking when summaries were generated
- All numeric key metrics default to 0 when not available in data
- Arrays default to empty arrays when not provided
**Response:**
```json
{
  "message": "AI summary generated successfully",
  "data": {
    "_id": "ObjectId",
    "organizationId": "ObjectId",
    "type": "string",
    "startDate": "ISO date",
    "endDate": "ISO date",
    "summary": "string",
    "key_metrics": {
      "prs_merged": "number",
      "prs_opened": "number",
      "active_developers": "number",
      "jira_issues_completed": "number",
      "jira_issues_created": "number",
      "slack_messages": "number"
    },
    "top_contributors": ["string"],
    "risks": ["string"],
    "recommendations": ["string"],
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
}
```

### GET /api/ai-summaries/latest
Get the latest AI summary for an organization.

**Query Parameters:**
- `organizationId`: string (required)

**Response:**
```json
{
  "data": {
    // Same structure as POST response data
  }
}
```
## Overview
This ticket implements a route that fetches activities, builds context using the context builder service, calls Gemini with structured output, and returns/formats the AI-generated engineering health summary.

## Files Created/Modified

### 1. Created: `server/src/services/ai/gemini.service.js`
- Enhanced Gemini service with proper schema validation and JSON parsing
- Configuration for gemini-1.5-pro model with temperature 0.3, topK 32, topP 0.95, maxOutputTokens 1024
- Forces JSON response mime type for structured output
- Includes prompt engineering for structured output according to AISummary interface
- Proper error handling with logging and fallback mechanisms