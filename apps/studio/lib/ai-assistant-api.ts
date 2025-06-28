import OpenAI from 'openai'
import { AI_ASSISTANT_SYSTEM_PROMPT, AI_ASSISTANT_FUNCTIONS, DEFAULT_TEMPERATURE, MAX_TOKENS } from './ai-assistant-prompts'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export class AIAssistantAPI {
  private openai: OpenAI
  private context: string

  constructor(apiKey: string, context: string = '') {
    this.openai = new OpenAI({ apiKey })
    this.context = context
  }

  async sendMessage(message: string, previousMessages: Message[] = []) {
    try {
      const messages = [
        { role: 'system', content: AI_ASSISTANT_SYSTEM_PROMPT },
        ...previousMessages,
        { role: 'user', content: `${this.context ? 'Current Context: ' + this.context + '\n\n' : ''}${message}` }
      ]

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: messages as any,
        temperature: DEFAULT_TEMPERATURE,
        max_tokens: MAX_TOKENS,
        functions: AI_ASSISTANT_FUNCTIONS,
        function_call: 'auto'
      })

      const completion = response.choices[0].message

      // Handle function calls if needed
      if (completion.function_call) {
        // Here you would implement the function call handling
        // For now, we'll just return the function call suggestion
        return {
          role: 'assistant',
          content: `I suggest executing this operation:\n\`\`\`json\n${JSON.stringify(completion.function_call, null, 2)}\n\`\`\`\n\nWould you like me to proceed?`
        }
      }

      return {
        role: 'assistant',
        content: completion.content || 'I apologize, but I was unable to generate a response.'
      }
    } catch (error: any) {
      console.error('Error in AI Assistant:', error)
      throw new Error(error.message || 'Failed to get response from AI Assistant')
    }
  }

  setContext(context: string) {
    this.context = context
  }
} 