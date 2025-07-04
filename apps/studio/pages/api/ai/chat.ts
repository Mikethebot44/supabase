import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import apiWrapper from 'lib/api/apiWrapper'
import { NextApiRequest, NextApiResponse } from 'next'

export const maxDuration = 30
const openAiKey = process.env.OPENAI_API_KEY

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!openAiKey) {
    return new Response(
      JSON.stringify({
        error: 'No OPENAI_API_KEY set. Create this environment variable to use AI features.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ data: null, error: { message: `Method ${req.method} Not Allowed` } }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json', Allow: 'POST' },
      }
    )
  }

  try {
    const { messages } = req.body

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: 'Missing or invalid messages in request body',
      })
    }

    const result = await streamText({
      model: openai('gpt-4o-mini-2024-07-18'),
      system: `You are a helpful AI assistant for Supabase Studio. You help users with:

- Database design and optimization
- SQL queries and PostgreSQL functions  
- Row Level Security (RLS) policies
- Authentication and user management
- Supabase APIs and integrations
- Edge Functions
- Storage and file management
- Real-time subscriptions

Provide clear, practical advice with code examples when helpful. For database-related questions, suggest best practices like:
- Using proper indexes
- Enabling RLS on tables
- Using appropriate data types
- Following Supabase naming conventions

Keep responses concise`,
      messages: messages,
    })

    return result.pipeDataStreamToResponse(res)
  } catch (error) {
    console.error('Chat error:', error)
    return res.status(500).json({
      error: 'Failed to generate chat response',
    })
  }
}

const wrapper = (req: NextApiRequest, res: NextApiResponse) =>
  apiWrapper(req, res, handler, { withAuth: true })

export default wrapper 