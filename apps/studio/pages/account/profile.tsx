import { useState } from 'react'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'

import { useAuth } from "lib/auth-client"
import { customAuthService } from 'lib/custom-auth-service'
import { IS_PLATFORM, CUSTOM_AUTH_ENABLED } from 'lib/constants'
import DefaultLayout from 'components/layouts/DefaultLayout'
import { 
  Button, 
  Form, 
  Input, 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator
} from 'ui'
import type { NextPageWithLayout } from 'types'

const ProfilePage: NextPageWithLayout = () => {
  const router = useRouter()
  const { user, session } = useAuth()
  const { theme, setTheme } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)

  // Redirect if not in custom auth mode
  if (!CUSTOM_AUTH_ENABLED || IS_PLATFORM) {
    router.replace('/account/me')
    return null
  }

  if (!session || !user) {
    router.replace('/sign-in')
    return null
  }

  const handleUpdateProfile = async (values: { 
    email: string
    full_name: string 
  }) => {
    setIsLoading(true)
    try {
      const { error } = await customAuthService.updateProfile({
        email: values.email,
        data: { full_name: values.full_name }
      })

      if (error) throw error

      toast.success('Profile updated successfully!')
    } catch (error: any) {
      toast.error(`Failed to update profile: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async (values: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }) => {
    if (values.newPassword !== values.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    setIsPasswordLoading(true)
    try {
      const { error } = await customAuthService.updatePassword(values.newPassword)

      if (error) throw error

      toast.success('Password updated successfully!')
    } catch (error: any) {
      toast.error(`Failed to update password: ${error.message}`)
    } finally {
      setIsPasswordLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Account Profile</h1>
        <p className="text-sm text-foreground-light">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your personal information and email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form
            id="profile-form"
            onSubmit={handleUpdateProfile}
            initialValues={{
              email: user.email || '',
              full_name: user.user_metadata?.full_name || ''
            }}
          >
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  placeholder="Enter your full name"
                  disabled={isLoading}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={isLoading}
                >
                  Update Profile
                </Button>
              </div>
            </div>
          </Form>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your account password for security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form
            id="password-form"
            onSubmit={handleChangePassword}
            initialValues={{
              currentPassword: '',
              newPassword: '',
              confirmPassword: ''
            }}
          >
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  disabled={isPasswordLoading}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  disabled={isPasswordLoading}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={isPasswordLoading}
                >
                  Change Password
                </Button>
              </div>
            </div>
          </Form>
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Customize your application experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="theme">Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger>
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            View your account details and authentication status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground-light">User ID:</span>
              <span className="font-mono text-xs">{user.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-light">Email Verified:</span>
              <span>{user.email_confirmed_at ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-light">Account Created:</span>
              <span>{new Date(user.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-light">Last Sign In:</span>
              <span>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Unknown'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

ProfilePage.getLayout = (page) => (
  <DefaultLayout title="Profile Settings">
    <div className="mx-auto max-w-4xl px-5 py-6 lg:px-16 lg:py-16 xl:px-24">
      {page}
    </div>
  </DefaultLayout>
)

export default ProfilePage