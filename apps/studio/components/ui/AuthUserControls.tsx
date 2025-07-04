import { LogOut, Settings, User } from 'lucide-react'
import { useRouter } from 'next/router'
import { ProfileImage } from 'components/ui/ProfileImage'
import { useAuth, useSignOut } from 'lib/auth'
import { IS_PLATFORM, CUSTOM_AUTH_ENABLED } from 'lib/constants'
import { 
  Button, 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from 'ui'

export function AuthUserControls() {
  const router = useRouter()
  const signOut = useSignOut()
  const { session, user, isLoading } = useAuth()

  const isSignedIn = Boolean(session && user)

  const handleSignOut = async () => {
    try {
      await signOut()
      await router.push('/sign-in')
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  const handleAccountSettings = () => {
    if (IS_PLATFORM) {
      router.push('/account/me')
    } else if (CUSTOM_AUTH_ENABLED) {
      router.push('/account/profile')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <Button 
          type="default" 
          size="sm"
          onClick={() => router.push('/sign-in')}
        >
          Sign In
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {/* User Info Display */}
      <div className="hidden md:flex flex-col items-end">
        <span className="text-sm font-medium text-foreground">
          {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
        </span>
        <span className="text-xs text-foreground-lighter">
          {user?.email}
        </span>
      </div>

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="default"
            className="h-8 w-8 rounded-full overflow-hidden p-0"
          >
            <ProfileImage 
              src={user?.user_metadata?.avatar_url} 
              className="h-8 w-8"
            />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {user?.user_metadata?.full_name || 'User'}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          {(IS_PLATFORM || CUSTOM_AUTH_ENABLED) && (
            <DropdownMenuItem onClick={handleAccountSettings}>
              <Settings size={16} className="mr-2" />
              Account Settings
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={handleSignOut}
            className="text-red-600 focus:text-red-600 focus:bg-red-50"
          >
            <LogOut size={16} className="mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Quick Sign Out Button for Mobile */}
      <Button
        type="default"
        size="sm"
        variant="ghost"
        onClick={handleSignOut}
        className="md:hidden"
      >
        <LogOut size={16} />
      </Button>
    </div>
  )
}