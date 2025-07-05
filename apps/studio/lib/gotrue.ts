import { getAccessToken as getCommonAccessToken, type User } from 'common/auth'
import { gotrueClient } from 'common/gotrue'
import { IS_PLATFORM } from './constants'
import { authClient } from './auth-client'

export const auth = gotrueClient

// Enhanced getAccessToken that works with Better Auth
export async function getAccessToken() {
  // Use Better Auth for non-platform mode
  if (!IS_PLATFORM) {
    try {
      const session = await authClient.getSession()
      if (!session?.data) {
        console.log('No session found in Better Auth')
        return undefined
      }
      return session.data.token
    } catch (error) {
      console.error('Error getting access token from Better Auth:', error)
      return undefined
    }
  }

  // Use common auth for platform mode
  return getCommonAccessToken()
}

// Enhanced getUser that works with Better Auth
export async function getUser(): Promise<User | null> {
  if (!IS_PLATFORM) {
    try {
      const session = await authClient.getSession()
      return session?.data?.user || null
    } catch (error) {
      console.error('Error getting user from Better Auth:', error)
      return null
    }
  }

  // For platform mode, use the existing implementation
  try {
    const { data: { user } } = await auth.getUser()
    return user
  } catch (error) {
    console.error('Error getting user from GoTrue:', error)
    return null
  }
}

// Compatibility exports
export { gotrueClient }

// URL handling constants and functions that were removed during Better Auth migration
export const DEFAULT_FALLBACK_PATH = '/organizations'

/**
 * Validates a return path to prevent open redirects and XSS
 */
function validateReturnTo(returnTo: string): boolean {
  try {
    // Must start with / (relative path)
    if (!returnTo.startsWith('/')) return false
    
    // Prevent javascript: and data: URLs
    if (returnTo.toLowerCase().includes('javascript:') || returnTo.toLowerCase().includes('data:')) {
      return false
    }
    
    // Prevent protocol-relative URLs
    if (returnTo.startsWith('//')) return false
    
    // Additional validation - decode and check again
    const decoded = decodeURIComponent(returnTo)
    if (decoded.toLowerCase().includes('javascript:') || decoded.toLowerCase().includes('data:')) {
      return false
    }
    
    return true
  } catch {
    return false
  }
}

/**
 * Gets the return path from URL search params with validation
 */
export function getReturnToPath(fallback: string = DEFAULT_FALLBACK_PATH): string {
  if (typeof window === 'undefined') return fallback
  
  try {
    const urlSearchParams = new URLSearchParams(window.location.search)
    const returnTo = urlSearchParams.get('returnTo')
    
    if (!returnTo) return fallback
    
    // Validate the return path
    if (!validateReturnTo(returnTo)) return fallback
    
    return returnTo
  } catch {
    return fallback
  }
}

/**
 * Builds a path with current search parameters, with new params taking precedence
 */
export function buildPathWithParams(pathname: string): string {
  if (typeof window === 'undefined') return pathname
  
  try {
    const currentSearchParams = new URLSearchParams(window.location.search)
    const [newPath, newSearchString] = pathname.split('?', 2)
    const newSearchParams = new URLSearchParams(newSearchString || '')
    
    // Merge params with new params taking precedence
    const mergedParams = new URLSearchParams()
    
    // Add current params first
    currentSearchParams.forEach((value, key) => {
      mergedParams.set(key, value)
    })
    
    // Override with new params
    newSearchParams.forEach((value, key) => {
      mergedParams.set(key, value)
    })
    
    const finalSearchString = mergedParams.toString()
    return finalSearchString ? `${newPath}?${finalSearchString}` : newPath
  } catch {
    return pathname
  }
}