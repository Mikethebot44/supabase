import { useRouter } from 'next/router'
import { Lock, ArrowLeft } from 'lucide-react'

import { AuthenticationLayout } from 'components/layouts/AuthenticationLayout'
import { IS_PLATFORM } from 'lib/constants'
import { NextPageWithLayout } from 'types'
import { Button } from 'ui'

/**
 * Unauthorized access page for platform mode
 * Shown when users don't have required permissions or roles
 */
const UnauthorizedPage: NextPageWithLayout = () => {
  const router = useRouter()

  const handleGoBack = () => {
    // Try to go back in history, fallback to organizations page
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(IS_PLATFORM ? '/organizations' : '/project/default')
    }
  }

  const handleGoHome = () => {
    router.push(IS_PLATFORM ? '/organizations' : '/project/default')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning-200">
          <Lock className="h-8 w-8 text-warning-600" />
        </div>
        
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Access Denied
          </h1>
          <p className="text-sm text-foreground-light">
            You don't have permission to access this page. 
            {IS_PLATFORM && ' Please contact your organization administrator for access.'}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Button
            type="default"
            size="large"
            onClick={handleGoBack}
            icon={<ArrowLeft size={16} />}
          >
            Go Back
          </Button>
          
          <Button
            type="primary"
            size="large"
            onClick={handleGoHome}
          >
            {IS_PLATFORM ? 'Go to Organizations' : 'Go to Dashboard'}
          </Button>
        </div>

        {IS_PLATFORM && (
          <div className="text-xs text-foreground-lighter">
            If you believe this is an error, please contact support.
          </div>
        )}
      </div>
    </div>
  )
}

UnauthorizedPage.getLayout = (page) => (
  <AuthenticationLayout>
    {page}
  </AuthenticationLayout>
)

export default UnauthorizedPage