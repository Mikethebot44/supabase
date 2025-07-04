import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from 'common'
import { IS_PLATFORM, CUSTOM_AUTH_ENABLED } from './constants'

/**
 * Authentication middleware for platform mode
 * Protects routes and enforces authentication
 */

interface ProtectedRoute {
  path: string
  requiresAuth: boolean
  allowedRoles?: string[]
  permissions?: string[]
}

/**
 * Define protected routes and their requirements
 */
const PROTECTED_ROUTES: ProtectedRoute[] = [
  // Organization routes
  { path: '/organizations', requiresAuth: true },
  { path: '/org/', requiresAuth: true },
  
  // Project routes  
  { path: '/project/', requiresAuth: true },
  { path: '/projects', requiresAuth: true },
  
  // Account routes
  { path: '/account', requiresAuth: true },
  
  // Support routes (may allow partial auth)
  { path: '/support', requiresAuth: false },
  
  // Admin routes (require specific roles)
  { 
    path: '/admin', 
    requiresAuth: true, 
    allowedRoles: ['owner', 'admin'],
    permissions: ['admin.access']
  },
]

/**
 * Public routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/sign-in-sso',
  '/sign-in-mfa',
  '/forgot-password',
  '/auth/callback',
  '/auth/confirm',
  '/auth/reset-password',
  '/api/auth/',
  '/api/health',
  '/api/status',
  '/api/constants',
  '/_next/',
  '/favicon.ico',
  '/img/',
  '/docs/',
  '/static/',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
]

/**
 * Check if a path is public (doesn't require authentication)
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Find matching protected route configuration
 */
function findProtectedRoute(pathname: string): ProtectedRoute | null {
  return PROTECTED_ROUTES.find(route => pathname.startsWith(route.path)) || null
}

/**
 * Extract user information from JWT token
 */
async function getUserFromToken(token: string): Promise<{
  id: string
  email: string
  role?: string
  permissions?: string[]
  organizations?: Array<{ id: string, role: string }>
} | null> {
  try {
    // Decode JWT token (this is a simplified version)
    // In production, you'd validate the token properly
    const payload = JSON.parse(atob(token.split('.')[1]))
    
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.user_metadata?.role,
      permissions: payload.user_metadata?.permissions || [],
      organizations: payload.user_metadata?.organizations || [],
    }
  } catch (error) {
    console.error('Failed to decode token:', error)
    return null
  }
}

/**
 * Check if user has required permissions
 */
function hasPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.every(permission => userPermissions.includes(permission))
}

/**
 * Check if user has required role
 */
function hasRole(userRole: string | undefined, allowedRoles: string[]): boolean {
  return userRole ? allowedRoles.includes(userRole) : false
}

/**
 * Main authentication middleware function
 */
export async function authMiddleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Skip auth middleware in self-hosted mode (when both platform and custom auth are disabled)
  if (!IS_PLATFORM && !CUSTOM_AUTH_ENABLED) {
    return NextResponse.next()
  }
  
  // Skip auth middleware in development mode only for self-hosted mode
  if (process.env.NODE_ENV === 'development' && !IS_PLATFORM && !CUSTOM_AUTH_ENABLED) {
    return NextResponse.next()
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Find protected route configuration
  const protectedRoute = findProtectedRoute(pathname)
  
  // If no specific protection required, allow access
  if (!protectedRoute?.requiresAuth) {
    return NextResponse.next()
  }

  // Extract authentication token
  const authHeader = request.headers.get('authorization')
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  
  // Try to get token from cookies as fallback (platform mode)
  const tokenFromCookie = request.cookies.get('supabase-auth-token')?.value
  
  // For custom auth mode, check the studio auth token cookie
  const customAuthCookie = request.cookies.get('supabase.studio.auth.token')?.value
  
  const token = tokenFromHeader || tokenFromCookie || customAuthCookie

  if (!token) {
    // In custom auth mode, be more lenient as localStorage tokens aren't accessible in middleware
    if (CUSTOM_AUTH_ENABLED && !IS_PLATFORM) {
      // Allow access and let client-side auth handle verification
      return NextResponse.next()
    }
    
    // No token found, redirect to sign-in
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    url.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(url)
  }

  // Validate token and get user information
  const user = await getUserFromToken(token)
  
  if (!user) {
    // Invalid token, redirect to sign-in
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    url.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(url)
  }

  // Check role requirements
  if (protectedRoute.allowedRoles && !hasRole(user.role, protectedRoute.allowedRoles)) {
    // User doesn't have required role
    const url = request.nextUrl.clone()
    url.pathname = '/unauthorized'
    return NextResponse.redirect(url)
  }

  // Check permission requirements
  if (protectedRoute.permissions && !hasPermissions(user.permissions, protectedRoute.permissions)) {
    // User doesn't have required permissions
    const url = request.nextUrl.clone()
    url.pathname = '/unauthorized'
    return NextResponse.redirect(url)
  }

  // Add user information to request headers for downstream use
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', user.id)
  requestHeaders.set('x-user-email', user.email)
  if (user.role) requestHeaders.set('x-user-role', user.role)
  if (user.permissions.length > 0) requestHeaders.set('x-user-permissions', user.permissions.join(','))

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

/**
 * Configuration for enhanced authentication HOC
 * This should be used in React components, not in middleware
 */
export interface PlatformAuthOptions {
  requiresAuth?: boolean
  allowedRoles?: string[]
  permissions?: string[]
  redirectTo?: string
}

/**
 * Route configuration for different user roles
 */
export const ROLE_ROUTES = {
  owner: ['/organizations', '/org/', '/project/', '/admin/', '/account'],
  admin: ['/organizations', '/org/', '/project/', '/account'],
  member: ['/organizations', '/org/', '/project/', '/account'],
  viewer: ['/organizations', '/org/', '/project/*/database', '/account'],
} as const

/**
 * Get allowed routes for a user role
 */
export function getAllowedRoutesForRole(role: string): string[] {
  return ROLE_ROUTES[role as keyof typeof ROLE_ROUTES] || []
}

/**
 * Check if user can access a specific route based on their role
 */
export function canAccessRoute(userRole: string, pathname: string): boolean {
  const allowedRoutes = getAllowedRoutesForRole(userRole)
  return allowedRoutes.some(route => pathname.startsWith(route))
}