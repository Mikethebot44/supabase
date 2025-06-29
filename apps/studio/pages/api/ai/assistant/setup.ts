import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from 'lib/api/apiWrapper'
import { createOrUpdateAssistant } from '../../../../openai/assistant/assistantManager'

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
    // This endpoint should only be accessible by admins/developers
    // In production, you might want to add additional authentication checks
    console.log('Setting up Supabase Assistant...')
    
    const assistantId = await createOrUpdateAssistant()

    return res.status(200).json({
      success: true,
      assistantId,
      message: 'Assistant created/updated successfully',
      note: assistantId.startsWith('asst_') 
        ? 'Assistant is ready to use' 
        : 'Add the assistant ID to your environment variables as OPENAI_ASSISTANT_ID',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Assistant setup error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to setup assistant',
    })
  }
}

const wrapper = (req: NextApiRequest, res: NextApiResponse) =>
  apiWrapper(req, res, handler, { withAuth: true })

export default wrapper 