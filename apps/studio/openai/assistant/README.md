# Supabase Studio OpenAI Assistants Integration

This directory contains the implementation of OpenAI Assistants API integration for Supabase Studio, providing a powerful AI backend copilot with tool-calling capabilities.

## 🏗️ Architecture

```
openai/assistant/
├── tools/                    # Individual tool implementations
│   ├── run_sql.ts           # Execute read-only SQL queries
│   ├── get_schema.ts        # Get table schema information
│   ├── create_table.ts      # Create new tables
│   ├── list_tables.ts       # List all tables
│   └── drop_table.ts        # Drop tables (with safety checks)
├── toolRegistry.ts          # Tool registration and OpenAI schema conversion
├── assistantManager.ts      # Core assistant logic and OpenAI API integration
└── README.md               # This file
```

## 🚀 Features

### Database Tools
- **Safe SQL Execution**: Run read-only queries with built-in security checks
- **Schema Management**: Get detailed table structures, constraints, and indexes
- **Table Operations**: Create tables with proper types, constraints, and RLS
- **Database Overview**: List all tables and views with metadata
- **Safe Deletion**: Drop tables with multiple safety validations

### Assistant Capabilities
- **Persistent Conversations**: Thread-based chat that maintains context
- **Automatic Tool Selection**: AI chooses appropriate tools based on user requests
- **Context Awareness**: Knows about current project, user, and database structure
- **Error Handling**: Graceful degradation with informative error messages
- **Security**: All operations are logged and validated

## 🛠️ Implementation Details

### Tools System

Each tool follows a consistent pattern:

```typescript
export const tool = {
  name: 'tool_name',
  description: 'What this tool does',
  parameters: z.object({
    // Zod schema for validation
  }),
  execute: async (args, context) => {
    // Tool implementation
    return { success: true, data: result }
  }
}
```

### Tool Registry

The `toolRegistry.ts` file:
- Imports all tools automatically
- Converts Zod schemas to OpenAI function definitions
- Provides execution mapping for tool calls
- Handles schema validation and conversion

### Assistant Manager

The `assistantManager.ts` handles:
- Thread creation and management per user
- Message sending and response polling
- Tool call execution and result submission
- Error handling and retry logic

## 🔧 Adding New Tools

To add a new tool:

1. **Create Tool File**: `tools/my_new_tool.ts`
```typescript
import { z } from 'zod'
import { executeSql } from 'data/sql/execute-sql-query'
// ... other imports

export const tool = {
  name: 'my_new_tool',
  description: 'Description of what the tool does',
  parameters: z.object({
    param1: z.string().describe('Parameter description'),
    param2: z.number().optional().describe('Optional parameter'),
  }),
  execute: async (args: { param1: string; param2?: number }, context: ToolContext) => {
    try {
      // Tool implementation
      return { success: true, result: 'Tool result' }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}
```

2. **Register Tool**: Add to `toolRegistry.ts`
```typescript
import { tool as myNewTool } from './tools/my_new_tool'

const tools: ToolDefinition[] = [
  // ... existing tools
  myNewTool,
]
```

3. **Update Assistant**: The assistant will automatically detect new tools

## 🔒 Security Considerations

### SQL Security
- All SQL tools validate query types
- Read-only operations by default
- Dangerous keywords are blocked
- System table protection

### Authentication
- All API endpoints require authentication
- User context from Supabase session
- Per-user thread isolation

### Input Validation
- Zod schemas validate all inputs
- SQL injection prevention
- Safe table/column name validation

## 🏃‍♂️ Usage Examples

### Basic Assistant Integration

```typescript
import { AIAssistantChat } from 'components/ui/AIAssistantChat'

function MyPage() {
  return (
    <div className="h-screen">
      <AIAssistantChat />
    </div>
  )
}
```

### Direct API Usage

```typescript
// Send message to assistant
const response = await fetch('/api/ai/assistant/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Show me all tables in my database',
    projectRef: 'my-project',
    connectionString: 'postgres://...',
    userId: 'user-123',
  }),
})

const data = await response.json()
console.log(data.response) // Assistant's response
```

### Thread Management

```typescript
// Get or create thread
const threadResponse = await fetch(`/api/ai/assistant/thread?userId=${userId}`)
const { threadId } = await threadResponse.json()

// Clear thread
await fetch(`/api/ai/assistant/thread?userId=${userId}`, { method: 'DELETE' })
```

## 🔧 Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-proj-...

# Optional (auto-generated if not provided)
OPENAI_ASSISTANT_ID=asst_...
```

### Assistant Setup

Run the setup endpoint to create/update the assistant:

```bash
curl -X POST http://localhost:8082/api/ai/assistant/setup
```

## 📊 Monitoring & Debugging

### Logging

All tool executions are logged with:
- Tool name and arguments
- Execution result (success/error)
- User ID and timestamp
- Performance metrics

### Error Handling

The system provides graceful error handling:
- Invalid queries are caught and explained
- API failures include retry mechanisms
- User-friendly error messages
- Debug information in development

### Performance

- Tool calls are executed in parallel when possible
- Database connections are pooled
- Responses are cached where appropriate
- Long operations show progress indicators

## 🧪 Testing

### Manual Testing

Use the AI assistant chat interface to test:

1. **SQL Queries**: "Show me all users in the users table"
2. **Schema Info**: "What columns does the posts table have?"
3. **Table Creation**: "Create a comments table with id, post_id, content, and created_at"
4. **Database Overview**: "List all tables in my database"

### API Testing

```bash
# Test assistant chat
curl -X POST http://localhost:8082/api/ai/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"List all tables","projectRef":"test","connectionString":"...","userId":"test"}'

# Test thread management
curl http://localhost:8082/api/ai/assistant/thread?userId=test

# Test setup
curl -X POST http://localhost:8082/api/ai/assistant/setup
```

## 🚀 Deployment Considerations

### Production Setup

1. **Database Storage**: Replace in-memory thread storage with persistent database
2. **Rate Limiting**: Implement proper rate limiting for API endpoints
3. **Monitoring**: Add comprehensive logging and metrics
4. **Caching**: Cache frequently accessed schema information
5. **Scaling**: Consider assistant instance management for high traffic

### Security

1. **API Keys**: Use secure secret management
2. **User Permissions**: Validate user access to specific projects
3. **Audit Logging**: Log all database operations
4. **Input Sanitization**: Additional validation for all inputs

## 🤝 Contributing

When contributing new tools or features:

1. Follow the established patterns
2. Add comprehensive error handling
3. Include proper TypeScript types
4. Add security validations
5. Update documentation
6. Test thoroughly

## 📋 TODO

- [ ] Add tool execution caching
- [ ] Implement streaming responses for long operations
- [ ] Add more database management tools
- [ ] Create tool usage analytics
- [ ] Add support for custom tool descriptions
- [ ] Implement tool permissions system

---

This implementation provides a solid foundation for AI-powered database assistance while maintaining security, scalability, and developer experience. 