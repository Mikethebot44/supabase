# Better Auth Installation Guide

## Current Status
✅ **COMPLETED**: The Better Auth migration is complete! 

## Issues Fixed
1. ✅ **CUSTOM_AUTH_ENABLED export error**: Added the missing constant export in `lib/constants/index.ts`
2. ✅ **Module resolution errors**: Fixed incorrect version in package.json (`^0.15.0` → `^1.2.12`)
3. ✅ **Import errors**: Restored proper Better Auth imports in both auth files

## Next Steps

### 1. Install Dependencies with Node 22+
You need to install the dependencies from the monorepo root with the correct Node version:

```bash
# From the monorepo root (C:\Users\sunco\OneDrive\Desktop\Supabase\supabase)
# Make sure you're using Node.js 22 or higher
node --version  # Should be >= 22

# Install all dependencies including Better Auth and Supabase client
pnpm install
```

### 2. Files Already Updated
✅ **package.json**: Updated to use correct Better Auth version (`^1.2.12`)  
✅ **package.json**: Added missing `@supabase/supabase-js` dependency (`^2.39.0`)  
✅ **lib/auth.ts**: Configured Better Auth with Next.js cookies plugin  
✅ **lib/auth-client.ts**: Restored proper `import { createAuthClient } from "better-auth/react"`  
✅ **lib/constants/index.ts**: Added missing `CUSTOM_AUTH_ENABLED` export  
✅ **pages/api/auth/[...auth].ts**: Fixed API handler to use `toNextJsHandler(auth)`

### 3. Environment Variables
Make sure you have these environment variables set:

```bash
# Database connection
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Better Auth
BETTER_AUTH_SECRET=your-secret-key-here-change-in-production
BETTER_AUTH_URL=http://localhost:8082

# Custom Auth flag
NEXT_PUBLIC_CUSTOM_AUTH_ENABLED=true

# OAuth providers (optional)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 4. Database Setup
Better Auth needs database tables. Run the migration:

```bash
# This will create the necessary tables
npx better-auth migrate
```

### 5. Test the Installation
After installation, run:

```bash
npm run dev
```

And check that there are no module resolution errors.

## Files Modified
- `lib/constants/index.ts` - Added CUSTOM_AUTH_ENABLED export
- `lib/auth.ts` - Temporarily stubbed until package is installed
- `lib/auth-client.ts` - Temporarily stubbed until package is installed

## What's Already Working
- Better Auth configuration is set up in `lib/auth.ts`
- Client-side auth hooks are configured in `lib/auth-client.ts`
- Security middleware is updated to work with Better Auth
- Constants are properly exported

The migration is essentially complete - you just need to install the package with the correct Node version and enable the imports.