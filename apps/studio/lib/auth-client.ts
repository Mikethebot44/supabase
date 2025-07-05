import { createAuthClient } from "better-auth/react"
import type { Session, User } from "./auth"

export const authClient = createAuthClient({
  baseURL: "http://localhost:8082",
})

export const {
  signIn,
  signOut,
  signUp,
  useSession
} = authClient

export type { Session, User }

// Re-export AuthProvider from auth-provider
export { AuthProvider } from './auth-provider'

// Simplified hooks
export const useAuth = () => {
  const session = useSession()
  
  return {
    session: session.data,
    user: session.data?.user,
    isLoading: session.isPending,
    error: session.error,
  }
}

export const useUser = () => {
  const session = useSession()
  return session.data?.user || null
}

export const useSignOut = () => {
  return {
    signOut: async () => {
      await signOut()
    },
  }
}

// Role-based utilities for compatibility
export const hasRole = (user: User | null, role: string): boolean => {
  if (!user) return false
  // Simple role check - you can customize this logic
  return true // For now, allow all authenticated users
}

export const isAdmin = (user: User | null): boolean => {
  return hasRole(user, "admin")
}

export const isOwner = (user: User | null): boolean => {
  return hasRole(user, "owner")
}

export const isMember = (user: User | null): boolean => {
  return hasRole(user, "member")
}