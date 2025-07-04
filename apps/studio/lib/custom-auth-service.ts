import { AuthError, AuthSession, AuthUser, createClient } from '@supabase/supabase-js'
import { CUSTOM_AUTH_ENABLED } from './constants'
import { AUTH_ERRORS, USER_ROLES, PERMISSIONS, ROLE_PERMISSIONS } from './auth-config'

/**
 * Custom Authentication Service
 * Provides authentication functionality using your own Supabase project
 * when CUSTOM_AUTH_ENABLED=true and IS_PLATFORM=false
 */
export class CustomAuthService {
  private supabase
  
  constructor() {
    if (!CUSTOM_AUTH_ENABLED) {
      throw new Error('Custom auth is not enabled. Set NEXT_PUBLIC_CUSTOM_AUTH_ENABLED=true')
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration for custom auth')
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        // Use only storage, not userStorage to avoid session access errors
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: process.env.NEXT_PUBLIC_STORAGE_KEY || 'supabase.studio.auth.token'
      }
    })
  }

  /**
   * Sign in with email and password
   */
  async signInWithPassword(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        throw new AuthError(this.mapErrorMessage(error.message))
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, options?: { data?: Record<string, any> }) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: USER_ROLES.MEMBER, // Default role for new users
            ...options?.data
          }
        }
      })

      if (error) {
        throw new AuthError(this.mapErrorMessage(error.message))
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Sign in with OAuth provider
   */
  async signInWithOAuth(provider: 'github' | 'google') {
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8082'}/auth/callback`
    
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      })

      if (error) {
        throw new AuthError(this.mapErrorMessage(error.message))
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut()
      
      if (error) {
        throw new AuthError(this.mapErrorMessage(error.message))
      }

      return { error: null }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email: string) {
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8082'}/auth/reset-password`
    
    try {
      const { data, error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      })

      if (error) {
        throw new AuthError(this.mapErrorMessage(error.message))
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Update user password
   */
  async updatePassword(newPassword: string) {
    try {
      const { data, error } = await this.supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        return { data: null, error: error as AuthError }
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: { email?: string; data?: Record<string, any> }) {
    try {
      const { data, error } = await this.supabase.auth.updateUser(updates)

      if (error) {
        return { data: null, error: error as AuthError }
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Update password
   */
  async updatePassword(password: string) {
    try {
      const { data, error } = await this.supabase.auth.updateUser({ password })

      if (error) {
        throw new AuthError(this.mapErrorMessage(error.message))
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<{ data: { session: AuthSession | null }, error: AuthError | null }> {
    try {
      const { data, error } = await this.supabase.auth.getSession()

      if (error) {
        throw new AuthError(this.mapErrorMessage(error.message))
      }

      return { data, error: null }
    } catch (error) {
      return { data: { session: null }, error: error as AuthError }
    }
  }

  /**
   * Get current user
   */
  async getUser(): Promise<{ data: { user: AuthUser | null }, error: AuthError | null }> {
    try {
      const { data, error } = await this.supabase.auth.getUser()

      if (error) {
        throw new AuthError(this.mapErrorMessage(error.message))
      }

      return { data, error: null }
    } catch (error) {
      return { data: { user: null }, error: error as AuthError }
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: AuthSession | null) => void) {
    return this.supabase.auth.onAuthStateChange(callback)
  }

  /**
   * Get user role from metadata
   */
  getUserRole(user: AuthUser | null): string {
    if (!user) return USER_ROLES.VIEWER
    return user.user_metadata?.role || user.app_metadata?.role || USER_ROLES.MEMBER
  }

  /**
   * Check if user has permission
   */
  hasPermission(user: AuthUser | null, permission: string): boolean {
    const role = this.getUserRole(user)
    const rolePermissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || []
    return rolePermissions.includes(permission)
  }

  /**
   * Check if user has any of the given permissions
   */
  hasAnyPermission(user: AuthUser | null, permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(user, permission))
  }

  /**
   * Check if user has all of the given permissions
   */
  hasAllPermissions(user: AuthUser | null, permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(user, permission))
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: { 
    email?: string
    data?: Record<string, any>
  }) {
    try {
      const { data, error } = await this.supabase.auth.updateUser(updates)

      if (error) {
        throw new AuthError(this.mapErrorMessage(error.message))
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Map Supabase error messages to user-friendly messages
   */
  private mapErrorMessage(errorMessage: string): string {
    const errorMap: Record<string, string> = {
      'Invalid login credentials': AUTH_ERRORS.INVALID_CREDENTIALS,
      'Email not confirmed': AUTH_ERRORS.EMAIL_NOT_CONFIRMED,
      'Password should be at least 6 characters': AUTH_ERRORS.WEAK_PASSWORD,
      'User already registered': AUTH_ERRORS.EMAIL_EXISTS,
      'Too many requests': AUTH_ERRORS.TOO_MANY_REQUESTS,
      'Signups not allowed': AUTH_ERRORS.SIGNUP_DISABLED,
      'Invalid token': AUTH_ERRORS.INVALID_TOKEN,
      'Token has expired': AUTH_ERRORS.SESSION_EXPIRED,
    }

    return errorMap[errorMessage] || errorMessage
  }
}

// Export singleton instance - only create on client side to avoid SSR issues
export const customAuthService = (() => {
  if (typeof window === 'undefined') return null // Server-side
  if (!CUSTOM_AUTH_ENABLED) return null
  
  try {
    return new CustomAuthService()
  } catch (error) {
    console.error('Failed to initialize custom auth service:', error)
    return null
  }
})()