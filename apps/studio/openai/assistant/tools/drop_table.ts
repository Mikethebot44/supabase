import { z } from 'zod'
import { executeSql } from 'data/sql/execute-sql-query'
import { IS_PLATFORM } from 'common'
import { queryPgMetaSelfHosted } from 'lib/self-hosted'

export const tool = {
  name: 'drop_table',
  description: 'Drop (delete) a table from the database. This action is irreversible and will delete all data in the table.',
  parameters: z.object({
    name: z.string().describe('The table name to drop'),
    schema: z.string().optional().describe('The schema name (defaults to "public")'),
    cascade: z.boolean().optional().describe('Whether to cascade the drop to dependent objects (default: false)')
  }),
  execute: async (args: { name: string; schema?: string; cascade?: boolean }, context: {
    projectRef: string
    connectionString: string
    headers?: Record<string, string>
  }) => {
    const { name, schema = 'public', cascade = false } = args
    const { projectRef, connectionString, headers } = context
    
    try {
      // Validate table name (prevent SQL injection)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error('Invalid table name. Use only letters, numbers, and underscores, starting with a letter or underscore.')
      }
      
      // Safety check: prevent dropping critical system tables or auth tables
      const dangerousTables = [
        'auth.users', 'auth.sessions', 'auth.refresh_tokens',
        'supabase_functions.hooks', 'supabase_functions.migrations',
        'pg_', 'information_schema'
      ]
      
      const fullTableName = `${schema}.${name}`
      const lowerTableName = fullTableName.toLowerCase()
      
      for (const dangerous of dangerousTables) {
        if (lowerTableName.includes(dangerous.toLowerCase())) {
          throw new Error(`Cannot drop table "${fullTableName}" as it appears to be a system or auth table. This is blocked for safety.`)
        }
      }
      
      // Check if table exists first
      const checkTableSql = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = $2
        );
      `
      
      const checkResult = await executeSql(
        {
          projectRef,
          connectionString,
          sql: checkTableSql,
        },
        undefined,
        headers || {},
        IS_PLATFORM ? undefined : queryPgMetaSelfHosted
      )
      
      if (!checkResult.result?.[0]?.exists) {
        return {
          success: false,
          error: `Table "${fullTableName}" does not exist`
        }
      }
      
      // Get row count before dropping (for confirmation)
      const countSql = `SELECT COUNT(*) as row_count FROM "${schema}"."${name}";`
      let rowCount = 0
      
      try {
        const countResult = await executeSql(
          {
            projectRef,
            connectionString,
            sql: countSql,
          },
          undefined,
          headers || {},
          IS_PLATFORM ? undefined : queryPgMetaSelfHosted
        )
        rowCount = parseInt(countResult.result?.[0]?.row_count || '0')
      } catch (error) {
        // If we can't get row count, continue with the drop
        console.warn('Could not get row count before drop:', error)
      }
      
      // Drop the table
      const dropSql = `DROP TABLE "${schema}"."${name}"${cascade ? ' CASCADE' : ''};`
      
      const result = await executeSql(
        {
          projectRef,
          connectionString,
          sql: dropSql,
        },
        undefined,
        headers || {},
        IS_PLATFORM ? undefined : queryPgMetaSelfHosted
      )
      
      return {
        success: true,
        message: `Table "${fullTableName}" dropped successfully`,
        tableName: fullTableName,
        rowsDeleted: rowCount,
        cascaded: cascade,
        sql: dropSql
      }
    } catch (error) {
      console.error('Failed to drop table:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
} 