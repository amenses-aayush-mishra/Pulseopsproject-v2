# Ticket 3: Data fetch for time window - Completed

## Objective
Create function to query activities by organization, date range, and optional filters.

## Implementation Summary

### Files Created:
1. **`server/src/services/ai/activity.service.js`** - Main service implementation
2. **`server/src/services/ai/activity.service.test.js`** - Test/example file demonstrating usage

### Functions Implemented:

#### 1. `getActivityForRange(options)`
- Queries activities by organization, date range, and optional filters
- Parameters:
  - `organizationId` (string): Organization ID
  - `startDate` (Date): Start date for query (inclusive)
  - `endDate` (Date): End date for query (inclusive)
  - `source` (optional): 'github' | 'slack' | 'jira'
  - `type` (optional): Activity type filter
  - `actor` (optional): Actor filter
- Returns: Promise resolving to array of activity documents
- Features:
  - Proper MongoDB ObjectId conversion
  - Range query with `$gte` and `$lte`
  - Optional filtering for source, type, and actor
  - Sorting by timestamp descending (newest first)
  - Uses `lean()` for performance
  - Proper error handling with try/catch

#### 2. `getActivityCountsByType(organizationId, startDate, endDate)`
- Returns counts of activities by type for a given organization and date range
- Parameters:
  - `organizationId` (string): Organization ID
  - `startDate` (Date): Start date
  - `endDate` (Date): End date
- Returns: Promise resolving to object with activity types as keys and counts as values
- Features:
  - Reuses `getActivityForRange` for consistency
  - Aggregates counts by activity type
  - Error handling with logging

#### 3. `getWeeklyActivity(organizationId, weekStart)`
- Gets all activities for a specific week (7 days starting from weekStart)
- Parameters:
  - `organizationId` (string): Organization ID
  - `weekStart` (Date): Start of the week (typically Monday 00:00:00)
- Returns: Promise resolving to array of activity documents for the week
- Features:
  - Calculates weekEnd by adding 7 days to weekStart
  - Reuses `getActivityForRange` for consistency
  - Error handling with logging

### Technical Details:
- **Language**: JavaScript (consistent with existing codebase)
- **Type Documentation**: JSDoc for TypeScript-like type definitions
- **Database Layer**: Uses existing Mongoose Activity model
- **Performance**: Uses `lean()` for plain JavaScript objects, proper indexing
- **Error Handling**: Comprehensive try/catch blocks with error logging
- **Tenancy**: Organization-scoped queries (multi-tenant ready)
- **Compatibility**: Works with existing Activity model schema

### Validation:
- Syntax check passed with `node -c`
- File created in correct location: `server/src/services/ai/activity.service.js`
- Follows existing codebase patterns and conventions
- Uses same require patterns as other services
- Properly handles mongoose ObjectId conversion

### Usage Example:
```javascript
const { getActivityForRange, getActivityCountsByType, getWeeklyActivity } = require('./src/services/ai/activity.service');

// Get activities for date range with filters
const activities = await getActivityForRange({
  organizationId: '507f1f77bcf86cd799439011',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  source: 'github',
  type: 'push'
});

// Get activity counts by type
const counts = await getActivityCountsByType(
  '507f1f77bcf86cd799439011',
  new Date('2024-01-01'),
  new Date('2024-01-31')
);

// Get weekly activity
const weekly = await getWeeklyActivity(
  '507f1f77bcf86cd799439011',
  new Date('2024-01-01') // Monday start
);
```

### Integration Ready:
- Service can be imported and used in controllers, routes, or other services
- Follows dependency injection pattern (receives organizationId as parameter)
- Compatible with Express middleware authentication flow
- Ready for use in API endpoints for dashboard/reporting features

## Checklist Completion:
✅ getActivityForRange function implemented  
✅ Query supports organizationId, date range, source, type, actor filters  
✅ Proper sorting and indexing applied (uses existing Activity model indexes)  
✅ Helper functions for common queries added (getActivityCountsByType, getWeeklyActivity)  
✅ Error handling included  

## Next Steps:
1. Import and use this service in API controllers/routes
2. Create API endpoints that utilize these functions for dashboard data
3. Consider adding pagination for large result sets
4. Add unit tests with mock database connections