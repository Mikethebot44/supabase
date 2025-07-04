# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm install` - Install dependencies
- `npm run dev` - Start development server with Turbopack on port 8082
- `npm run build` - Production build (memory optimized for large codebase)
- `npm run build:windows` - Windows-specific build with increased memory allocation
- `npm start` - Start production server

### Testing
- `npm run test` - Run tests with coverage using Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI interface
- `npm run test:update` - Update test snapshots
- `npm run test:ci` - Run tests for CI environment

### Code Quality
- `npm run lint` - Run Next.js linting
- `npm run typecheck` - TypeScript type checking
- `npm run prettier:check` - Check code formatting
- `npm run prettier:write` - Auto-format code

### Special Build Commands
- `npm run build:graphql-types` - Generate GraphQL types from schema
- `npm run build:deno-types` - Build Deno types for Edge Functions
- `npm run dev:secrets:pull` - Pull development secrets (Supabase internal)

## Architecture Overview

### Technology Stack
- **Framework**: Next.js 15 with Pages Router
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Query (@tanstack/react-query) for server state, Valtio for client state
- **Database Layer**: PostgreSQL with pg-meta for schema introspection
- **Authentication**: Supabase Auth (GoTrue)
- **Testing**: Vitest with jsdom environment
- **Code Editor**: Monaco Editor integration
- **UI Components**: Custom design system in `/packages/ui`

### Project Structure

#### Core Directories
- `pages/` - Next.js pages with nested routing for projects
- `components/` - React components organized by feature
  - `interfaces/` - Major feature interfaces (Auth, Database, Storage, etc.)
  - `layouts/` - Layout components for different sections
  - `ui/` - Reusable UI components
- `data/` - React Query hooks and API client setup
- `lib/` - Shared utilities and helpers
- `hooks/` - Custom React hooks
- `state/` - Global state management with Valtio

#### Data Layer Architecture
- **API Client**: Uses `openapi-fetch` with generated types from OpenAPI schema
- **Query Management**: React Query with custom error handling and retry logic
- **Authentication**: Token-based auth with automatic header injection
- **Error Handling**: Centralized error handling with Sentry integration

#### Component Architecture
- **Layout System**: Nested layouts with `DefaultLayout` as base for all project pages
- **Design System**: Workspace packages (`ui`, `ui-patterns`, `common`) for shared components
- **Feature Organization**: Components grouped by domain (Auth, Database, Storage, etc.)

### Key Patterns

#### API Integration
```typescript
// All API calls use generated types from openapi-typescript
import { get, post } from 'data/fetchers'

// React Query hooks follow naming convention: use[Resource][Action]
const { data, error } = useProjectQuery({ ref: 'project-ref' })
```

#### Component Structure
- Components use TypeScript with strict typing
- Props interfaces defined inline or in separate `.types.ts` files
- Consistent use of React Query for data fetching
- Error boundaries for graceful error handling

#### State Management
- Server state: React Query
- Client state: Valtio for complex state, React useState for simple state
- Global state in `state/` directory using Valtio

### Environment Configuration

#### Platform vs Self-Hosted
The app supports two modes:
- **Platform** (`IS_PLATFORM=true`): Full Supabase cloud platform features
- **Self-Hosted** (`IS_PLATFORM=false`): Limited features for self-hosted deployments

#### Key Environment Variables
- `NEXT_PUBLIC_IS_PLATFORM` - Determines platform vs self-hosted mode
- `NEXT_PUBLIC_API_URL` - API endpoint URL
- `SUPABASE_URL` - Supabase project URL (self-hosted)
- `POSTGRES_PASSWORD`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` - Self-hosted credentials

### Development Workflow

#### Project Structure for Pages
```
pages/
├── project/
│   └── [ref]/           # Project-specific pages
│       ├── auth/        # Authentication management
│       ├── database/    # Database management
│       ├── storage/     # Storage management
│       └── settings/    # Project settings
```

#### Component Development
1. Create components in appropriate `components/interfaces/` directory
2. Use existing UI components from workspace packages
3. Follow existing patterns for data fetching with React Query
4. Implement proper error handling and loading states

#### Testing
- Unit tests using Vitest with React Testing Library
- Test files collocated with components (`.test.tsx`)
- Mock service worker (MSW) for API mocking
- Coverage reports generated in `coverage/` directory

### Integration Notes

#### Monaco Editor
- Custom theme integration with app themes
- SQL syntax highlighting and IntelliSense
- Custom formatters for SQL and other languages

#### GraphQL Integration
- GraphiQL interface for API exploration
- Custom React components for GraphQL schema visualization

#### Security
- CSP headers configured for different environments
- CORS handling for various Supabase domains
- Authentication token management with automatic refresh

### Monorepo Context
This is part of a larger monorepo with shared packages:
- `ui` - Design system components
- `ui-patterns` - Complex UI patterns
- `common` - Shared utilities and providers
- `shared-data` - Constants and shared data
- `api-types` - Generated API types

When making changes, consider impact on other workspace packages and update accordingly.