# Integration Guide: OpenAI Assistants API

This guide explains how to integrate the new OpenAI Assistants API functionality into the existing Supabase Studio application.

## 🎯 Quick Start

### 1. Set Up Environment Variables

Add to your `.env.local`:
```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_ASSISTANT_ID=asst_xxx  # Optional, will be auto-generated
```

### 2. Create Assistant (One-time setup)

```bash
# Option 1: Use the setup API
curl -X POST http://localhost:8082/api/ai/assistant/setup

# Option 2: Manual setup on OpenAI platform
# - Go to https://platform.openai.com/assistants
# - Create assistant with GPT-4o model
# - Copy assistant ID to .env.local
```

### 3. Integrate into UI

#### Option A: Replace Existing Chat Sidebar

```typescript
// In components/ui/AIAgentSidebar.tsx
import { AIAssistantChat } from './AIAssistantChat'

// Replace the existing chat logic with:
{activeChatId === 'assistant' ? (
  <AIAssistantChat />
) : (
  // Existing chat implementation
)}
```

#### Option B: Add Toggle Between Chat Types

```typescript
// Add to AIAgentSidebar.tsx
const [chatMode, setChatMode] = useState<'basic' | 'assistant'>('basic')

// In header section:
<div className="flex items-center gap-1">
  <Button
    type={chatMode === 'basic' ? 'primary' : 'outline'}
    size="tiny"
    onClick={() => setChatMode('basic')}
  >
    Basic Chat
  </Button>
  <Button
    type={chatMode === 'assistant' ? 'primary' : 'outline'}
    size="tiny"
    onClick={() => setChatMode('assistant')}
  >
    AI Assistant
  </Button>
</div>

// In chat area:
{chatMode === 'assistant' ? (
  <AIAssistantChat />
) : (
  // Existing chat implementation
)}
```

#### Option C: Standalone Integration

```typescript
// Use as a standalone component
import { AIAssistantChat } from 'components/ui/AIAssistantChat'

function DatabasePage() {
  return (
    <div className="flex h-screen">
      <div className="flex-1">
        {/* Your main content */}
      </div>
      <div className="w-96 border-l">
        <AIAssistantChat />
      </div>
    </div>
  )
}
```

## 🔧 Customization Options

### Modify Tool Availability

Edit `openai/assistant/toolRegistry.ts`:

```typescript
// Enable/disable specific tools
const tools: ToolDefinition[] = [
  runSqlTool,
  getSchemaTool,
  createTableTool,
  listTablesTool,
  // dropTableTool,  // Disable dangerous operations
]
```

### Add Custom Tools

1. Create `openai/assistant/tools/my_tool.ts`
2. Export tool following the pattern
3. Add to toolRegistry.ts
4. Assistant automatically detects new tools

### Customize Assistant Personality

Edit `openai/assistant/assistantManager.ts`:

```typescript
// In sendMessageToAssistant function
instructions: `You are a helpful Supabase backend copilot assistant.
Custom personality traits:
- Be concise and technical
- Always suggest best practices
- Prioritize security considerations
...`
```

### Modify Safety Checks

Edit individual tools in `openai/assistant/tools/`:

```typescript
// In run_sql.ts
const dangerousPatterns = [
  'drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate',
  // Add more patterns as needed
]
```

## 🎛️ Configuration Options

### Thread Storage

Default: In-memory (development only)

For production, implement persistent storage:

```typescript
// Replace in assistantManager.ts
const threadStorage = new Map<string, string>()

// With database storage:
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, key)

async function getThreadId(userId: string) {
  const { data } = await supabase
    .from('assistant_threads')
    .select('thread_id')
    .eq('user_id', userId)
    .single()
  
  return data?.thread_id
}
```

### Rate Limiting

Add to API routes:

```typescript
// In pages/api/ai/assistant/chat.ts
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
})
```

### Error Handling

Customize error messages:

```typescript
// In AIAssistantChat.tsx
catch (error) {
  console.error('Failed to send message:', error)
  
  // Custom error handling
  if (error.message.includes('rate_limit')) {
    toast.error('Too many requests. Please wait a moment.')
  } else if (error.message.includes('authentication')) {
    toast.error('Authentication failed. Please refresh the page.')
  } else {
    toast.error('Failed to send message. Please try again.')
  }
}
```

## 🚦 Feature Flags

Add feature flags for gradual rollout:

```typescript
// In components/ui/AIAgentSidebar.tsx
import { useFlag } from 'hooks/ui/useFlag'

const AIAgentSidebar = () => {
  const assistantEnabled = useFlag('aiAssistantEnabled')
  
  return (
    // ... existing code
    {assistantEnabled && (
      <Button onClick={() => setChatMode('assistant')}>
        AI Assistant (Beta)
      </Button>
    )}
  )
}
```

## 🧪 Testing Integration

### 1. Basic Functionality

Test these scenarios:
- [ ] Send simple message
- [ ] SQL query execution
- [ ] Table schema requests
- [ ] Table creation
- [ ] Error handling

### 2. User Experience

- [ ] Thread persistence across sessions
- [ ] Loading states during tool execution
- [ ] Error messages are helpful
- [ ] UI responsive and accessible

### 3. Security

- [ ] SQL injection attempts are blocked
- [ ] System tables cannot be dropped
- [ ] User isolation works correctly
- [ ] Authentication is enforced

## 📈 Monitoring

Add telemetry to track usage:

```typescript
// In assistantManager.ts
import { useSendEventMutation } from 'data/telemetry/send-event-mutation'

// Log tool usage
console.log(`Tool ${toolName} executed with result:`, {
  success: result.success || false,
  error: result.error || null,
  userId: context.userId,
  timestamp: new Date().toISOString(),
  duration: Date.now() - startTime,
})

// Send to analytics
sendEvent({
  action: 'ai_assistant_tool_used',
  properties: {
    tool_name: toolName,
    success: result.success,
    project_id: context.projectRef,
  }
})
```

## 🔄 Migration Path

### Phase 1: Side-by-side
- Deploy assistant alongside existing chat
- Add toggle to switch between modes
- Limited user access via feature flag

### Phase 2: A/B Testing
- Randomly assign users to assistant vs basic chat
- Measure engagement and success metrics
- Collect user feedback

### Phase 3: Full Rollout
- Make assistant the default
- Keep basic chat as fallback
- Deprecate old implementation gradually

## 🐛 Troubleshooting

### Common Issues

1. **Assistant not responding**
   - Check OpenAI API key is valid
   - Verify assistant ID is correct
   - Check network connectivity

2. **Tool execution fails**
   - Verify database connection
   - Check user permissions
   - Review SQL query syntax

3. **Thread creation errors**
   - Ensure user ID is properly set
   - Check OpenAI account limits
   - Verify authentication

### Debug Mode

Enable detailed logging:

```bash
DEBUG=assistant:* npm run dev
```

### Health Check

Add health check endpoint:

```typescript
// pages/api/ai/assistant/health.ts
export default async function handler(req, res) {
  try {
    const tools = getAllTools()
    const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID)
    
    res.json({
      status: 'healthy',
      tools_count: tools.schema.length,
      assistant_model: assistant.model,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    })
  }
}
```

---

This integration guide provides multiple paths for adopting the OpenAI Assistants API while maintaining compatibility with existing functionality. 