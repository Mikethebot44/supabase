import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AuthService } from 'lib/auth-service'
import { IS_PLATFORM, CUSTOM_AUTH_ENABLED } from 'lib/constants'
import { NextPageWithLayout } from 'types'
import { Spinner } from 'ui'

/**
 * Email confirmation handler for platform mode
 * Handles email confirmation links sent to users
 */
const AuthConfirmPage: NextPageWithLayout = () => {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        if (!IS_PLATFORM && !CUSTOM_AUTH_ENABLED) {
          // In self-hosted mode, redirect to default project
          router.push('/project/default')
          return
        }

        // Extract token and type from URL hash (typical for Supabase Auth)
        const { access_token, refresh_token, error, error_description } = router.query

        if (error) {
          toast.error(error_description || 'Email confirmation failed')
          router.push('/sign-in')
          return
        }

        if (access_token && refresh_token) {
          // Session should be automatically set by auth client
          toast.success('Email confirmed successfully!')
          
          // Determine appropriate redirect based on mode
          const redirectPath = IS_PLATFORM ? '/organizations' : '/project/default'
          router.push(redirectPath)
        } else {
          // No tokens found, might be an invalid or expired link
          toast.error('Invalid or expired confirmation link')
          router.push('/sign-in')
        }
      } catch (error) {
        console.error('Email confirmation error:', error)
        toast.error('An error occurred during email confirmation.')
        router.push('/sign-in')
      } finally {
        setIsProcessing(false)
      }
    }

    // Process the confirmation after router is ready
    if (router.isReady) {
      handleEmailConfirmation()
    }
  }, [router])

  if (isProcessing) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="large" />
          <p className="text-sm text-foreground-light">Confirming your email...</p>
        </div>
      </div>
    )
  }

  return null
}

export default AuthConfirmPage