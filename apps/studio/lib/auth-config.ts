import { AuthClientOptions } from '@supabase/auth-js'
import { IS_PLATFORM, CUSTOM_AUTH_ENABLED } from './constants'

/**
 * Supabase Auth configuration for platform and custom auth modes
 * - IS_PLATFORM=true: cloud deployment with platform access
 * - CUSTOM_AUTH_ENABLED=true: uses your own Supabase project for auth
 */
export const getAuthConfig = (): AuthClientOptions => {
  if (!IS_PLATFORM && !CUSTOM_AUTH_ENABLED) {
    // Self-hosted mode - minimal configuration (bypassed anyway)
    return {
      url: process.env.NEXT_PUBLIC_GOTRUE_URL,
      storageKey: process.env.NEXT_PUBLIC_STORAGE_KEY || 'supabase.dashboard.auth.token',
      detectSessionInUrl: true,
      debug: false,
    }
  }

  if (CUSTOM_AUTH_ENABLED && !IS_PLATFORM) {
    // Custom auth mode - use your Supabase project
    return {
      url: process.env.NEXT_PUBLIC_GOTRUE_URL,
      storageKey: process.env.NEXT_PUBLIC_STORAGE_KEY || 'supabase.studio.auth.token',
      detectSessionInUrl: true,
      debug: process.env.NODE_ENV === 'development',
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
      // Remove userStorage to prevent the session access error
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      headers: {
        'X-Client-Platform': 'supabase-studio',
        'X-Client-Version': process.env.npm_package_version || '1.0.0',
      },
    }
  }

  // Platform mode configuration for production
  const baseConfig: AuthClientOptions = {
    url: process.env.NEXT_PUBLIC_GOTRUE_URL,
    storageKey: process.env.NEXT_PUBLIC_STORAGE_KEY || 'supabase.dashboard.auth.token',
    detectSessionInUrl: true,
    debug: process.env.NODE_ENV === 'development',
    persistSession: true,
    autoRefreshToken: true,
    
    // Security settings for production
    flowType: 'pkce',
    
    // Session configuration
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    
    // Custom headers for API requests
    headers: {
      'X-Client-Platform': 'web',
      'X-Client-Version': process.env.npm_package_version || '1.0.0',
    },
  }

  return baseConfig
}

/**
 * OAuth provider configurations for platform mode
 */
export const OAUTH_PROVIDERS = {
  github: {
    enabled: true,
    scopes: 'read:user user:email',
  },
  google: {
    enabled: true,
    scopes: 'openid email profile',
  },
  azure: {
    enabled: false,
    scopes: 'openid email profile',
  },
  discord: {
    enabled: false,
    scopes: 'identify email',
  },
} as const

/**
 * Redirect URLs configuration
 */
export const getRedirectUrls = () => {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8082'
  
  return {
    signIn: `${baseUrl}/auth/callback`,
    signOut: `${baseUrl}/sign-in`,
    passwordReset: `${baseUrl}/auth/reset-password`,
    emailConfirmation: `${baseUrl}/auth/confirm`,
  }
}

/**
 * Auth error messages for platform mode
 */
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid login credentials',
  EMAIL_NOT_CONFIRMED: 'Please check your email and click the confirmation link',
  WEAK_PASSWORD: 'Password should be at least 6 characters',
  EMAIL_EXISTS: 'A user with this email already exists',
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later',
  SIGNUP_DISABLED: 'Sign ups are currently disabled',
  INVALID_TOKEN: 'Invalid or expired token',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again',
  MFA_REQUIRED: 'Multi-factor authentication is required',
  MFA_INVALID: 'Invalid verification code',
} as const

/**
 * User roles and permissions for platform mode
 */
export const USER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin', 
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const

export const PERMISSIONS = {
  // Project permissions
  PROJECT_CREATE: 'project.create',
  PROJECT_READ: 'project.read',
  PROJECT_UPDATE: 'project.update',
  PROJECT_DELETE: 'project.delete',
  
  // Organization permissions
  ORG_CREATE: 'organization.create',
  ORG_READ: 'organization.read',
  ORG_UPDATE: 'organization.update',
  ORG_DELETE: 'organization.delete',
  ORG_INVITE: 'organization.invite',
  
  // Billing permissions
  BILLING_READ: 'billing.read',
  BILLING_UPDATE: 'billing.update',
  
  // Database permissions
  DATABASE_READ: 'database.read',
  DATABASE_UPDATE: 'database.update',
  
  // API keys permissions
  API_KEYS_READ: 'api_keys.read',
  API_KEYS_CREATE: 'api_keys.create',
  API_KEYS_DELETE: 'api_keys.delete',
} as const

/**
 * Role-based permissions mapping
 */
export const ROLE_PERMISSIONS = {
  [USER_ROLES.OWNER]: Object.values(PERMISSIONS),
  [USER_ROLES.ADMIN]: [
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.ORG_READ,
    PERMISSIONS.ORG_UPDATE,
    PERMISSIONS.ORG_INVITE,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.DATABASE_READ,
    PERMISSIONS.DATABASE_UPDATE,
    PERMISSIONS.API_KEYS_READ,
    PERMISSIONS.API_KEYS_CREATE,
    PERMISSIONS.API_KEYS_DELETE,
  ],
  [USER_ROLES.MEMBER]: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.ORG_READ,
    PERMISSIONS.DATABASE_READ,
    PERMISSIONS.DATABASE_UPDATE,
    PERMISSIONS.API_KEYS_READ,
  ],
  [USER_ROLES.VIEWER]: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.ORG_READ,
    PERMISSIONS.DATABASE_READ,
    PERMISSIONS.API_KEYS_READ,
  ],
} as const