import SignInWithGitHub from 'components/interfaces/SignIn/SignInWithGitHub'
import SignUpForm from 'components/interfaces/SignIn/SignUpForm'
import SignInLayout from 'components/layouts/SignInLayout/SignInLayout'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { IS_PLATFORM, CUSTOM_AUTH_ENABLED } from 'lib/constants'
import type { NextPageWithLayout } from 'types'

const SignUpPage: NextPageWithLayout = () => {
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return

    // Redirect logic based on mode:
    // - Self-hosted (no auth): redirect to default project
    // - Platform/Custom auth: show sign-up form
    if (!IS_PLATFORM && !CUSTOM_AUTH_ENABLED) {
      // on selfhosted instance just redirect to projects page
      router.replace('/project/default')
    }
  }, [router, isMounted])

  // Show loading during SSR and initial client render to prevent hydration mismatch
  if (!isMounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    )
  }
  return (
    <>
      <div className="flex flex-col gap-5">
        <SignInWithGitHub />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-strong" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-studio px-2 text-sm text-foreground">or</span>
          </div>
        </div>

        <SignUpForm />
      </div>

      <div className="my-8 self-center text-sm">
        <span className="text-foreground-light">Have an account?</span>{' '}
        <Link
          href="/sign-in"
          className="underline text-foreground hover:text-foreground-light transition"
        >
          Sign In Now
        </Link>
      </div>
    </>
  )
}

SignUpPage.getLayout = (page) => (
  <SignInLayout heading="Get started" subheading="Create a new account">
    {page}
  </SignInLayout>
)

export default SignUpPage
