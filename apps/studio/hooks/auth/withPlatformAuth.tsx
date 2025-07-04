import { ComponentType } from 'react'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { useAuth } from 'lib/auth'
import { AuthService } from 'lib/auth-service'
import { IS_PLATFORM } from 'lib/constants'
import { NextPageWithLayout, isNextPageWithLayout } from 'types'

export interface PlatformAuthOptions {
  requiresAuth?: boolean
  allowedRoles?: string[]
  permissions?: string[]
  redirectTo?: string
}

/**
 * Enhanced authentication HOC for React components in platform mode
 * Provides role-based and permission-based access control
 */
export function withPlatformAuth<T extends Record<string, any>>(
  Component: ComponentType<T> | NextPageWithLayout<T, T>,
  options: PlatformAuthOptions = {}
) {
  if (!IS_PLATFORM) {
    // In self-hosted mode, return component as-is
    return Component
  }

  const {
    requiresAuth = true,
    allowedRoles = [],
    permissions = [],
    redirectTo = '/sign-in'
  } = options

  const AuthenticatedComponent: ComponentType<T> = (props) => {
    const router = useRouter()
    const { session, isLoading } = useAuth()
    const user = session?.user

    const hasRequiredRole = allowedRoles.length === 0 || 
      allowedRoles.some(role => AuthService.hasRole(user || null, role))
    
    const hasRequiredPermissions = permissions.length === 0 || 
      permissions.every(permission => AuthService.hasPermission(user || null, permission))

    useEffect(() => {
      if (isLoading) return

      // Check authentication requirement
      if (requiresAuth && !session) {
        const returnTo = router.asPath
        router.push(`${redirectTo}?returnTo=${encodeURIComponent(returnTo)}`)
        return
      }

      // Check role requirements
      if (session && allowedRoles.length > 0 && !hasRequiredRole) {
        toast.error('You do not have the required role to access this page')
        router.push('/organizations')
        return
      }

      // Check permission requirements
      if (session && permissions.length > 0 && !hasRequiredPermissions) {
        toast.error('You do not have the required permissions to access this page')
        router.push('/organizations')
        return
      }
    }, [session, isLoading, router, hasRequiredRole, hasRequiredPermissions])

    // Show nothing while loading or redirecting
    if (isLoading) return null
    if (requiresAuth && !session) return null
    if (session && allowedRoles.length > 0 && !hasRequiredRole) return null
    if (session && permissions.length > 0 && !hasRequiredPermissions) return null

    const InnerComponent = Component as any
    return <InnerComponent {...props} />
  }

  AuthenticatedComponent.displayName = `withPlatformAuth(${Component.displayName || Component.name})`

  // Handle NextPageWithLayout
  if (isNextPageWithLayout(Component)) {
    ;(AuthenticatedComponent as NextPageWithLayout<T, T>).getLayout = Component.getLayout
  }

  return AuthenticatedComponent
}