import { useRouter } from 'next/router'
import { ComponentType, useEffect } from 'react'
import { toast } from 'sonner'

import { usePermissionsQuery } from 'data/permissions/permissions-query'
import { useAuthenticatorAssuranceLevelQuery } from 'data/profile/mfa-authenticator-assurance-level-query'
import { useAuth } from 'lib/auth'
import { AuthService, PERMISSIONS } from 'lib/auth-service'
import { IS_PLATFORM, CUSTOM_AUTH_ENABLED } from 'lib/constants'
import { customAuthService } from 'lib/custom-auth-service'
import { NextPageWithLayout, isNextPageWithLayout } from 'types'

export function withAuth<T>(
  WrappedComponent: ComponentType<T> | NextPageWithLayout<T, T>,
  options: {
    /**
     * The auth level used to check the user credentials. In most cases, if the user has MFA enabled
     * we want the highest level (which is 2) for all pages. For certain pages, the user should be
     * able to access them even if he didn't finished his login (typed in his MFA code), for example
     * the support page: We want the user to be able to submit a ticket even if he's not fully
     * signed in.
     * @default true
     */
    useHighestAAL: boolean
    /**
     * Required permissions for accessing this component (platform mode only)
     */
    permissions?: string[]
    /**
     * Required role for accessing this component (platform mode only)
     */
    role?: string
    /**
     * Custom redirect path for unauthorized access
     */
    unauthorizedRedirect?: string
  } = { useHighestAAL: true }
) {
  // ignore auth in self-hosted mode (when both platform and custom auth are disabled)
  if (!IS_PLATFORM && !CUSTOM_AUTH_ENABLED) {
    return WrappedComponent
  }

  const WithAuthHOC: ComponentType<T> = (props) => {
    const router = useRouter()
    const { isLoading, session } = useAuth()
    const { isLoading: isAALLoading, data: aalData } = useAuthenticatorAssuranceLevelQuery({
      onError(error) {
        toast.error(
          `Failed to fetch authenticator assurance level: ${error.message}. Try refreshing your browser, or reach out to us via a support ticket if the issue persists`
        )
      },
    })

    usePermissionsQuery({
      onError(error: any) {
        toast.error(
          `Failed to fetch permissions: ${error.message}. Try refreshing your browser, or reach out to us via a support ticket if the issue persists`
        )
      },
    })

    const isLoggedIn = Boolean(session)
    const isFinishedLoading = !isLoading && !isAALLoading
    const user = session?.user

    // Check role and permission requirements
    const hasRequiredRole = !options.role || (
      IS_PLATFORM 
        ? AuthService.hasRole(user || null, options.role)
        : customAuthService?.getUserRole(user || null) === options.role
    )
    const hasRequiredPermissions = !options.permissions || (
      IS_PLATFORM
        ? options.permissions.every(permission => AuthService.hasPermission(user || null, permission))
        : options.permissions.every(permission => customAuthService?.hasPermission(user || null, permission) ?? false)
    )

    useEffect(() => {
      const isCorrectLevel = options.useHighestAAL
        ? (IS_PLATFORM ? aalData?.currentLevel === aalData?.nextLevel : true)
        : true

      if (isFinishedLoading && (!isLoggedIn || !isCorrectLevel)) {
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
      if (isFinishedLoading && isLoggedIn && isCorrectLevel) {
        if (!hasRequiredRole) {
          toast.error('You do not have the required role to access this page')
          const redirectPath = options.unauthorizedRedirect || '/organizations'
          router.push(redirectPath)
          return
        }

        if (!hasRequiredPermissions) {
          toast.error('You do not have the required permissions to access this page')
          const redirectPath = options.unauthorizedRedirect || '/organizations'
          router.push(redirectPath)
          return
        }
      }
    }, [session, isLoading, router, aalData, isFinishedLoading, isLoggedIn, hasRequiredRole, hasRequiredPermissions])

    const InnerComponent = WrappedComponent as any

    return <InnerComponent {...props} />
  }

  WithAuthHOC.displayName = `withAuth(${WrappedComponent.displayName})`

  if (isNextPageWithLayout(WrappedComponent)) {
    ;(WithAuthHOC as NextPageWithLayout<T, T>).getLayout = WrappedComponent.getLayout
  }

  return WithAuthHOC
}
