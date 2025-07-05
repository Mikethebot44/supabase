import { User } from 'lucide-react'
import { useAuth } from "lib/auth-client"
import { IS_PLATFORM } from 'lib/constants'
import { Badge, cn } from 'ui'

interface AuthStatusBadgeProps {
  className?: string
  showDetails?: boolean
}

export function AuthStatusBadge({ className, showDetails = true }: AuthStatusBadgeProps) {
  const { session, user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
        <span className="text-xs text-foreground-lighter">Loading...</span>
      </div>
    )
  }

  // Determine auth mode
  let authMode = 'Self-hosted'
  if (IS_PLATFORM) {
    authMode = 'Platform'
  } else if (!IS_PLATFORM) {
    authMode = 'Custom Auth'
  }

  const isSignedIn = Boolean(session && user)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Status Indicator */}
      <div className="flex items-center gap-1.5">
        <div 
          className={cn(
            'h-2 w-2 rounded-full',
            isSignedIn ? 'bg-green-500' : 'bg-red-500'
          )} 
        />
        <Badge 
          variant={isSignedIn ? 'default' : 'destructive'}
          className="text-xs"
        >
          {isSignedIn ? 'Signed In' : 'Not Signed In'}
        </Badge>
      </div>

      {/* User Details */}
      {showDetails && isSignedIn && user && (
        <div className="flex items-center gap-2">
          <User size={14} className="text-foreground-lighter" />
          <span className="text-sm text-foreground-light truncate max-w-[200px]">
            {user.email || 'Unknown User'}
          </span>
        </div>
      )}

      {/* Auth Mode Badge */}
      <Badge variant="outline" className="text-xs">
        {authMode}
      </Badge>
    </div>
  )
}