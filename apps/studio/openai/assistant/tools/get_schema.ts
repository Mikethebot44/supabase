import { z } from 'zod'
import { executeSql } from 'data/sql/execute-sql-query'
import { IS_PLATFORM } from 'common'
import { queryPgMetaSelfHosted } from 'lib/self-hosted'

export const tool = {
  name: 'get_schema',
  description: 'Get detailed schema information for a specific table including column names, types, constraints, and other metadata.',
  parameters: z.object({
    table: z.string().describe('The table name to get schema information for'),
    schema: z.string().optional().describe('The schema name (defaults to "public")')
  }),
  execute: async (args: { table: string; schema?: string }, context: {
    projectRef: string
    connectionString: string
    headers?: Record<string, string>
  }) => {
    const { table, schema = 'public' } = args
    const { projectRef, connectionString, headers } = context
    
    try {
      // Get column information
      const columnsSql = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          ordinal_position
        FROM information_schema.columns 
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
      `
      
      // Get constraints information  
      const constraintsSql = `
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.table_schema = ccu.table_schema
        WHERE tc.table_schema = $1 AND tc.table_name = $2;
      `
      
      // Get indexes information
      const indexesSql = `
        SELECT 
          i.relname AS index_name,
          a.attname AS column_name,
          ix.indisunique AS is_unique,
          ix.indisprimary AS is_primary
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = $1 AND t.relname = $2
        ORDER BY i.relname, a.attnum;
      `

      const [columnsResult, constraintsResult, indexesResult] = await Promise.all([
        executeSql(
          { projectRef, connectionString, sql: columnsSql },
          undefined,
          headers || {},
          IS_PLATFORM ? undefined : queryPgMetaSelfHosted
        ),
        executeSql(
          { projectRef, connectionString, sql: constraintsSql },
          undefined,
          headers || {},
          IS_PLATFORM ? undefined : queryPgMetaSelfHosted
        ),
        executeSql(
          { projectRef, connectionString, sql: indexesSql },
          undefined,
          headers || {},
          IS_PLATFORM ? undefined : queryPgMetaSelfHosted
        )
      ])
      
      if (!columnsResult.result || columnsResult.result.length === 0) {
        return {
          success: false,
          error: `Table "${schema}.${table}" not found or has no columns`
        }
      }
      
      return {
        success: true,
        table: `${schema}.${table}`,
        columns: columnsResult.result,
        constraints: constraintsResult.result || [],
        indexes: indexesResult.result || []
      }
    } catch (error) {
      console.error('Failed to get schema:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
} 