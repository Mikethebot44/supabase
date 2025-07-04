# Supabase Studio - Cloud Deployment Guide

This guide walks you through deploying Supabase Studio with proper user authentication on Supabase Cloud or other cloud platforms.

## Prerequisites

- A Supabase project
- A cloud hosting platform (Vercel, Netlify, or similar)
- Domain name (for production OAuth)
- Basic understanding of Supabase Auth

## Step 1: Environment Configuration

### 1.1 Copy Environment Template

```bash
cp .env.production.sample .env.production
```

### 1.2 Configure Core Variables

```env
# Enable platform mode for cloud deployment
NEXT_PUBLIC_IS_PLATFORM=true

# Your domain
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Supabase Project Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-key-here

# Auth Configuration
NEXT_PUBLIC_GOTRUE_URL=https://your-project-ref.supabase.co/auth/v1

# Platform API (for Supabase Cloud integration)
NEXT_PUBLIC_API_URL=https://api.supabase.com
PLATFORM_PG_META_URL=https://api.supabase.com/pg-meta
```

## Step 2: Supabase Project Setup

### 2.1 Enable Authentication

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Settings**
3. Configure the following:

#### Site URL
```
https://your-domain.com
```

#### Redirect URLs
Add these URLs to your allowed redirect URLs:
```
https://your-domain.com/auth/callback
https://your-domain.com/auth/confirm
https://your-domain.com/auth/reset-password
```

### 2.2 Configure OAuth Providers

#### GitHub OAuth
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create new OAuth App:
   - **Homepage URL**: `https://your-domain.com`
   - **Authorization callback URL**: `https://your-project-ref.supabase.co/auth/v1/callback`
3. In Supabase Dashboard > Authentication > Providers > GitHub:
   - Enable GitHub provider
   - Add Client ID and Client Secret
   - Set redirect URL: `https://your-domain.com/auth/callback`

#### Google OAuth
1. Go to Google Cloud Console
2. Enable Google+ API
3. Create OAuth 2.0 Client ID:
   - **Authorized redirect URIs**: `https://your-project-ref.supabase.co/auth/v1/callback`
4. In Supabase Dashboard > Authentication > Providers > Google:
   - Enable Google provider
   - Add Client ID and Client Secret

### 2.3 Configure Email Templates

1. Go to Authentication > Templates
2. Customize email templates as needed
3. Ensure email links point to your domain

## Step 3: Database Setup

### 3.1 User Management Schema

Run this SQL in your Supabase SQL Editor to set up user management:

```sql
-- Create user profiles table
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create organizations table
CREATE TABLE organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subscription_tier TEXT DEFAULT 'free',
  billing_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create organization memberships
CREATE TABLE organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT DEFAULT 'active',
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  UNIQUE(user_id, organization_id)
);

-- Create projects table (if using custom project management)
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ref TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  status TEXT DEFAULT 'active',
  region TEXT DEFAULT 'us-east-1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- User can read/update their own profile
CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Organization policies
CREATE POLICY "Members can read organization" ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members 
      WHERE organization_id = organizations.id 
      AND user_id = auth.uid() 
      AND status = 'active'
    )
  );

-- Project policies
CREATE POLICY "Members can read organization projects" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members 
      WHERE organization_id = projects.organization_id 
      AND user_id = auth.uid() 
      AND status = 'active'
    )
  );
```

### 3.2 Set Up User Triggers

```sql
-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();
```

## Step 4: Security Configuration

### 4.1 Environment Security Variables

Add these to your `.env.production`:

```env
# Security
CSRF_SECRET=your-random-csrf-secret-here
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=your-hcaptcha-site-key

# Rate limiting (optional - Redis URL for production)
REDIS_URL=redis://your-redis-instance

# Error tracking
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-auth-token
```

### 4.2 Content Security Policy

The application includes a strict CSP. If you need to add additional domains, update the CSP in `lib/security.ts`:

```typescript
'Content-Security-Policy': [
  "default-src 'self'",
  "connect-src 'self' https://your-additional-domain.com",
  // ... other directives
].join('; ')
```

## Step 5: Platform Deployment

### 5.1 Vercel Deployment

1. Connect your repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Set build command: `npm run build`
4. Deploy

### 5.2 Netlify Deployment

1. Connect repository to Netlify
2. Configure environment variables
3. Set build command: `npm run build && npm run export`
4. Deploy

### 5.3 Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

## Step 6: Post-Deployment Configuration

### 6.1 Create Initial Organization

1. Sign up through your deployed application
2. Use the Supabase SQL Editor to create an initial organization:

```sql
-- Create organization
INSERT INTO organizations (slug, name, subscription_tier)
VALUES ('your-org-slug', 'Your Organization', 'pro');

-- Add yourself as owner
INSERT INTO organization_members (user_id, organization_id, role, status, joined_at)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'your-email@example.com'),
  (SELECT id FROM organizations WHERE slug = 'your-org-slug'),
  'owner',
  'active',
  NOW()
);
```

### 6.2 Test Authentication Flows

1. **Email/Password Sign Up**:
   - Visit `/sign-up`
   - Create account
   - Check email for confirmation

2. **OAuth Sign In**:
   - Visit `/sign-in`
   - Test GitHub/Google OAuth
   - Verify redirect to organizations page

3. **Password Reset**:
   - Visit `/forgot-password`
   - Test reset flow

### 6.3 Verify Security Features

1. **Rate Limiting**: Make rapid requests to test limits
2. **CSRF Protection**: Verify forms include CSRF tokens
3. **Security Headers**: Check headers in browser dev tools

## Step 7: Monitoring and Maintenance

### 7.1 Set Up Monitoring

1. Configure error tracking (Sentry)
2. Set up uptime monitoring
3. Monitor authentication metrics in Supabase dashboard

### 7.2 Regular Updates

1. Keep dependencies updated
2. Monitor Supabase feature updates
3. Review security headers periodically

## Troubleshooting

### Common Issues

1. **OAuth Redirect Mismatch**:
   - Check redirect URLs in provider settings
   - Verify NEXT_PUBLIC_SITE_URL matches domain

2. **CORS Errors**:
   - Verify allowed origins in Supabase
   - Check environment variable configuration

3. **Database Connection Issues**:
   - Verify service key permissions
   - Check RLS policies

4. **Rate Limiting Too Strict**:
   - Adjust limits in `lib/security.ts`
   - Consider using Redis for production

### Debug Mode

Enable debug logging:

```env
NODE_ENV=development
NEXT_PUBLIC_DEBUG=true
```

Check browser console and server logs for detailed error information.

## Security Checklist

- [ ] HTTPS enabled on domain
- [ ] Environment variables secured
- [ ] OAuth redirect URLs configured
- [ ] RLS policies enabled
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] CSRF protection active
- [ ] Error tracking configured
- [ ] Monitoring set up

## Support

For deployment issues:
1. Check the troubleshooting section
2. Review Supabase documentation
3. Check application logs
4. Contact support if needed

Your Supabase Studio deployment should now be ready for production use with proper authentication, security, and user management!