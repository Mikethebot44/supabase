import OpenAI from 'openai'
import { AI_ASSISTANT_SYSTEM_PROMPT, AI_ASSISTANT_FUNCTIONS, DEFAULT_TEMPERATURE, MAX_TOKENS } from './ai-assistant-prompts'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  function_call?: any
}

const MOCK_RESPONSES = [
  "This is a mock response. The AI assistant workflow is working correctly! 🎉",
  "Mock response: Your database query looks good! Here's a simulated suggestion...",
  "Test response: I can help you with Supabase authentication setup...",
  "Mock mode: Here's how you would typically set up row level security..."
]

export class AIAssistantService {
  private openai!: OpenAI
  private mockMode: boolean
  private mockResponseIndex: number = 0
  private conversationHistory: Message[] = []
  private context: string = ''

  constructor(apiKey: string, mockMode: boolean = false, context: string = '') {
    this.mockMode = mockMode
    this.context = context
    if (!mockMode) {
      this.openai = new OpenAI({ 
        apiKey,
        baseURL: 'https://api.zukijourney.com/v1',
        dangerouslyAllowBrowser: true  // Required for browser usage
      })
      // Initialize conversation with system message
      this.conversationHistory = [{
        role: 'system',
        content: AI_ASSISTANT_SYSTEM_PROMPT
      }] as Message[]
    }
  }

  private getNextMockResponse(): string {
    const response = MOCK_RESPONSES[this.mockResponseIndex]
    this.mockResponseIndex = (this.mockResponseIndex + 1) % MOCK_RESPONSES.length
    return response
  }

  setContext(context: string) {
    this.context = context
  }

  async initialize() {
    if (this.mockMode) {
      console.log('Initializing AI Assistant in mock mode')
      return true
    }

    try {
      // Test the connection with a simple completion
      await this.openai.chat.completions.create({
        model: 'zukigm-1',
        messages: [{ role: 'user', content: 'test' }],
      })
      return true
    } catch (error) {
      console.error('Failed to initialize assistant:', error)
      throw error
    }
  }

  async sendMessage(content: string): Promise<any> {
    if (this.mockMode) {
      // Simulate a delay to make it feel more realistic
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      return {
        id: `mock-msg-${Date.now()}`,
        role: 'assistant',
        content: this.getNextMockResponse(),
        createdAt: new Date()
      }
    }

    try {
      // Add user message to history with context
      const userMessage = {
        role: 'user' as const,
        content: `${this.context ? 'Current Context: ' + this.context + '\n\n' : ''}${content}`
      }
      this.conversationHistory.push(userMessage)

      // Get completion from Zuki API
      const completion = await this.openai.chat.completions.create({
        model: 'zukigm-1',
        messages: this.conversationHistory,
        temperature: DEFAULT_TEMPERATURE,
        max_tokens: MAX_TOKENS,
        functions: AI_ASSISTANT_FUNCTIONS,
        function_call: 'auto'
      })

      const assistantMessage = completion.choices[0].message

      // Handle function calls if present
      if (assistantMessage.function_call) {
        const functionResponse = {
          role: 'assistant' as const,
          content: `I suggest executing this operation:\n\`\`\`json\n${JSON.stringify(assistantMessage.function_call, null, 2)}\n\`\`\`\n\nWould you like me to proceed?`,
          function_call: assistantMessage.function_call
        }
        this.conversationHistory.push(functionResponse)
        return {
          id: completion.id,
          ...functionResponse,
          createdAt: new Date()
        }
      }

      // Add assistant response to history
      const response = {
        role: 'assistant' as const,
        content: assistantMessage.content || 'I apologize, but I was unable to generate a response.'
      }
      this.conversationHistory.push(response)

      return {
        id: completion.id,
        ...response,
        createdAt: new Date()
      }
    } catch (error) {
      console.error('Error in sending message:', error)
      throw error
    }
  }

  async cleanup() {
    if (this.mockMode) {
      console.log('Cleaning up mock assistant')
      return
    }
    // Clear conversation history but keep system message
    this.conversationHistory = [{
      role: 'system',
      content: AI_ASSISTANT_SYSTEM_PROMPT
    }] as Message[]
  }
} 