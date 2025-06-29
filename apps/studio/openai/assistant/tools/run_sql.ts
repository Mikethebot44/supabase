import { z } from 'zod'
import { executeSql } from 'data/sql/execute-sql-query'
import { IS_PLATFORM } from 'common'
import { queryPgMetaSelfHosted } from 'lib/self-hosted'

export const tool = {
  name: 'run_sql',
  description: 'Execute read-only SQL queries safely against the Supabase database. Only SELECT queries are allowed.',
  parameters: z.object({
    sql: z.string().describe('The SQL query to execute (must be read-only, SELECT only)')
  }),
  execute: async (args: { sql: string }, context: {
    projectRef: string
    connectionString: string
    headers?: Record<string, string>
  }) => {
    const { sql } = args
    const { projectRef, connectionString, headers } = context
    
    try {
      // Security check: only allow SELECT queries
      const trimmedSql = sql.trim().toLowerCase()
      if (!trimmedSql.startsWith('select')) {
        throw new Error('Only SELECT queries are allowed for security reasons')
      }
      
      // Additional security: block potentially dangerous operations
      const dangerousPatterns = [
        'drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate',
        'grant', 'revoke', 'commit', 'rollback', 'savepoint'
      ]
      
      const lowerSql = sql.toLowerCase()
      for (const pattern of dangerousPatterns) {
        if (lowerSql.includes(pattern)) {
          throw new Error(`Query contains potentially dangerous operation: ${pattern}`)
        }
      }
      
      const result = await executeSql(
        {
          projectRef,
          connectionString,
          sql: sql.trim(),
        },
        undefined,
        headers || {},
        IS_PLATFORM ? undefined : queryPgMetaSelfHosted
      )
      
      return {
        success: true,
        data: result.result,
        rowCount: result.result?.length || 0
      }
    } catch (error) {
      console.error('Failed to execute SQL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
} 