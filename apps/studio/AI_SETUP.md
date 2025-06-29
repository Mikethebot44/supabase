# AI Chat Setup Guide

To enable the AI chat functionality in Supabase Studio, you need to configure your OpenAI API key and optionally set up the new OpenAI Assistants API integration.

## Setup Steps

### 1. Get an OpenAI API Key
   - Visit https://platform.openai.com/api-keys
   - Create a new API key
   - Copy the key

### 2. Set Environment Variables
   - Create a `.env.local` file in the `apps/studio` directory (if it doesn't exist)
   - Add the following lines:
   ```
   OPENAI_API_KEY=your_actual_api_key_here
   OPENAI_ASSISTANT_ID=your_assistant_id_here  # Optional, for Assistants API
   ```

### 3. Restart the Development Server
   ```bash
   cd apps/studio
   npm run dev
   ```

## AI Features Available

### Standard Chat (Current)
- **Demo Chat**: The "Demo Chat (Styled)" shows hardcoded messages for styling reference
- **New Chats**: Click "Options" > "New Chat" to create a real AI-powered chat
- **Real AI Integration**: New chats use OpenAI GPT-4o-mini for responses

### AI Assistant with Tools (New)
The new OpenAI Assistants API integration provides advanced functionality:

#### Available Tools:
1. **run_sql** - Execute read-only SQL queries safely
2. **get_schema** - Get detailed table schema information
3. **create_table** - Create new tables with proper structure
4. **list_tables** - List all tables in the database
5. **drop_table** - Drop tables with safety checks

#### Setup Assistant (One-time)
To use the Assistants API, you need to create an assistant:

1. **Option 1: Automatic Setup (Recommended)**
   ```bash
   # Call the setup endpoint (requires authentication)
   curl -X POST http://localhost:8082/api/ai/assistant/setup \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Option 2: Manual Setup**
   - Go to https://platform.openai.com/assistants
   - Create a new assistant with:
     - Model: GPT-4o
     - Tools: The assistant will automatically detect the available tools
   - Copy the assistant ID (starts with `asst_`)
   - Add it to your `.env.local` as `OPENAI_ASSISTANT_ID`

#### Assistant Features:
- **Persistent Conversations**: Each user gets their own thread that maintains context
- **Tool Calling**: Assistant can automatically use database tools to help users
- **Safety**: All SQL operations are validated and read-only by default
- **Context Awareness**: Assistant knows about the current project and user

#### Usage:
- Import and use the `AIAssistantChat` component
- Assistant automatically connects to your database
- Conversations persist across sessions
- Tools are called automatically based on user requests

## API Endpoints

### Standard Chat
- `POST /api/ai/chat` - Send messages to basic chat (streaming)

### Assistant API
- `POST /api/ai/assistant/chat` - Send messages to assistant (with tools)
- `GET /api/ai/assistant/thread?userId=X` - Get/create user thread
- `DELETE /api/ai/assistant/thread?userId=X` - Clear user thread
- `POST /api/ai/assistant/setup` - Create/update assistant

## Environment Variables Reference

```bash
# Required for all AI features
OPENAI_API_KEY=sk-...

# Optional: For Assistants API (auto-generated if not provided)
OPENAI_ASSISTANT_ID=asst_...
```

## Security & Safety

### SQL Operations
- Only `SELECT` queries are allowed in `run_sql` tool
- Dangerous operations (DROP, DELETE, etc.) are blocked in read-only tools
- `drop_table` tool has additional safety checks for system tables
- All operations are logged with user context

### Authentication
- All API endpoints require authentication
- User context is derived from Supabase session
- Each user gets isolated conversation threads

### Rate Limiting
- OpenAI rate limits apply
- Implement exponential backoff for retries
- Long-running operations have extended timeouts

## Troubleshooting

### Common Issues

1. **"No OPENAI_API_KEY set"**
   - Verify your API key is set in `.env.local`
   - Restart the development server

2. **"Failed to create conversation thread"**
   - Check your OpenAI API key has sufficient credits
   - Verify network connectivity to OpenAI

3. **"Assistant not found"**
   - Run the setup endpoint to create the assistant
   - Or manually create one and set `OPENAI_ASSISTANT_ID`

4. **Tool execution failures**
   - Verify database connection
   - Check user permissions
   - Review server logs for details

### Debug Mode
Enable debug logging by setting:
```bash
NODE_ENV=development
```

## Migration from Basic Chat

The new assistant API runs alongside the existing chat. To migrate:

1. Replace `useChat` hooks with direct API calls to `/api/ai/assistant/chat`
2. Import and use `AIAssistantChat` component
3. Update UI to handle non-streaming responses
4. Add tool usage indicators

## Performance Considerations

- Assistant API responses are not streaming (OpenAI limitation)
- Tool calls may take 5-30 seconds depending on complexity
- Consider showing progress indicators for long operations
- Thread storage is in-memory (use database in production)

---

## Notes

- Standard chat continues to work as before
- Assistant integration is additive, not replacing existing functionality
- All new features are backwards compatible
- Function calling integration is now available with the Assistants API 