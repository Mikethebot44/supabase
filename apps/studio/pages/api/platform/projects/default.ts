import { NextApiRequest, NextApiResponse } from 'next'
import { CUSTOM_AUTH_ENABLED, IS_PLATFORM } from 'lib/constants'

/**
 * Mock project detail API for custom auth mode
 * Provides basic project information when not using platform mode
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only handle requests in custom auth mode
  if (IS_PLATFORM || !CUSTOM_AUTH_ENABLED) {
    return res.status(404).json({ 
      success: false, 
      message: 'Endpoint not supported in this mode' 
    })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    })
  }

  try {
    // Return a mock project response for custom auth mode
    const projectData = {
      id: 'default',
      ref: 'default',
      name: process.env.DEFAULT_PROJECT_NAME || 'Default Project',
      status: 'ACTIVE_HEALTHY',
      organization_id: 'default-org',
      cloud_provider: 'custom',
      region: 'local',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      
      // Database connection info
      connectionString: `postgresql://postgres:${process.env.SUPABASE_SERVICE_KEY?.slice(0, 8)}***@${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname}:5432/postgres`,
      
      // API endpoints
      restUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`,
      graphqlUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/graphql/v1`,
      realtimeUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1`,
      storageUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1`,
      authUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`,
      
      // Service versions (mock)
      services: [
        { name: 'postgresql', version: '15.1.0' },
        { name: 'postgrest', version: '12.0.1' },
        { name: 'realtime', version: '2.10.1' },
        { name: 'storage', version: '0.40.4' },
        { name: 'auth', version: '2.126.0' },
      ],
      
      // Infrastructure settings (mock for compatibility)
      infra: {
        compute: { instanceSize: 'small' },
        database: { size: 'small' },
      },
      
      // Settings
      settings: {
        db_schema: 'public',
        db_max_connections: 100,
        db_statement_timeout: 30000,
        db_idle_timeout: 600000,
      },
    }

    res.status(200).json(projectData)
  } catch (error) {
    console.error('Error handling project detail request:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    })
  }
}