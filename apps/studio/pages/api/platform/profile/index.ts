import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from 'lib/api/apiWrapper'
import { DEFAULT_PROJECT } from '../../constants'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAll(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGetAll = async (req: NextApiRequest, res: NextApiResponse) => {
  // Mock user profile for custom auth mode
  const response = {
    id: 'custom-user-1',
    primary_email: 'user@example.com',
    username: 'customuser',
    first_name: 'Custom',
    last_name: 'User',
    mobile: null,
    organizations: [
      {
        id: 1,
        name: process.env.DEFAULT_ORGANIZATION_NAME || 'Default Organization',
        slug: 'default-org-slug',
        billing_email: 'billing@example.com',
        projects: [{ 
          ...DEFAULT_PROJECT, 
          connectionString: process.env.NEXT_PUBLIC_SUPABASE_URL ? 
            `postgresql://postgres:${process.env.SUPABASE_SERVICE_KEY?.split('.')[0]}@${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').replace('http://', '')}:5432/postgres` :
            ''
        }],
      },
    ],
    // Ensure required fields for profile compatibility
    gotrue_id: 'custom-user-1',
    is_alpha_user: false,
    free_project_limit: 2,
  }
  return res.status(200).json(response)
}
