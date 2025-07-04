import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useAuth } from 'lib/auth'
import { AuthService } from 'lib/auth-service'
import { IS_PLATFORM, CUSTOM_AUTH_ENABLED } from 'lib/constants'
import { NextPageWithLayout } from 'types'
import { Spinner } from 'ui'

/**
 * OAuth callback handler for platform mode
 * Handles the OAuth redirect after successful authentication
 */
const AuthCallbackPage: NextPageWithLayout = () => {
  const router = useRouter()
  const { session, isLoading } = useAuth()
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Determine redirect behavior based on auth mode
        if (!IS_PLATFORM && !CUSTOM_AUTH_ENABLED) {
          // Pure self-hosted mode - redirect to default project
          router.push('/project/default')
          return
        }

        // Check if we have a session (Platform or Custom Auth mode)
        if (!isLoading && session) {
          // Successfully authenticated
          const returnTo = router.query.returnTo as string
          
          // Determine appropriate default redirect based on mode
          let defaultRedirect = '/organizations' // Platform mode default
          if (CUSTOM_AUTH_ENABLED && !IS_PLATFORM) {
            defaultRedirect = '/project/default' // Custom auth mode - go to project
          }
          
          const redirectPath = returnTo && returnTo !== '/sign-in' && !returnTo.startsWith('/sign-in?') ? returnTo : defaultRedirect
          
          toast.success('Successfully signed in!')
          router.push(redirectPath)
        } else if (!isLoading && !session) {
          // No session found, redirect to sign-in
          toast.error('Authentication failed. Please try again.')
          router.push('/sign-in')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        toast.error('An error occurred during authentication.')
        router.push('/sign-in')
      } finally {
        setIsProcessing(false)
      }
    }

    // Wait a moment for the auth state to settle
    const timeout = setTimeout(handleAuthCallback, 1000)
    return () => clearTimeout(timeout)
  }, [router, session, isLoading])

  if (isProcessing || isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="large" />
          <p className="text-sm text-foreground-light">Completing authentication...</p>
        </div>
      </div>
    )
  }

  return null
}

export default AuthCallbackPage