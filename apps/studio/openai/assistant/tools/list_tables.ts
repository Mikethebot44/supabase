import { z } from 'zod'
import { executeSql } from 'data/sql/execute-sql-query'
import { IS_PLATFORM } from 'common'
import { queryPgMetaSelfHosted } from 'lib/self-hosted'

export const tool = {
  name: 'list_tables',
  description: 'List all tables in the database with their schema information.',
  parameters: z.object({
    schema: z.string().optional().describe('Schema name to filter tables (defaults to all schemas except system schemas)'),
    includeViews: z.boolean().optional().describe('Whether to include views (default: false)')
  }),
  execute: async (args: { schema?: string; includeViews?: boolean }, context: {
    projectRef: string
    connectionString: string
    headers?: Record<string, string>
  }) => {
    const { schema, includeViews = false } = args
    const { projectRef, connectionString, headers } = context
    
    try {
      // Build the SQL query based on parameters
      let sql = `
        SELECT 
          schemaname as schema_name,
          tablename as table_name,
          tableowner as table_owner,
          hasindexes as has_indexes,
          hasrules as has_rules,
          hastriggers as has_triggers,
          rowsecurity as row_security_enabled
        FROM pg_tables
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      `
      
      if (schema) {
        sql += ` AND schemaname = '${schema}'`
      }
      
      sql += ` ORDER BY schemaname, tablename`
      
      // If includeViews is true, also get views
      let viewsSql = ''
      if (includeViews) {
        viewsSql = `
          SELECT 
            schemaname as schema_name,
            viewname as table_name,
            viewowner as table_owner,
            false as has_indexes,
            false as has_rules,
            false as has_triggers,
            false as row_security_enabled,
            'VIEW' as table_type
          FROM pg_views
          WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
        `
        
        if (schema) {
          viewsSql += ` AND schemaname = '${schema}'`
        }
        
        viewsSql += ` ORDER BY schemaname, viewname`
      }
      
      // Execute the queries
      const tablesResult = await executeSql(
        {
          projectRef,
          connectionString,
          sql: sql,
        },
        undefined,
        headers || {},
        IS_PLATFORM ? undefined : queryPgMetaSelfHosted
      )
      
      let viewsResult = { result: [] }
      if (includeViews && viewsSql) {
        viewsResult = await executeSql(
          {
            projectRef,
            connectionString,
            sql: viewsSql,
          },
          undefined,
          headers || {},
          IS_PLATFORM ? undefined : queryPgMetaSelfHosted
        )
      }
      
      // Combine results
      const tables = tablesResult.result || []
      const views = viewsResult.result || []
      
      // Add table_type to tables
      const tablesWithType = tables.map(table => ({
        ...table,
        table_type: 'TABLE'
      }))
      
      const allTables = [...tablesWithType, ...views]
      
      // Get table counts by schema
      const schemaStats = allTables.reduce((acc, table: any) => {
        const schemaName = table.schema_name
        if (!acc[schemaName]) {
          acc[schemaName] = { tables: 0, views: 0 }
        }
        if (table.table_type === 'VIEW') {
          acc[schemaName].views++
        } else {
          acc[schemaName].tables++
        }
        return acc
      }, {} as Record<string, { tables: number; views: number }>)
      
      return {
        success: true,
        totalTables: tables.length,
        totalViews: views.length,
        schemaFilter: schema || 'all',
        includeViews,
        schemaStats,
        tables: allTables
      }
    } catch (error) {
      console.error('Failed to list tables:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
} 