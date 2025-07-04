import { useQueryClient } from '@tanstack/react-query'
import { AuthProvider as AuthProviderInternal, clearLocalStorage, gotrueClient } from 'common'
import { PropsWithChildren, useCallback, useEffect, createContext, useContext, useState } from 'react'
import { toast } from 'sonner'
import type { Session, User } from '@supabase/supabase-js'

import { GOTRUE_ERRORS, IS_PLATFORM, CUSTOM_AUTH_ENABLED } from './constants'
import { AUTH_ERRORS } from './auth-config'
import { customAuthService } from './custom-auth-service'

// Custom Auth Context for custom auth mode
interface CustomAuthState {
  session: Session | null
  user: User | null
  isLoading: boolean
}

const CustomAuthContext = createContext<CustomAuthState>({
  session: null,
  user: null,
  isLoading: true
})

const CustomAuthProvider = ({ children }: PropsWithChildren<{}>) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!customAuthService) {
      setIsLoading(false)
      return
    }

    // Get initial session
    customAuthService.getSession().then(({ data: { session }, error }) => {
      if (!error && session) {
        setSession(session)
        setUser(session.user)
      }
      setIsLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = customAuthService.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <CustomAuthContext.Provider value={{ session, user, isLoading }}>
      {children}
    </CustomAuthContext.Provider>
  )
}

export const AuthProvider = ({ children }: PropsWithChildren<{}>) => {
  // Check for unverified GitHub users after a GitHub sign in
  useEffect(() => {
    async function handleEmailVerificationError() {
      const { error } = await gotrueClient.initialize()

      if (error?.message === GOTRUE_ERRORS.UNVERIFIED_GITHUB_USER) {
        toast.error(
          'Please verify your email on GitHub first, then reach out to us at support@supabase.io to log into the dashboard'
        )
      }
    }

    handleEmailVerificationError()
  }, [])

  // Determine authentication mode:
  // - Platform mode: IS_PLATFORM=true (requires platform access)
  // - Custom auth mode: CUSTOM_AUTH_ENABLED=true (uses your Supabase project) 
  // - Self-hosted mode: both false (bypasses auth entirely)
  // Use explicit boolean conversion to ensure consistency between server and client
  const shouldEnableAuth = Boolean(IS_PLATFORM) || Boolean(CUSTOM_AUTH_ENABLED)
  
  // Use custom auth provider for custom auth mode to avoid session storage issues
  if (CUSTOM_AUTH_ENABLED && !IS_PLATFORM) {
    return <CustomAuthProvider>{children}</CustomAuthProvider>
  }
  
  return <AuthProviderInternal alwaysLoggedIn={!shouldEnableAuth}>{children}</AuthProviderInternal>
}

// Custom hooks for custom auth mode
const useCustomAuth = () => {
  const context = useContext(CustomAuthContext)
  if (context === undefined) {
    throw new Error('useCustomAuth must be used within a CustomAuthProvider')
  }
  return context
}

// Export unified auth hooks that work for both modes
export const useAuth = () => {
  if (CUSTOM_AUTH_ENABLED && !IS_PLATFORM) {
    return useCustomAuth()
  }
  // Use common package hooks for platform/self-hosted mode
  const { useAuth: useCommonAuth } = require('common')
  return useCommonAuth()
}

// Force session synchronization for custom auth mode
export const syncAuthSession = async () => {
  if (CUSTOM_AUTH_ENABLED && !IS_PLATFORM) {
    try {
      // Get session from custom auth service
      const { data: { session } } = await customAuthService.client.auth.getSession()
      return session
    } catch (error) {
      console.error('Failed to sync auth session:', error)
      return null
    }
  }
  return null
}

export const useSession = () => {
  if (CUSTOM_AUTH_ENABLED && !IS_PLATFORM) {
    return useCustomAuth().session
  }
  const { useSession: useCommonSession } = require('common')
  return useCommonSession()
}

export const useUser = () => {
  if (CUSTOM_AUTH_ENABLED && !IS_PLATFORM) {
    return useCustomAuth().user
  }
  const { useUser: useCommonUser } = require('common')
  return useCommonUser()
}

export const useIsLoggedIn = () => {
  if (CUSTOM_AUTH_ENABLED && !IS_PLATFORM) {
    const { session, isLoading } = useCustomAuth()
    return !isLoading && session !== null
  }
  const { useIsLoggedIn: useCommonIsLoggedIn } = require('common')
  return useCommonIsLoggedIn()
}

export function useSignOut() {
  const queryClient = useQueryClient()

  return useCallback(async () => {
    let result
    
    if (CUSTOM_AUTH_ENABLED && !IS_PLATFORM && customAuthService) {
      // Use custom auth service for sign out
      result = await customAuthService.signOut()
    } else {
      // Use common package for platform/self-hosted mode
      result = await gotrueClient.signOut()
    }
    
    clearLocalStorage()
    await queryClient.clear()

    return result
  }, [queryClient])
}
