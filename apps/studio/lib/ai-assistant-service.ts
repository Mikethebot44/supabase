import OpenAI from 'openai'
import { Message } from './types'

const SYSTEM_PROMPT = `You are an AI assistant for Supabase Studio, a powerful database management and development platform. Your role is to help users with:

1. Database Operations
- SQL queries and optimizations
- Schema design and management
- Row Level Security (RLS) policies
- Database functions and triggers
- Migrations and backups

2. Authentication & Authorization
- User management
- OAuth providers setup
- JWT configuration
- Role-based access control

3. Storage
- Bucket management
- File upload configurations
- Storage rules and policies

4. Edge Functions
- Function deployment
- Environment variables
- Error handling and debugging

5. API Development
- RESTful endpoints
- GraphQL APIs
- Realtime subscriptions
- API documentation

You have deep knowledge of Supabase's features and best practices. Always provide specific, actionable advice and include code examples when relevant.`

// Mock responses for different types of queries
const MOCK_RESPONSES: { [key: string]: string } = {
  default: `I can help you with that! Here are some common tasks I can assist with:
- SQL query optimization
- Database schema design
- RLS policy creation
- Authentication setup
- Storage configuration
- API integration

What would you like to know more about?`,
  
  sql: `Here's how you can optimize your SQL query:

\`\`\`sql
SELECT u.id, u.name, p.title
FROM users u
INNER JOIN posts p ON u.id = p.user_id
WHERE u.active = true
LIMIT 100;
\`\`\`

Key optimization tips:
1. Use indexes on frequently queried columns
2. Limit result sets
3. Use INNER JOIN when possible
4. Be specific with column selection`,

  rls: `Here's a basic RLS policy example:

\`\`\`sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = user_id);
\`\`\`

This policy ensures users can only view their own profile data.`,

  auth: `For authentication setup:

1. Enable the Auth providers you want to use
2. Configure your OAuth credentials
3. Set up your email templates
4. Add client-side auth code

Would you like a specific example for any of these steps?`
}

export class AIAssistantService {
  private client: OpenAI
  private messages: { role: 'system' | 'user' | 'assistant', content: string }[] = []

  constructor(apiKey: string) {
    if (!apiKey?.trim()) {
      throw new Error(JSON.stringify({ 
        message: 'API key is required. Please add your Zuki API key to .env.local file.' 
      }))
    }

    // Initialize Zuki client with custom base URL
    this.client = new OpenAI({ 
      apiKey: apiKey.trim(),
      baseURL: 'https://api.zukijourney.com/v1',
      dangerouslyAllowBrowser: true
    })

    this.messages = [{
      role: 'system',
      content: SYSTEM_PROMPT
    }]
  }

  async initialize(): Promise<boolean> {
    try {
      // Test the connection with Zuki's API
      const testResponse = await this.client.chat.completions.create({
        model: 'zukigm-1',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5
      })
      return true
    } catch (error: any) {
      console.error('Failed to initialize assistant:', error)
      throw new Error(JSON.stringify({ 
        message: 'Failed to initialize AI Assistant. Please check your API key in the .env.local file.' 
      }))
    }
  }

  async sendMessage(content: string): Promise<Message> {
    try {
      // Add user message to history
      this.messages.push({
        role: 'user',
        content
      })

      // Get completion from Zuki
      const completion = await this.client.chat.completions.create({
        model: 'zukigm-1',
        messages: this.messages,
        temperature: 0.7,
        stream: false
      })

      const assistantMessage = completion.choices[0].message

      // Create response message
      const response: Message = {
        id: completion.id,
        role: 'assistant',
        content: assistantMessage.content || 'I apologize, but I was unable to generate a response.',
        createdAt: new Date()
      }

      // Add assistant response to history
      this.messages.push({
        role: 'assistant',
        content: response.content
      })

      return response
    } catch (error: any) {
      console.error('Error in sending message:', error)
      throw new Error(JSON.stringify({ 
        message: 'Failed to get response from AI Assistant. Please try again.' 
      }))
    }
  }

  cleanup(): void {
    // Clear conversation history but keep system message
    this.messages = [{
      role: 'system',
      content: SYSTEM_PROMPT
    }]
  }
}   