import { AuthError, AuthResponse, User, Session } from '@supabase/auth-js'
import { gotrueClient } from 'common'
import { toast } from 'sonner'
import { AUTH_ERRORS, getRedirectUrls, OAUTH_PROVIDERS } from './auth-config'
import { IS_PLATFORM, CUSTOM_AUTH_ENABLED } from './constants'
import { customAuthService } from './custom-auth-service'

export interface SignInWithEmailParams {
  email: string
  password: string
  captchaToken?: string
}

export interface SignUpWithEmailParams {
  email: string
  password: string
  options?: {
    data?: Record<string, any>
    captchaToken?: string
  }
}

export interface SignInWithOAuthParams {
  provider: keyof typeof OAUTH_PROVIDERS
  redirectTo?: string
  scopes?: string
}

export interface ResetPasswordParams {
  email: string
  captchaToken?: string
}

/**
 * Enhanced authentication service for platform mode
 */
export class AuthService {
  /**
   * Sign in with email and password
   */
  static async signInWithEmail({ email, password, captchaToken }: SignInWithEmailParams): Promise<AuthResponse> {
    try {
      const response = await gotrueClient.signInWithPassword({
        email,
        password,
        options: {
          captchaToken,
        },
      })

      if (response.error) {
        AuthService.handleAuthError(response.error)
      }

      return response
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  /**
   * Sign up with email and password
   */
  static async signUpWithEmail({ email, password, options }: SignUpWithEmailParams): Promise<AuthResponse> {
    try {
      const redirectUrls = getRedirectUrls()
      
      const response = await gotrueClient.signUp({
        email,
        password,
        options: {
          ...options,
          emailRedirectTo: redirectUrls.emailConfirmation,
        },
      })

      if (response.error) {
        AuthService.handleAuthError(response.error)
      } else if (response.data.user && !response.data.session) {
        toast.success('Please check your email for a confirmation link')
      }

      return response
    } catch (error) {
      console.error('Sign up error:', error)
      throw error
    }
  }

  /**
   * Sign in with OAuth provider
   */
  static async signInWithOAuth({ provider, redirectTo, scopes }: SignInWithOAuthParams): Promise<AuthResponse> {
    try {
      const redirectUrls = getRedirectUrls()
      const providerConfig = OAUTH_PROVIDERS[provider]
      
      if (!providerConfig.enabled) {
        throw new Error(`${provider} authentication is not enabled`)
      }

      const response = await gotrueClient.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo || redirectUrls.signIn,
          scopes: scopes || providerConfig.scopes,
        },
      })

      if (response.error) {
        AuthService.handleAuthError(response.error)
      }

      return response
    } catch (error) {
      console.error('OAuth sign in error:', error)
      throw error
    }
  }

  /**
   * Sign out current user
   */
  static async signOut(): Promise<{ error: AuthError | null }> {
    try {
      const response = await gotrueClient.signOut()
      
      if (response.error) {
        AuthService.handleAuthError(response.error)
      }

      return response
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  /**
   * Reset password
   */
  static async resetPassword({ email, captchaToken }: ResetPasswordParams): Promise<{ error: AuthError | null }> {
    try {
      const redirectUrls = getRedirectUrls()
      
      const response = await gotrueClient.resetPasswordForEmail(email, {
        redirectTo: redirectUrls.passwordReset,
        captchaToken,
      })

      if (response.error) {
        AuthService.handleAuthError(response.error)
      } else {
        toast.success('Password reset email sent. Please check your inbox.')
      }

      return response
    } catch (error) {
      console.error('Password reset error:', error)
      throw error
    }
  }

  /**
   * Update user password
   */
  static async updatePassword(password: string): Promise<{ error: AuthError | null }> {
    try {
      const response = await gotrueClient.updateUser({ password })

      if (response.error) {
        AuthService.handleAuthError(response.error)
      } else {
        toast.success('Password updated successfully')
      }

      return response
    } catch (error) {
      console.error('Password update error:', error)
      throw error
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(data: Record<string, any>): Promise<{ error: AuthError | null }> {
    try {
      const response = await gotrueClient.updateUser({ data })

      if (response.error) {
        AuthService.handleAuthError(response.error)
      } else {
        toast.success('Profile updated successfully')
      }

      return response
    } catch (error) {
      console.error('Profile update error:', error)
      throw error
    }
  }

  /**
   * Get current session
   */
  static async getSession(): Promise<{ data: { session: Session | null }, error: AuthError | null }> {
    try {
      return await gotrueClient.getSession()
    } catch (error) {
      console.error('Get session error:', error)
      throw error
    }
  }

  /**
   * Get current user
   */
  static async getUser(): Promise<{ data: { user: User | null }, error: AuthError | null }> {
    try {
      return await gotrueClient.getUser()
    } catch (error) {
      console.error('Get user error:', error)
      throw error
    }
  }

  /**
   * Refresh current session
   */
  static async refreshSession(): Promise<{ data: { session: Session | null }, error: AuthError | null }> {
    try {
      return await gotrueClient.refreshSession()
    } catch (error) {
      console.error('Refresh session error:', error)
      throw error
    }
  }

  /**
   * Handle authentication errors with user-friendly messages
   */
  private static handleAuthError(error: AuthError): void {
    let message = error.message

    // Map common error messages to user-friendly ones
    switch (error.message) {
      case 'Invalid login credentials':
        message = AUTH_ERRORS.INVALID_CREDENTIALS
        break
      case 'Email not confirmed':
        message = AUTH_ERRORS.EMAIL_NOT_CONFIRMED
        break
      case 'Password should be at least 6 characters':
        message = AUTH_ERRORS.WEAK_PASSWORD
        break
      case 'User already registered':
        message = AUTH_ERRORS.EMAIL_EXISTS
        break
      case 'For security purposes, you can only request this once every 60 seconds':
        message = AUTH_ERRORS.TOO_MANY_REQUESTS
        break
      case 'Signups not allowed for this instance':
        message = AUTH_ERRORS.SIGNUP_DISABLED
        break
      case 'Token has expired or is invalid':
        message = AUTH_ERRORS.INVALID_TOKEN
        break
      default:
        // Keep original message for unknown errors
        break
    }

    toast.error(message)
  }

  /**
   * Check if user has required permissions
   */
  static hasPermission(user: User | null, permission: string): boolean {
    // Allow everything in pure self-hosted mode (no auth)
    if (!IS_PLATFORM && !CUSTOM_AUTH_ENABLED) return true
    
    // Use custom auth service for permission checks when enabled
    if (CUSTOM_AUTH_ENABLED && !IS_PLATFORM) {
      return customAuthService?.hasPermission(user, permission) ?? false
    }
    
    // Platform mode - check user permissions from metadata
    if (!user) return false
    const userPermissions = user.user_metadata?.permissions || []
    return userPermissions.includes(permission)
  }

  /**
   * Check if user has required role
   */
  static hasRole(user: User | null, role: string): boolean {
    // Allow everything in pure self-hosted mode (no auth)
    if (!IS_PLATFORM && !CUSTOM_AUTH_ENABLED) return true
    
    // Use custom auth service for role checks when enabled
    if (CUSTOM_AUTH_ENABLED && !IS_PLATFORM) {
      return customAuthService?.getUserRole(user) === role
    }
    
    // Platform mode - check user role from metadata
    if (!user) return false
    const userRole = user.user_metadata?.role
    return userRole === role
  }

  /**
   * Get user organization memberships
   */
  static getUserOrganizations(user: User | null): Array<{ id: string, slug: string, role: string }> {
    if (!IS_PLATFORM || !user) return []
    
    // Extract organization memberships from user metadata
    return user.user_metadata?.organizations || []
  }
}