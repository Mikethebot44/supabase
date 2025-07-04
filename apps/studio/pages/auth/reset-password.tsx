import { useRouter } from 'next/router'
import { useState } from 'react'
import { toast } from 'sonner'
import { object, string } from 'yup'

import { AuthenticationLayout } from 'components/layouts/AuthenticationLayout'
import SignInLayout from 'components/layouts/SignInLayout/SignInLayout'
import { AuthService } from 'lib/auth-service'
import { IS_PLATFORM } from 'lib/constants'
import { NextPageWithLayout } from 'types'
import { Button, Form, Input } from 'ui'

const resetPasswordSchema = object({
  password: string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
  confirmPassword: string()
    .oneOf([string().ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
})

/**
 * Password reset page for platform mode
 * Allows users to set a new password after clicking the reset link
 */
const ResetPasswordPage: NextPageWithLayout = () => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const onResetPassword = async ({ password }: { password: string; confirmPassword: string }) => {
    if (!IS_PLATFORM) {
      toast.error('Password reset is not available in self-hosted mode')
      return
    }

    setIsLoading(true)
    const toastId = toast.loading('Updating password...')

    try {
      const { error } = await AuthService.updatePassword(password)

      if (!error) {
        toast.success('Password updated successfully!', { id: toastId })
        router.push('/organizations')
      }
    } catch (error) {
      console.error('Password reset error:', error)
      toast.error('Failed to update password. Please try again.', { id: toastId })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl lg:text-3xl">Reset Your Password</h1>
        <p className="text-sm text-foreground-light">
          Enter your new password below
        </p>
      </div>

      <Form
        validateOnBlur
        id="reset-password-form"
        initialValues={{ password: '', confirmPassword: '' }}
        validationSchema={resetPasswordSchema}
        onSubmit={onResetPassword}
      >
        {({ isSubmitting }: { isSubmitting: boolean }) => (
          <div className="flex flex-col gap-4">
            <Input
              id="password"
              name="password"
              type="password"
              label="New Password"
              placeholder="Enter your new password"
              disabled={isSubmitting || isLoading}
              autoComplete="new-password"
            />

            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm Password"
              placeholder="Confirm your new password"
              disabled={isSubmitting || isLoading}
              autoComplete="new-password"
            />

            <Button
              block
              form="reset-password-form"
              htmlType="submit"
              size="large"
              disabled={isSubmitting || isLoading}
              loading={isSubmitting || isLoading}
            >
              Update Password
            </Button>
          </div>
        )}
      </Form>

      <div className="self-center text-sm">
        <span className="text-foreground-light">Remember your password?</span>{' '}
        <Button type="link" onClick={() => router.push('/sign-in')}>
          Sign In
        </Button>
      </div>
    </div>
  )
}

ResetPasswordPage.getLayout = (page) => (
  <AuthenticationLayout>
    <SignInLayout
      heading="Reset Password"
      subheading="Set your new password"
      logoLinkToMarketingSite={true}
    >
      {page}
    </SignInLayout>
  </AuthenticationLayout>
)

export default ResetPasswordPage