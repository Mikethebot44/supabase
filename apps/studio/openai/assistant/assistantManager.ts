import OpenAI from 'openai'
import { getAllTools, type ToolContext } from './toolRegistry'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// Configuration
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID || 'assistant-id-placeholder'
const MAX_POLLING_ATTEMPTS = 30
const POLLING_INTERVAL = 1000 // 1 second

// In-memory thread storage (in production, use database)
const threadStorage = new Map<string, string>()

export interface AssistantManagerContext {
  projectRef: string
  connectionString: string
  userId: string
  headers?: Record<string, string>
}

/**
 * Create or fetch an existing thread for a user
 */
export async function createOrFetchThread(userId: string): Promise<string> {
  try {
    // Check if user already has a thread
    const existingThreadId = threadStorage.get(userId)
    
    if (existingThreadId) {
      // Verify the thread still exists
      try {
        await openai.beta.threads.retrieve(existingThreadId)
        return existingThreadId
      } catch (error) {
        // Thread doesn't exist anymore, create a new one
        console.warn(`Thread ${existingThreadId} not found, creating new one`)
        threadStorage.delete(userId)
      }
    }
    
    // Create new thread
    const thread = await openai.beta.threads.create({
      metadata: {
        userId,
        createdAt: new Date().toISOString(),
      }
    })
    
    // Store thread ID for this user
    threadStorage.set(userId, thread.id)
    
    return thread.id
  } catch (error) {
    console.error('Failed to create or fetch thread:', error)
    throw new Error('Failed to create conversation thread')
  }
}

/**
 * Send a message to the assistant and get response
 */
export async function sendMessageToAssistant(
  threadId: string,
  message: string,
  context: AssistantManagerContext
): Promise<string> {
  try {
    // Add user message to thread
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message,
    })
    
    // Create and run the assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
      instructions: `You are a helpful Supabase backend copilot assistant. You can help with database queries, schema management, table operations, and more. Always be helpful and provide clear explanations with your responses.
      
Current project context:
- Project Reference: ${context.projectRef}
- User ID: ${context.userId}

Use the available tools to help the user with their database operations. Always validate inputs and provide informative responses.`,
    })
    
    // Poll for completion and handle tool calls
    return await pollRunCompletion(threadId, run.id, context)
  } catch (error) {
    console.error('Failed to send message to assistant:', error)
    throw new Error('Failed to get assistant response')
  }
}

/**
 * Poll for run completion and handle tool calls
 */
async function pollRunCompletion(
  threadId: string,
  runId: string,
  context: AssistantManagerContext
): Promise<string> {
  const tools = getAllTools()
  
  for (let attempt = 0; attempt < MAX_POLLING_ATTEMPTS; attempt++) {
    try {
      const run = await openai.beta.threads.runs.retrieve(threadId, runId)
      
      if (run.status === 'completed') {
        // Get the assistant's messages
        const messages = await openai.beta.threads.messages.list(threadId, {
          order: 'desc',
          limit: 1,
        })
        
        const lastMessage = messages.data[0]
        if (lastMessage && lastMessage.role === 'assistant') {
          // Extract text content from the message
          const textContent = lastMessage.content
            .filter(content => content.type === 'text')
            .map(content => content.type === 'text' ? content.text.value : '')
            .join('\n')
          
          return textContent || 'Assistant response received but no text content found.'
        }
        
        return 'Assistant completed but no response found.'
      }
      
      if (run.status === 'requires_action') {
        const requiredAction = run.required_action
        
        if (requiredAction?.type === 'submit_tool_outputs') {
          // Handle tool calls
          const toolOutputs = await Promise.all(
            requiredAction.submit_tool_outputs.tool_calls.map(async (toolCall) => {
              try {
                const result = await handleToolCall(toolCall, context)
                return {
                  tool_call_id: toolCall.id,
                  output: JSON.stringify(result),
                }
              } catch (error) {
                console.error(`Tool call ${toolCall.function.name} failed:`, error)
                return {
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : 'Tool execution failed'
                  }),
                }
              }
            })
          )
          
          // Submit tool outputs
          await openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
            tool_outputs: toolOutputs,
          })
          
          // Continue polling
          continue
        }
      }
      
      if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired') {
        throw new Error(`Assistant run ${run.status}: ${run.last_error?.message || 'Unknown error'}`)
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL))
    } catch (error) {
      console.error(`Polling attempt ${attempt + 1} failed:`, error)
      if (attempt === MAX_POLLING_ATTEMPTS - 1) {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL))
    }
  }
  
  throw new Error('Assistant response timeout')
}

/**
 * Handle individual tool calls
 */
async function handleToolCall(
  toolCall: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall,
  context: AssistantManagerContext
) {
  const tools = getAllTools()
  const toolName = toolCall.function.name
  
  console.log(`Executing tool: ${toolName}`)
  
  // Find the tool executor
  const toolExecutor = tools.executionMap[toolName]
  if (!toolExecutor) {
    throw new Error(`Unknown tool: ${toolName}`)
  }
  
  // Parse arguments
  let args: any
  try {
    args = JSON.parse(toolCall.function.arguments)
  } catch (error) {
    throw new Error(`Invalid tool arguments: ${toolCall.function.arguments}`)
  }
  
  // Create tool context
  const toolContext: ToolContext = {
    projectRef: context.projectRef,
    connectionString: context.connectionString,
    headers: context.headers,
  }
  
  // Execute the tool
  const result = await toolExecutor(args, toolContext)
  
  // Log tool execution for debugging
  console.log(`Tool ${toolName} executed with result:`, {
    success: result.success || false,
    error: result.error || null,
    userId: context.userId,
    timestamp: new Date().toISOString(),
  })
  
  return result
}

/**
 * Clear a user's thread (for starting fresh)
 */
export async function clearUserThread(userId: string): Promise<void> {
  const threadId = threadStorage.get(userId)
  if (threadId) {
    try {
      // Delete the thread from OpenAI
      await openai.beta.threads.del(threadId)
    } catch (error) {
      console.warn('Failed to delete thread from OpenAI:', error)
    }
    
    // Remove from local storage
    threadStorage.delete(userId)
  }
}

/**
 * Get or create the assistant (for setup)
 */
export async function createOrUpdateAssistant(): Promise<string> {
  const tools = getAllTools()
  
  try {
    if (ASSISTANT_ID && ASSISTANT_ID !== 'assistant-id-placeholder') {
      // Update existing assistant
      const assistant = await openai.beta.assistants.update(ASSISTANT_ID, {
        name: 'Supabase Backend Copilot',
        instructions: `You are a helpful AI assistant for Supabase Studio that helps users with database operations and backend development.

You can help with:
- Running SQL queries (read-only for safety)
- Getting table schema information
- Creating new tables with proper structure
- Listing all tables in the database
- Dropping tables (with safety checks)

Guidelines:
- Always validate user inputs
- Provide clear explanations with your responses
- Use safety checks for potentially destructive operations
- Follow PostgreSQL and Supabase best practices
- Enable Row Level Security (RLS) on new tables by default
- Suggest appropriate indexes and constraints

Be helpful, informative, and prioritize data safety.`,
        model: 'gpt-4o',
        tools: tools.schema,
      })
      
      return assistant.id
    } else {
      // Create new assistant
      const assistant = await openai.beta.assistants.create({
        name: 'Supabase Backend Copilot',
        instructions: `You are a helpful AI assistant for Supabase Studio that helps users with database operations and backend development.

You can help with:
- Running SQL queries (read-only for safety)
- Getting table schema information
- Creating new tables with proper structure
- Listing all tables in the database
- Dropping tables (with safety checks)

Guidelines:
- Always validate user inputs
- Provide clear explanations with your responses
- Use safety checks for potentially destructive operations
- Follow PostgreSQL and Supabase best practices
- Enable Row Level Security (RLS) on new tables by default
- Suggest appropriate indexes and constraints

Be helpful, informative, and prioritize data safety.`,
        model: 'gpt-4o',
        tools: tools.schema,
      })
      
      console.log('Created new assistant with ID:', assistant.id)
      console.log('Add this to your environment variables: OPENAI_ASSISTANT_ID=' + assistant.id)
      
      return assistant.id
    }
  } catch (error) {
    console.error('Failed to create or update assistant:', error)
    throw new Error('Failed to setup assistant')
  }
} 