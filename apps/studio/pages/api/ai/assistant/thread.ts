import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'
import { createOrFetchThread, clearUserThread } from '../../../../openai/assistant/assistantManager'

const openAiKey = process.env.OPENAI_API_KEY

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!openAiKey) {
    return res.status(500).json({
      error: 'No OPENAI_API_KEY set. Create this environment variable to use AI features.',
    })
  }

  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetThread(req, res)
    case 'DELETE':
      return handleClearThread(req, res)
    default:
      res.setHeader('Allow', ['GET', 'DELETE'])
      return res.status(405).json({ error: `Method ${method} Not Allowed` })
  }
}

/**
 * GET - Get or create a thread for the user
 */
async function handleGetThread(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { userId } = req.query

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid userId parameter',
      })
    }

    const threadId = await createOrFetchThread(userId)

    return res.status(200).json({
      success: true,
      threadId,
      userId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Get thread error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get thread',
    })
  }
}

/**
 * DELETE - Clear a user's thread (start fresh conversation)
 */
async function handleClearThread(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { userId } = req.query

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid userId parameter',
      })
    }

    await clearUserThread(userId)

    return res.status(200).json({
      success: true,
      message: 'Thread cleared successfully',
      userId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Clear thread error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear thread',
    })
  }
}

const wrapper = (req: NextApiRequest, res: NextApiResponse) =>
  apiWrapper(req, res, handler, { withAuth: true })

export default wrapper 