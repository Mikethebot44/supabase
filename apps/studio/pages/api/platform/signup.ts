import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { CUSTOM_AUTH_ENABLED, IS_PLATFORM } from 'lib/constants'

/**
 * Signup API for custom auth mode
 * Handles user registration when not using platform mode
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only handle requests in custom auth mode (not platform and not pure self-hosted)
  if (IS_PLATFORM || !CUSTOM_AUTH_ENABLED) {
    return res.status(404).json({ 
      success: false, 
      message: 'Endpoint not supported in this mode' 
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    })
  }

  try {
    const { email, password, redirectTo } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      })
    }

    // Create Supabase client for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    })

    // Use proper redirect URL for custom auth mode
    const finalRedirectTo = redirectTo || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8082'}/auth/callback`
    
    // Attempt to sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: finalRedirectTo,
        data: {
          role: 'member', // Default role for new users in custom auth mode
        }
      }
    })

    if (error) {
      console.error('Signup error:', error)
      return res.status(400).json({
        success: false,
        message: error.message
      })
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'User created successfully',
      user: data.user,
      session: data.session
    })

  } catch (error) {
    console.error('Error handling signup request:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    })
  }
}