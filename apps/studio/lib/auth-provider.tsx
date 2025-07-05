import { useQueryClient } from '@tanstack/react-query'
import { PropsWithChildren, createContext, useContext } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/router'

import { IS_PLATFORM } from './constants'
import { useAuth as useBetterAuth, authClient, type Session, type User } from './auth-client'

// Auth context for Better Auth
interface AuthContextType {
  session: Session | null
  user: User | null
  isLoading: boolean
  error: Error | null
  signOut: () => Promise<void>
  refetch: () => void
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isLoading: true,
  error: null,
  signOut: async () => {},
  refetch: () => {},
})

export const AuthProvider = ({ children }: PropsWithChildren<{}>) => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { session, user, isLoading, error, refetch } = useBetterAuth()

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
      
      // Clear React Query cache
      queryClient.clear()
      
      // Clear any local storage items
      localStorage.removeItem('sb-auth-token')
      
      // Show success message
      toast.success('Signed out successfully')
      
      // Redirect to sign in page
      if (router.pathname !== '/sign-in') {
        router.push('/sign-in')
      }
    } catch (error) {
      console.error('Error signing out:', error)
      toast.error('Error signing out')
    }
  }

  const value: AuthContextType = {
    session,
    user,
    isLoading,
    error,
    signOut: handleSignOut,
    refetch,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Export hooks for compatibility with existing code
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const useSession = () => {
  const { session } = useAuth()
  return session
}

export const useUser = () => {
  const { user } = useAuth()
  return user
}

export const useIsLoggedIn = () => {
  const { user } = useAuth()
  return !!user
}

export const useSignOut = () => {
  const { signOut } = useAuth()
  return { signOut }
}

// Export types for compatibility
export type { Session, User }

// Constants for compatibility
export const GOTRUE_ERRORS = {
  SIGNUP_DISABLED: 'Signups not allowed for this instance',
  INVALID_CREDENTIALS: 'Invalid login credentials',
  EMAIL_NOT_CONFIRMED: 'Email not confirmed',
  TOO_MANY_REQUESTS: 'Too many requests',
}

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid credentials',
  SIGNUP_DISABLED: 'Signups are disabled',
  EMAIL_NOT_CONFIRMED: 'Please confirm your email address',
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later.',
}

// Utility functions for compatibility
export const clearLocalStorage = () => {
  localStorage.removeItem('sb-auth-token')
  localStorage.removeItem('supabase.auth.token')
}

// Role-based utilities (moved from auth-client for compatibility)
export const hasRole = (user: User | null, role: string): boolean => {
  if (!user) return false
  return user.role === role || user.role === 'admin' || user.role === 'owner'
}

export const isAdmin = (user: User | null): boolean => {
  return hasRole(user, 'admin')
}

export const isOwner = (user: User | null): boolean => {
  return hasRole(user, 'owner')
}

export const isMember = (user: User | null): boolean => {
  return hasRole(user, 'member')
}

// For legacy compatibility with platform auth
export const gotrueClient = {
  signOut: () => authClient.signOut(),
  signInWithPassword: (credentials: { email: string; password: string }) => 
    authClient.signIn.email(credentials),
  signUp: (credentials: { email: string; password: string }) => 
    authClient.signUp.email(credentials),
}

// Default export for platform compatibility
export default AuthProvider