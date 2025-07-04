import { z } from 'zod'

export const tool = {
  name: 'supabase_integrations',
  description: 'Comprehensive Supabase platform integrations for storage, authentication, analytics, and system monitoring. Provides access to buckets, users, metrics, and reports.',
  parameters: z.object({
    category: z.enum(['storage', 'auth', 'analytics', 'system']).describe('Integration category to work with'),
    action: z.string().describe('Specific action to perform within the category'),
    
    // Storage operations
    bucketName: z.string().optional().describe('Storage bucket name for bucket operations'),
    objectPath: z.string().optional().describe('Object path within bucket'),
    bucketConfig: z.object({
      public: z.boolean().optional(),
      file_size_limit: z.number().optional(),
      allowed_mime_types: z.array(z.string()).optional()
    }).optional().describe('Bucket configuration for creation/updates'),
    
    // Auth operations
    userId: z.string().optional().describe('User ID for user-specific operations'),
    email: z.string().optional().describe('User email for user operations'),
    userFilters: z.object({
      verified: z.enum(['verified', 'unverified', 'all']).optional(),
      provider: z.string().optional(),
      search: z.string().optional()
    }).optional().describe('Filters for user queries'),
    userUpdate: z.object({
      email: z.string().optional(),
      phone: z.string().optional(),
      email_confirm: z.boolean().optional(),
      phone_confirm: z.boolean().optional(),
      user_metadata: z.record(z.any()).optional()
    }).optional().describe('User data for updates'),
    
    // Analytics operations
    dateRange: z.object({
      start: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      end: z.string().optional().describe('End date (YYYY-MM-DD)')
    }).optional().describe('Date range for analytics queries'),
    metricType: z.enum(['api', 'database', 'storage', 'auth', 'realtime', 'functions']).optional().describe('Type of metrics to fetch'),
    
    // General options
    limit: z.number().optional().describe('Limit number of results').default(100),
    offset: z.number().optional().describe('Offset for pagination').default(0)
  }),
  execute: async (args: {
    category: 'storage' | 'auth' | 'analytics' | 'system'
    action: string
    bucketName?: string
    objectPath?: string
    bucketConfig?: {
      public?: boolean
      file_size_limit?: number
      allowed_mime_types?: string[]
    }
    userId?: string
    email?: string
    userFilters?: {
      verified?: 'verified' | 'unverified' | 'all'
      provider?: string
      search?: string
    }
    userUpdate?: {
      email?: string
      phone?: string
      email_confirm?: boolean
      phone_confirm?: boolean
      user_metadata?: Record<string, any>
    }
    dateRange?: {
      start?: string
      end?: string
    }
    metricType?: 'api' | 'database' | 'storage' | 'auth' | 'realtime' | 'functions'
    limit?: number
    offset?: number
  }, context: {
    projectRef: string
    connectionString: string
    headers?: Record<string, string>
  }) => {
    const { 
      category,
      action,
      bucketName,
      objectPath,
      bucketConfig,
      userId,
      email,
      userFilters,
      userUpdate,
      dateRange,
      metricType,
      limit = 100,
      offset = 0
    } = args
    const { projectRef, connectionString, headers } = context
    
    try {
      // Import required modules based on category
      const { executeSql } = await import('data/sql/execute-sql-query')
      const { IS_PLATFORM } = await import('common')
      const { queryPgMetaSelfHosted } = await import('lib/self-hosted')
      
      const executeQuery = async (sql: string) => {
        return await executeSql(
          { projectRef, connectionString, sql },
          undefined,
          headers || {},
          IS_PLATFORM ? undefined : queryPgMetaSelfHosted
        )
      }
      
      switch (category) {
        case 'storage': {
          switch (action) {
            case 'list_buckets': {
              const sql = `
                SELECT 
                  id,
                  name,
                  owner,
                  created_at,
                  updated_at,
                  public,
                  avif_autodetection,
                  file_size_limit,
                  allowed_mime_types
                FROM storage.buckets 
                ORDER BY created_at DESC
                LIMIT ${limit} OFFSET ${offset}
              `
              const result = await executeQuery(sql)
              
              return {
                success: true,
                data: {
                  buckets: result.result || [],
                  count: result.result?.length || 0,
                  summary: {
                    operation: 'LIST_BUCKETS',
                    found: result.result?.length || 0
                  }
                }
              }
            }
            
            case 'get_bucket_details': {
              if (!bucketName) {
                throw new Error('bucketName is required for bucket details')
              }
              
              const bucketSql = `
                SELECT 
                  id,
                  name,
                  owner,
                  created_at,
                  updated_at,
                  public,
                  avif_autodetection,
                  file_size_limit,
                  allowed_mime_types
                FROM storage.buckets 
                WHERE name = '${bucketName}'
              `
              
              const objectsSql = `
                SELECT 
                  COUNT(*) as object_count,
                  SUM(metadata->>'size')::bigint as total_size,
                  MAX(updated_at) as last_modified
                FROM storage.objects 
                WHERE bucket_id = '${bucketName}'
              `
              
              const [bucketResult, objectsResult] = await Promise.all([
                executeQuery(bucketSql),
                executeQuery(objectsSql)
              ])
              
              return {
                success: true,
                data: {
                  bucket: bucketResult.result?.[0],
                  stats: objectsResult.result?.[0],
                  summary: {
                    operation: 'GET_BUCKET_DETAILS',
                    bucket: bucketName
                  }
                }
              }
            }
            
            case 'list_objects': {
              if (!bucketName) {
                throw new Error('bucketName is required for listing objects')
              }
              
              const sql = `
                SELECT 
                  name,
                  id,
                  bucket_id,
                  owner,
                  created_at,
                  updated_at,
                  last_accessed_at,
                  metadata
                FROM storage.objects 
                WHERE bucket_id = '${bucketName}'
                ${objectPath ? `AND name LIKE '${objectPath}%'` : ''}
                ORDER BY updated_at DESC
                LIMIT ${limit} OFFSET ${offset}
              `
              
              const result = await executeQuery(sql)
              
              return {
                success: true,
                data: {
                  bucket: bucketName,
                  objects: result.result || [],
                  count: result.result?.length || 0,
                  summary: {
                    operation: 'LIST_OBJECTS',
                    bucket: bucketName,
                    found: result.result?.length || 0
                  }
                }
              }
            }
            
            default: {
              throw new Error(`Unknown storage action: ${action}`)
            }
          }
        }
        
        case 'auth': {
          switch (action) {
            case 'list_users': {
              let whereClause = '1=1'
              
              if (userFilters?.verified === 'verified') {
                whereClause += ' AND email_confirmed_at IS NOT NULL'
              } else if (userFilters?.verified === 'unverified') {
                whereClause += ' AND email_confirmed_at IS NULL'
              }
              
              if (userFilters?.search) {
                whereClause += ` AND (email ILIKE '%${userFilters.search}%' OR phone ILIKE '%${userFilters.search}%')`
              }
              
              if (userFilters?.provider) {
                whereClause += ` AND raw_app_meta_data->>'provider' = '${userFilters.provider}'`
              }
              
              const sql = `
                SELECT 
                  id,
                  email,
                  phone,
                  created_at,
                  updated_at,
                  last_sign_in_at,
                  email_confirmed_at,
                  phone_confirmed_at,
                  raw_app_meta_data,
                  raw_user_meta_data
                FROM auth.users 
                WHERE ${whereClause}
                ORDER BY created_at DESC
                LIMIT ${limit} OFFSET ${offset}
              `
              
              const result = await executeQuery(sql)
              
              return {
                success: true,
                data: {
                  users: result.result || [],
                  count: result.result?.length || 0,
                  filters: userFilters,
                  summary: {
                    operation: 'LIST_USERS',
                    found: result.result?.length || 0
                  }
                }
              }
            }
            
            case 'get_user_details': {
              if (!userId && !email) {
                throw new Error('userId or email is required for user details')
              }
              
              const whereClause = userId ? `id = '${userId}'` : `email = '${email}'`
              
              const userSql = `
                SELECT 
                  id,
                  email,
                  phone,
                  created_at,
                  updated_at,
                  last_sign_in_at,
                  email_confirmed_at,
                  phone_confirmed_at,
                  raw_app_meta_data,
                  raw_user_meta_data,
                  is_super_admin,
                  encrypted_password IS NOT NULL as has_password
                FROM auth.users 
                WHERE ${whereClause}
              `
              
              const identitiesSql = userId 
                ? `SELECT * FROM auth.identities WHERE user_id = '${userId}' ORDER BY created_at DESC`
                : `SELECT i.* FROM auth.identities i JOIN auth.users u ON i.user_id = u.id WHERE u.email = '${email}' ORDER BY i.created_at DESC`
              
              const sessionsSql = userId
                ? `SELECT id, created_at, updated_at, NOT_AFTER as expires_at FROM auth.sessions WHERE user_id = '${userId}' ORDER BY created_at DESC LIMIT 5`
                : `SELECT s.id, s.created_at, s.updated_at, s.NOT_AFTER as expires_at FROM auth.sessions s JOIN auth.users u ON s.user_id = u.id WHERE u.email = '${email}' ORDER BY s.created_at DESC LIMIT 5`
              
              const [userResult, identitiesResult, sessionsResult] = await Promise.all([
                executeQuery(userSql),
                executeQuery(identitiesSql),
                executeQuery(sessionsSql)
              ])
              
              return {
                success: true,
                data: {
                  user: userResult.result?.[0],
                  identities: identitiesResult.result || [],
                  recentSessions: sessionsResult.result || [],
                  summary: {
                    operation: 'GET_USER_DETAILS',
                    userId: userId || 'by-email',
                    identityCount: identitiesResult.result?.length || 0,
                    sessionCount: sessionsResult.result?.length || 0
                  }
                }
              }
            }
            
            case 'get_auth_stats': {
              const statsSql = `
                SELECT 
                  COUNT(*) as total_users,
                  COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as verified_users,
                  COUNT(CASE WHEN last_sign_in_at > NOW() - INTERVAL '30 days' THEN 1 END) as active_users_30d,
                  COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_users_7d
                FROM auth.users
              `
              
              const providersSql = `
                SELECT 
                  raw_app_meta_data->>'provider' as provider,
                  COUNT(*) as user_count
                FROM auth.users 
                WHERE raw_app_meta_data->>'provider' IS NOT NULL
                GROUP BY raw_app_meta_data->>'provider'
                ORDER BY user_count DESC
              `
              
              const [statsResult, providersResult] = await Promise.all([
                executeQuery(statsSql),
                executeQuery(providersSql)
              ])
              
              return {
                success: true,
                data: {
                  stats: statsResult.result?.[0] || {},
                  providerBreakdown: providersResult.result || [],
                  summary: {
                    operation: 'GET_AUTH_STATS',
                    totalUsers: statsResult.result?.[0]?.total_users || 0
                  }
                }
              }
            }
            
            default: {
              throw new Error(`Unknown auth action: ${action}`)
            }
          }
        }
        
        case 'analytics': {
          const startDate = dateRange?.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          const endDate = dateRange?.end || new Date().toISOString().split('T')[0]
          
          switch (action) {
            case 'get_usage_stats': {
              // Note: These queries would typically use analytics tables or external APIs
              // For now, providing structure that would work with typical analytics data
              
              const apiStatsSql = `
                SELECT 
                  DATE(created_at) as date,
                  COUNT(*) as request_count,
                  COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
                  AVG(response_time_ms) as avg_response_time
                FROM analytics_api_requests 
                WHERE DATE(created_at) BETWEEN '${startDate}' AND '${endDate}'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
              `
              
              // Fallback to system stats if analytics tables don't exist
              const systemStatsSql = `
                SELECT 
                  schemaname,
                  tablename,
                  n_tup_ins as inserts,
                  n_tup_upd as updates,
                  n_tup_del as deletes,
                  n_live_tup as live_rows,
                  n_dead_tup as dead_rows
                FROM pg_stat_user_tables 
                WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                ORDER BY n_live_tup DESC
                LIMIT ${limit}
              `
              
              try {
                const apiResult = await executeQuery(apiStatsSql)
                const systemResult = await executeQuery(systemStatsSql)
                
                return {
                  success: true,
                  data: {
                    dateRange: { start: startDate, end: endDate },
                    apiStats: apiResult.result || [],
                    tableStats: systemResult.result || [],
                    summary: {
                      operation: 'GET_USAGE_STATS',
                      period: `${startDate} to ${endDate}`,
                      dataPoints: apiResult.result?.length || 0
                    }
                  }
                }
              } catch (error) {
                // Fallback to basic system stats only
                const systemResult = await executeQuery(systemStatsSql)
                
                return {
                  success: true,
                  data: {
                    tableStats: systemResult.result || [],
                    warning: 'Analytics tables not available, showing system stats only',
                    summary: {
                      operation: 'GET_USAGE_STATS',
                      fallback: true,
                      tables: systemResult.result?.length || 0
                    }
                  }
                }
              }
            }
            
            case 'get_database_stats': {
              const dbStatsSql = `
                SELECT 
                  datname as database_name,
                  numbackends as active_connections,
                  xact_commit as transactions_committed,
                  xact_rollback as transactions_rolled_back,
                  blks_read as blocks_read,
                  blks_hit as blocks_hit,
                  tup_returned as tuples_returned,
                  tup_fetched as tuples_fetched,
                  tup_inserted as tuples_inserted,
                  tup_updated as tuples_updated,
                  tup_deleted as tuples_deleted,
                  conflicts,
                  temp_files,
                  temp_bytes,
                  deadlocks,
                  stats_reset
                FROM pg_stat_database 
                WHERE datname NOT IN ('template0', 'template1', 'postgres')
              `
              
              const connectionsSql = `
                SELECT 
                  state,
                  COUNT(*) as count,
                  AVG(EXTRACT(EPOCH FROM (now() - state_change))) as avg_duration_seconds
                FROM pg_stat_activity 
                WHERE datname = current_database()
                GROUP BY state
              `
              
              const [dbResult, connectionsResult] = await Promise.all([
                executeQuery(dbStatsSql),
                executeQuery(connectionsSql)
              ])
              
              return {
                success: true,
                data: {
                  databaseStats: dbResult.result || [],
                  connectionStats: connectionsResult.result || [],
                  summary: {
                    operation: 'GET_DATABASE_STATS',
                    databases: dbResult.result?.length || 0,
                    connectionStates: connectionsResult.result?.length || 0
                  }
                }
              }
            }
            
            default: {
              throw new Error(`Unknown analytics action: ${action}`)
            }
          }
        }
        
        case 'system': {
          switch (action) {
            case 'get_system_health': {
              const healthSql = `
                SELECT 
                  'database' as component,
                  CASE 
                    WHEN pg_is_in_recovery() THEN 'standby'
                    ELSE 'primary'
                  END as status,
                  version() as version,
                  current_setting('max_connections') as max_connections,
                  (SELECT count(*) FROM pg_stat_activity) as current_connections,
                  pg_size_pretty(pg_database_size(current_database())) as database_size,
                  current_timestamp as checked_at
              `
              
              const extensionsSql = `
                SELECT 
                  name,
                  default_version,
                  installed_version,
                  comment
                FROM pg_available_extensions 
                WHERE installed_version IS NOT NULL
                ORDER BY name
              `
              
              const [healthResult, extensionsResult] = await Promise.all([
                executeQuery(healthSql),
                executeQuery(extensionsSql)
              ])
              
              return {
                success: true,
                data: {
                  health: healthResult.result?.[0] || {},
                  extensions: extensionsResult.result || [],
                  summary: {
                    operation: 'GET_SYSTEM_HEALTH',
                    status: 'healthy',
                    extensionCount: extensionsResult.result?.length || 0
                  }
                }
              }
            }
            
            default: {
              throw new Error(`Unknown system action: ${action}`)
            }
          }
        }
        
        default: {
          throw new Error(`Unknown category: ${category}`)
        }
      }
      
    } catch (error) {
      console.error('Failed to execute Supabase integration:', error)
      
      let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        errorMessage = 'Integration failed: Required table or view does not exist. This might be expected for some analytics features.'
      } else if (errorMessage.includes('permission denied')) {
        errorMessage = 'Integration failed: Insufficient permissions to access this resource.'
      } else if (errorMessage.includes('connection')) {
        errorMessage = 'Integration failed: Database connection issue. Check project status.'
      }
      
      return {
        success: false,
        error: errorMessage,
        category: category,
        action: action,
        context: {
          projectRef: projectRef,
          category: category,
          action: action
        }
      }
    }
  }
}