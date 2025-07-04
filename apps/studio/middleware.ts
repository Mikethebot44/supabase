import { IS_PLATFORM } from 'lib/constants'
import { authMiddleware } from 'lib/auth-middleware'
import { securityMiddleware, applySecurityHeaders } from 'lib/security'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  matcher: [
    '/api/:function*',
    '/((?!_next/static|_next/image|favicon.ico|img/).*)',
  ],
}

// [Joshen] Return 404 for all next.js API endpoints EXCEPT the ones we use in hosted:
const HOSTED_SUPPORTED_API_URLS = [
  '/ai/sql/generate-v3',
  '/ai/edge-function/complete',
  '/ai/onboarding/design',
  '/ai/sql/complete',
  '/ai/sql/title',
  '/ai/sql/cron',
  '/ai/feedback/classify',
  '/get-ip-address',
  '/get-utc-time',
  '/edge-functions/test',
  '/edge-functions/body',
]

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Apply security middleware first (rate limiting, CSRF, etc.)
  const securityResponse = securityMiddleware(request)
  if (securityResponse) {
    return securityResponse
  }

  // Handle API endpoints
  if (pathname.startsWith('/api/')) {
    // In platform mode, restrict to supported endpoints
    if (IS_PLATFORM && !HOSTED_SUPPORTED_API_URLS.some((url) => request.url.endsWith(url))) {
      const response = NextResponse.json(
        { success: false, message: 'Endpoint not supported on hosted' },
        { status: 404 }
      )
      return applySecurityHeaders(response)
    }
    
    const response = NextResponse.next()
    return applySecurityHeaders(response)
  }

  // Handle authentication middleware for non-API routes
  const authResponse = await authMiddleware(request)
  return applySecurityHeaders(authResponse)
}
