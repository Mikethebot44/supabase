import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'
import { createOrFetchThread, sendMessageToAssistant, type AssistantManagerContext } from '../../../../openai/assistant/assistantManager'

export const maxDuration = 60 // Extended timeout for assistant responses

const openAiKey = process.env.OPENAI_API_KEY

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!openAiKey) {
    return res.status(500).json({
      error: 'No OPENAI_API_KEY set. Create this environment variable to use AI features.',
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: `Method ${req.method} Not Allowed`,
    })
  }

  try {
    const { message, projectRef, connectionString, userId } = req.body

    // Validate required fields
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid message in request body',
      })
    }

    if (!projectRef || !connectionString || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: projectRef, connectionString, userId',
      })
    }

    // Create assistant context
    const context: AssistantManagerContext = {
      projectRef,
      connectionString,
      userId,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization && { Authorization: req.headers.authorization }),
        ...(req.headers.cookie && { cookie: req.headers.cookie }),
      },
    }

    // Get or create thread for user
    const threadId = await createOrFetchThread(userId)

    // Send message to assistant
    const response = await sendMessageToAssistant(threadId, message, context)

    return res.status(200).json({
      success: true,
      response,
      threadId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Assistant chat error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get assistant response',
    })
  }
}

const wrapper = (req: NextApiRequest, res: NextApiResponse) =>
  apiWrapper(req, res, handler, { withAuth: true })

export default wrapper 