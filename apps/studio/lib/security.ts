import { NextRequest, NextResponse } from 'next/server'
import { IS_PLATFORM, CUSTOM_AUTH_ENABLED } from './constants'

/**
 * Security enhancements for platform mode
 * Includes CSRF protection, rate limiting, and secure headers
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

/**
 * In-memory rate limit store (in production, use Redis or similar)
 */
const rateLimitStore: RateLimitStore = {}

/**
 * Rate limiting configuration
 */
const RATE_LIMITS = {
  // Authentication endpoints
  '/api/auth/signin': { requests: 5, windowMs: 15 * 60 * 1000 }, // 5 requests per 15 minutes
  '/api/auth/signup': { requests: 3, windowMs: 60 * 60 * 1000 }, // 3 requests per hour
  '/api/auth/reset': { requests: 3, windowMs: 60 * 60 * 1000 }, // 3 requests per hour
  
  // API endpoints
  '/api/': { requests: 100, windowMs: 60 * 1000 }, // 100 requests per minute (general API)
  '/api/projects': { requests: 50, windowMs: 60 * 1000 }, // 50 requests per minute
  
  // Default rate limit
  default: { requests: 200, windowMs: 60 * 1000 }, // 200 requests per minute
}

/**
 * Security headers for production
 */
const SECURITY_HEADERS = {
  // HTTPS and security
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  
  // CSP (Content Security Policy)
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.hcaptcha.com https://www.googletagmanager.com https://app.usercentrics.eu https://*.usercentrics.eu",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://app.usercentrics.eu",
    "font-src 'self' https://fonts.gstatic.com https://app.usercentrics.eu",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.com wss://*.supabase.co https://app.usercentrics.eu https://api.usercentrics.eu https://*.usercentrics.eu",
    "frame-src 'self' https://js.hcaptcha.com https://app.usercentrics.eu",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; '),
  
  // Permissions Policy (formerly Feature Policy)
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'accelerometer=()',
    'gyroscope=()'
  ].join(', '),
}

/**
 * Get client identifier for rate limiting
 */
function getClientId(request: NextRequest): string {
  // In production, you might want to use a combination of IP and user ID
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIp || request.ip || 'unknown'
  
  // Include user ID if authenticated
  const userId = request.headers.get('x-user-id')
  return userId ? `${ip}:${userId}` : ip
}

/**
 * Get rate limit configuration for endpoint
 */
function getRateLimitConfig(pathname: string) {
  // Find the most specific rate limit config
  for (const [path, config] of Object.entries(RATE_LIMITS)) {
    if (path !== 'default' && pathname.startsWith(path)) {
      return config
    }
  }
  return RATE_LIMITS.default
}

/**
 * Check if request is rate limited
 */
export function checkRateLimit(request: NextRequest): boolean {
  if (!IS_PLATFORM) return false // Skip rate limiting in self-hosted mode

  const clientId = getClientId(request)
  const pathname = request.nextUrl.pathname
  const config = getRateLimitConfig(pathname)
  
  const now = Date.now()
  const key = `${clientId}:${pathname}`
  
  // Clean up expired entries
  if (rateLimitStore[key] && now > rateLimitStore[key].resetTime) {
    delete rateLimitStore[key]
  }
  
  // Initialize or update rate limit entry
  if (!rateLimitStore[key]) {
    rateLimitStore[key] = {
      count: 1,
      resetTime: now + config.windowMs,
    }
    return false
  }
  
  rateLimitStore[key].count++
  return rateLimitStore[key].count > config.requests
}

/**
 * Get rate limit headers
 */
export function getRateLimitHeaders(request: NextRequest): Record<string, string> {
  if (!IS_PLATFORM) return {}

  const clientId = getClientId(request)
  const pathname = request.nextUrl.pathname
  const config = getRateLimitConfig(pathname)
  const key = `${clientId}:${pathname}`
  
  const entry = rateLimitStore[key]
  const remaining = entry ? Math.max(0, config.requests - entry.count) : config.requests
  const resetTime = entry ? Math.ceil(entry.resetTime / 1000) : Math.ceil((Date.now() + config.windowMs) / 1000)
  
  return {
    'X-RateLimit-Limit': config.requests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetTime.toString(),
  }
}

/**
 * CSRF token generation and validation
 */
export class CSRFProtection {
  private static readonly SECRET = process.env.CSRF_SECRET || 'default-csrf-secret'
  private static readonly TOKEN_LENGTH = 32

  /**
   * Generate CSRF token
   */
  static generateToken(): string {
    if (typeof window !== 'undefined') {
      // Client-side: generate random token
      const array = new Uint8Array(this.TOKEN_LENGTH)
      crypto.getRandomValues(array)
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
    }
    
    // Server-side: generate token (you might want to use a proper crypto library)
    return Math.random().toString(36).substring(2, this.TOKEN_LENGTH + 2)
  }

  /**
   * Validate CSRF token
   */
  static validateToken(token: string, sessionToken?: string): boolean {
    if (!IS_PLATFORM) return true // Skip CSRF in self-hosted mode
    
    // Simple validation - in production, use proper HMAC validation
    return token && token.length === this.TOKEN_LENGTH
  }

  /**
   * Get CSRF token from request
   */
  static getTokenFromRequest(request: NextRequest): string | null {
    // Check header first, then body
    return request.headers.get('X-CSRF-Token') || 
           request.headers.get('x-csrf-token') ||
           null
  }
}

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  if (!IS_PLATFORM || process.env.NODE_ENV === 'development') {
    return response // Skip security headers in self-hosted mode or development
  }

  // Apply all security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

/**
 * Security middleware for API routes
 */
export function securityMiddleware(request: NextRequest): NextResponse | null {
  // Skip security middleware in self-hosted mode (when both platform and custom auth are disabled)
  // Also skip in development for easier testing
  if ((!IS_PLATFORM && !CUSTOM_AUTH_ENABLED) || process.env.NODE_ENV === 'development') {
    return null
  }

  const pathname = request.nextUrl.pathname
  
  // Check rate limiting
  if (checkRateLimit(request)) {
    const response = NextResponse.json(
      { error: 'Too many requests', message: 'Rate limit exceeded' },
      { status: 429 }
    )
    
    // Add rate limit headers
    const rateLimitHeaders = getRateLimitHeaders(request)
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return applySecurityHeaders(response)
  }

  // CSRF protection for state-changing operations
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const csrfToken = CSRFProtection.getTokenFromRequest(request)
    
    // Skip CSRF for certain endpoints (like auth callbacks)
    const skipCSRF = [
      '/api/auth/callback',
      '/api/auth/webhooks',
      '/api/webhooks',
    ].some(path => pathname.startsWith(path))
    
    if (!skipCSRF && !CSRFProtection.validateToken(csrfToken || '')) {
      const response = NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      )
      return applySecurityHeaders(response)
    }
  }

  return null // Continue processing
}

/**
 * Cookie security configuration
 */
export const SECURE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
}

/**
 * Session security helpers
 */
export class SessionSecurity {
  /**
   * Generate secure session ID
   */
  static generateSessionId(): string {
    if (typeof window !== 'undefined') {
      const array = new Uint8Array(32)
      crypto.getRandomValues(array)
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
    }
    
    // Server-side fallback
    return Math.random().toString(36).substring(2, 34)
  }

  /**
   * Validate session format
   */
  static isValidSessionId(sessionId: string): boolean {
    return /^[a-f0-9]{64}$/.test(sessionId)
  }

  /**
   * Check if session is expired
   */
  static isSessionExpired(expiresAt: number): boolean {
    return Date.now() > expiresAt
  }
}

/**
 * Input validation helpers
 */
export class InputValidation {
  /**
   * Sanitize HTML input
   */
  static sanitizeHtml(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && email.length <= 254
  }

  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  /**
   * Validate project reference format
   */
  static isValidProjectRef(ref: string): boolean {
    return /^[a-z0-9]{20}$/.test(ref)
  }

  /**
   * Validate organization slug format
   */
  static isValidOrgSlug(slug: string): boolean {
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) && slug.length >= 3 && slug.length <= 63
  }
}