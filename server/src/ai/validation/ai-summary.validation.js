const Joi = require('joi');

// Define the Joi schema for AI summary validation
const AISummarySchema = Joi.object({
  summary: Joi.string().min(10).required().messages({
    'string.base': 'Summary must be a string',
    'string.min': 'Summary must be at least 10 characters',
    'any.required': 'Summary is required'
  }),
  key_metrics: Joi.object({
    prs_merged: Joi.number().integer().min(0).required().messages({
      'number.base': 'PRs merged must be a number',
      'number.integer': 'PRs merged must be an integer',
      'number.min': 'PRs merged must be 0 or positive',
      'any.required': 'PRs merged is required'
    }),
    prs_opened: Joi.number().integer().min(0).required().messages({
      'number.base': 'PRs opened must be a number',
      'number.integer': 'PRs opened must be an integer',
      'number.min': 'PRs opened must be 0 or positive',
      'any.required': 'PRs opened is required'
    }),
    active_developers: Joi.number().integer().min(0).required().messages({
      'number.base': 'Active developers must be a number',
      'number.integer': 'Active developers must be an integer',
      'number.min': 'Active developers must be 0 or positive',
      'any.required': 'Active developers is required'
    }),
    jira_issues_completed: Joi.number().integer().min(0).required().messages({
      'number.base': 'Jira issues completed must be a number',
      'number.integer': 'Jira issues completed must be an integer',
      'number.min': 'Jira issues completed must be 0 or positive',
      'any.required': 'Jira issues completed is required'
    }),
    jira_issues_created: Joi.number().integer().min(0).required().messages({
      'number.base': 'Jira issues created must be a number',
      'number.integer': 'Jira issues created must be an integer',
      'number.min': 'Jira issues created must be 0 or positive',
      'any.required': 'Jira issues created is required'
    }),
    slack_messages: Joi.number().integer().min(0).required().messages({
      'number.base': 'Slack messages must be a number',
      'number.integer': 'Slack messages must be an integer',
      'number.min': 'Slack messages must be 0 or positive',
      'any.required': 'Slack messages is required'
    })
  }).required(),
  top_contributors: Joi.array().items(Joi.string()).max(10).messages({
    'array.base': 'Top contributors must be an array',
    'array.max': 'Top contributors must not exceed 10 items'
  }),
  risks: Joi.array().items(Joi.string()).max(10).messages({
    'array.base': 'Risks must be an array',
    'array.max': 'Risks must not exceed 10 items'
  }),
  recommendations: Joi.array().items(Joi.string()).max(10).messages({
    'array.base': 'Recommendations must be an array',
    'array.max': 'Recommendations must not exceed 10 items'
  })
});

// Validation function
function validateAISummary(data) {
  const { error, value } = AISummarySchema.validate(data, { abortEarly: false });
  
  if (error) {
    const errorMessages = error.details.map(detail => detail.message).join(', ');
    console.error('❌ Validation errors:', error.details);
    throw new Error(`AI summary validation failed: ${errorMessages}`);
  }
  
  return value;
}

// Partial validation for update scenarios - create a new schema with all fields optional
const PartialAISummarySchema = Joi.object({
  summary: Joi.string().min(10).messages({
    'string.base': 'Summary must be a string',
    'string.min': 'Summary must be at least 10 characters'
  }),
  key_metrics: Joi.object({
    prs_merged: Joi.number().integer().min(0).messages({
      'number.base': 'PRs merged must be a number',
      'number.integer': 'PRs merged must be an integer',
      'number.min': 'PRs merged must be 0 or positive'
    }),
    prs_opened: Joi.number().integer().min(0).messages({
      'number.base': 'PRs opened must be a number',
      'number.integer': 'PRs opened must be an integer',
      'number.min': 'PRs opened must be 0 or positive'
    }),
    active_developers: Joi.number().integer().min(0).messages({
      'number.base': 'Active developers must be a number',
      'number.integer': 'Active developers must be an integer',
      'number.min': 'Active developers must be 0 or positive'
    }),
    jira_issues_completed: Joi.number().integer().min(0).messages({
      'number.base': 'Jira issues completed must be a number',
      'number.integer': 'Jira issues completed must be an integer',
      'number.min': 'Jira issues completed must be 0 or positive'
    }),
    jira_issues_created: Joi.number().integer().min(0).messages({
      'number.base': 'Jira issues created must be a number',
      'number.integer': 'Jira issues created must be an integer',
      'number.min': 'Jira issues created must be 0 or positive'
    }),
    slack_messages: Joi.number().integer().min(0).messages({
      'number.base': 'Slack messages must be a number',
      'number.integer': 'Slack messages must be an integer',
      'number.min': 'Slack messages must be 0 or positive'
    })
  }),
  top_contributors: Joi.array().items(Joi.string()).max(10).messages({
    'array.base': 'Top contributors must be an array',
    'array.max': 'Top contributors must not exceed 10 items'
  }),
  risks: Joi.array().items(Joi.string()).max(10).messages({
    'array.base': 'Risks must be an array',
    'array.max': 'Risks must not exceed 10 items'
  }),
  recommendations: Joi.array().items(Joi.string()).max(10).messages({
    'array.base': 'Recommendations must be an array',
    'array.max': 'Recommendations must not exceed 10 items'
  })
});

// Retry with validation
async function validateWithRetry(fn, maxRetries = 2, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      
      // Validate if it's a summary-like object
      if (result && typeof result === 'object' && result.summary !== undefined) {
        return validateAISummary(result);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Validation attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Exponential backoff
      }
    }
  }
  
  throw lastError;
}

module.exports = {
  validateAISummary,
  validateWithRetry,
  PartialAISummarySchema
};
