import { useRouter } from 'next/router'
import { ComponentType, useEffect } from 'react'
import { toast } from 'sonner'

import { useAuth, hasRole, type User } from "lib/auth-client"
import { IS_PLATFORM } from 'lib/constants'
import { NextPageWithLayout, isNextPageWithLayout } from 'types'

export function withAuth<T>(
  WrappedComponent: ComponentType<T> | NextPageWithLayout<T, T>,
  options: {
    /**
     * Required permissions for accessing this component
     */
    permissions?: string[]
    /**
     * Required role for accessing this component
     */
    role?: string
    /**
     * Custom redirect path for unauthorized access
     */
    unauthorizedRedirect?: string
  } = {}
) {
  const WithAuthHOC: ComponentType<T> = (props) => {
    const router = useRouter()
    const { isLoading, user, session } = useAuth()

    const isLoggedIn = Boolean(user && session)
    const isFinishedLoading = !isLoading

    // Check role requirements
    const hasRequiredRole = !options.role || hasRole(user, options.role)

    // For now, we'll implement basic permission checking
    // In a real implementation, you'd want to define what permissions mean for your app
    const hasRequiredPermissions = !options.permissions || options.permissions.every(permission => {
      // Basic permission check - you can expand this based on your needs
      if (permission === 'read') return true
      if (permission === 'write') return hasRole(user, 'admin') || hasRole(user, 'owner')
      if (permission === 'admin') return hasRole(user, 'admin') || hasRole(user, 'owner')
      if (permission === 'owner') return hasRole(user, 'owner')
      return false
    })

    useEffect(() => {
      if (isFinishedLoading && !isLoggedIn) {
        const searchParams = new URLSearchParams(location.search)
        let pathname = location.pathname
        if (process.env.NEXT_PUBLIC_BASE_PATH) {
          pathname = pathname.replace(process.env.NEXT_PUBLIC_BASE_PATH, '')
        }

        searchParams.set('returnTo', pathname)
        router.push(`/sign-in?${searchParams.toString()}`)
        return
      }

      // Check role and permission access after authentication
      if (isFinishedLoading && isLoggedIn) {
        if (!hasRequiredRole) {
          toast.error('You do not have the required role to access this page')
          const redirectPath = options.unauthorizedRedirect || '/project/default'
          router.push(redirectPath)
          return
        }

        if (!hasRequiredPermissions) {
          toast.error('You do not have the required permissions to access this page')
          const redirectPath = options.unauthorizedRedirect || '/project/default'
          router.push(redirectPath)
          return
        }
      }
    }, [session, isLoading, router, isFinishedLoading, isLoggedIn, hasRequiredRole, hasRequiredPermissions])

    // Show loading state while checking authentication
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
          <p className="mt-2 text-foreground-light">Loading...</p>
        </div>
      )
    }

    // If not authenticated, don't render the component (will redirect)
    if (!isLoggedIn) {
      return null
    }

    // If missing required role/permissions, don't render the component (will redirect)
    if (!hasRequiredRole || !hasRequiredPermissions) {
      return null
    }

    const InnerComponent = WrappedComponent as any
    return <InnerComponent {...props} />
  }

  WithAuthHOC.displayName = `withAuth(${WrappedComponent.displayName})`

  if (isNextPageWithLayout(WrappedComponent)) {
    ;(WithAuthHOC as NextPageWithLayout<T, T>).getLayout = WrappedComponent.getLayout
  }

  return WithAuthHOC
}