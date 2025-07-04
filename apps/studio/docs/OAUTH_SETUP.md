# OAuth Provider Setup for Supabase Studio

This guide explains how to configure OAuth providers for the Supabase Studio authentication system when deployed in platform mode (`NEXT_PUBLIC_IS_PLATFORM=true`).

## Prerequisites

1. A Supabase project with Auth enabled
2. Environment variables configured for platform mode
3. OAuth applications set up with the providers you want to use

## Supported OAuth Providers

The following OAuth providers are configured in the system:

### GitHub OAuth
- **Enabled by default**: Yes
- **Scopes**: `read:user user:email`
- **Redirect URL**: `https://your-domain.com/auth/callback`

### Google OAuth
- **Enabled by default**: Yes
- **Scopes**: `openid email profile`
- **Redirect URL**: `https://your-domain.com/auth/callback`

### Additional Providers (Disabled by default)
- Azure AD
- Discord

## Setup Instructions

### 1. Configure OAuth Providers in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Providers**
3. Enable and configure the OAuth providers you want to use

### 2. GitHub OAuth Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App with:
   - **Application name**: Your app name
   - **Homepage URL**: `https://your-domain.com`
   - **Authorization callback URL**: `https://your-project-ref.supabase.co/auth/v1/callback`
3. Copy the Client ID and Client Secret
4. In your Supabase project, go to Authentication > Providers > GitHub:
   - Enable GitHub provider
   - Enter Client ID and Client Secret
   - Set redirect URL to: `https://your-domain.com/auth/callback`

### 3. Google OAuth Setup

1. Go to Google Cloud Console
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to Credentials > Create Credentials > OAuth 2.0 Client IDs
5. Configure with:
   - **Application type**: Web application
   - **Authorized redirect URIs**: `https://your-project-ref.supabase.co/auth/v1/callback`
6. Copy Client ID and Client Secret
7. In your Supabase project, go to Authentication > Providers > Google:
   - Enable Google provider
   - Enter Client ID and Client Secret
   - Set redirect URL to: `https://your-domain.com/auth/callback`

### 4. Configure Redirect URLs

Ensure the following redirect URLs are configured in your Supabase Auth settings:

- **Sign in**: `https://your-domain.com/auth/callback`
- **Sign out**: `https://your-domain.com/sign-in`
- **Password reset**: `https://your-domain.com/auth/reset-password`
- **Email confirmation**: `https://your-domain.com/auth/confirm`

### 5. Update Environment Variables

Make sure your `.env.production` file includes:

```env
NEXT_PUBLIC_IS_PLATFORM=true
NEXT_PUBLIC_GOTRUE_URL=https://your-project-ref.supabase.co/auth/v1
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

## Testing OAuth Flows

1. **Sign Up Flow**:
   - Visit `/sign-up`
   - Click "Continue with GitHub" or "Continue with Google"
   - Complete OAuth flow
   - User should be redirected to `/organizations`

2. **Sign In Flow**:
   - Visit `/sign-in`
   - Click OAuth provider button
   - Complete OAuth flow
   - User should be redirected to `/organizations`

3. **Email Confirmation**:
   - Sign up with email/password
   - Check email for confirmation link
   - Click link to confirm account

## Security Considerations

1. **HTTPS Required**: OAuth flows require HTTPS in production
2. **Domain Validation**: Ensure redirect URLs match exactly
3. **Scope Limitation**: Only request necessary OAuth scopes
4. **Token Storage**: Tokens are stored securely in localStorage
5. **Session Management**: Sessions are automatically refreshed

## Troubleshooting

### Common Issues

1. **OAuth redirect mismatch**:
   - Verify redirect URLs in provider settings
   - Check NEXT_PUBLIC_SITE_URL environment variable

2. **Provider not enabled**:
   - Check provider configuration in `lib/auth-config.ts`
   - Verify provider is enabled in Supabase Auth settings

3. **Email confirmation not working**:
   - Check email template settings in Supabase
   - Verify SMTP configuration

### Debug Mode

Enable auth debugging by setting localStorage:
```javascript
localStorage.setItem('supabase.dashboard.auth.debug', 'true')
```

This will log detailed authentication events to the browser console.

## Provider-Specific Notes

### GitHub
- Requires verified email address
- May require additional verification for new accounts
- Check for unverified GitHub user error handling

### Google
- Supports multiple Google accounts
- May require additional consent for first-time users
- Handles email scope automatically

## Migration from Self-Hosted

When migrating from self-hosted mode (`NEXT_PUBLIC_IS_PLATFORM=false`) to platform mode:

1. Set up OAuth providers in Supabase
2. Update environment variables
3. Test authentication flows
4. Update any custom auth logic to use AuthService
5. Verify user data migration if needed