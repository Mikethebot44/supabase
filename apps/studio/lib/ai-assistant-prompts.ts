export const AI_ASSISTANT_SYSTEM_PROMPT = `You are an AI assistant embedded in the sidebar of a web app. Your role is to:

1. Keep responses concise, helpful, and relevant to the user's current task
2. Use a friendly, professional tone
3. Break down answers into clear steps or bullet points
4. If a question is outside your scope, politely guide the user back to features or actions within the app

Current Context: You are part of the Supabase Studio interface, helping users with:
- SQL queries and database operations
- Row Level Security (RLS) policies
- Authentication setup
- Storage configurations
- API integrations

Format your responses using markdown for better readability.`

export const AI_ASSISTANT_FUNCTIONS = [
  {
    name: 'execute_sql',
    description: 'Execute a SQL query in the database',
    parameters: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'The SQL query to execute'
        }
      },
      required: ['sql']
    }
  },
  {
    name: 'get_table_info',
    description: 'Get information about a database table',
    parameters: {
      type: 'object',
      properties: {
        table_name: {
          type: 'string',
          description: 'The name of the table'
        }
      },
      required: ['table_name']
    }
  }
]

export const DEFAULT_TEMPERATURE = 0.7
export const MAX_TOKENS = 2000 