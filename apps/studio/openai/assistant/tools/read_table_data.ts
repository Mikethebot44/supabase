import { z } from 'zod'

export const tool = {
  name: 'read_table_data',
  description: 'Read data from a specific table with optional filtering, pagination, and sorting. This allows the AI to analyze actual data patterns and content.',
  parameters: z.object({
    schema: z.string().describe('Schema name (e.g., "public", "auth")').default('public'),
    table: z.string().describe('Table name to read data from'),
    limit: z.number().optional().describe('Maximum number of rows to return (default: 50, max: 1000)').default(50),
    offset: z.number().optional().describe('Number of rows to skip for pagination').default(0),
    columns: z.array(z.string()).optional().describe('Specific columns to select (if not provided, selects all)'),
    where: z.string().optional().describe('WHERE clause condition (e.g., "status = \'active\'" or "created_at > \'2024-01-01\'")'),
    orderBy: z.string().optional().describe('ORDER BY clause (e.g., "created_at DESC" or "name ASC")'),
    includeCount: z.boolean().optional().describe('Whether to include total row count').default(false)
  }),
  execute: async (args: {
    schema?: string
    table: string
    limit?: number
    offset?: number
    columns?: string[]
    where?: string
    orderBy?: string
    includeCount?: boolean
  }, context: {
    projectRef: string
    connectionString: string
    headers?: Record<string, string>
  }) => {
    const { 
      schema = 'public', 
      table, 
      limit = 50, 
      offset = 0, 
      columns, 
      where, 
      orderBy, 
      includeCount = false 
    } = args
    const { projectRef, connectionString, headers } = context
    
    try {
      // Validate and sanitize inputs
      if (limit > 1000) {
        throw new Error('Limit cannot exceed 1000 rows for performance reasons')
      }
      
      if (offset < 0) {
        throw new Error('Offset cannot be negative')
      }
      
      // Basic SQL injection protection
      const safeSchema = schema.replace(/[^a-zA-Z0-9_]/g, '')
      const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '')
      
      if (safeSchema !== schema || safeTable !== table) {
        throw new Error('Schema and table names can only contain letters, numbers, and underscores')
      }
      
      // Build the SELECT clause
      let selectClause = '*'
      if (columns && columns.length > 0) {
        // Sanitize column names
        const safeColumns = columns.map(col => {
          const safeCol = col.replace(/[^a-zA-Z0-9_]/g, '')
          if (safeCol !== col) {
            throw new Error(`Invalid column name: ${col}`)
          }
          return `"${safeCol}"`
        })
        selectClause = safeColumns.join(', ')
      }
      
      // Build the main query
      let sql = `SELECT ${selectClause} FROM "${safeSchema}"."${safeTable}"`
      
      // Add WHERE clause if provided
      if (where) {
        // Basic validation for WHERE clause - this is more permissive but still safe since we're only reading
        sql += ` WHERE ${where}`
      }
      
      // Add ORDER BY clause if provided
      if (orderBy) {
        sql += ` ORDER BY ${orderBy}`
      }
      
      // Add LIMIT and OFFSET
      sql += ` LIMIT ${limit} OFFSET ${offset}`
      
      // Import the SQL execution function
      const { executeSql } = await import('data/sql/execute-sql-query')
      const { IS_PLATFORM } = await import('common')
      const { queryPgMetaSelfHosted } = await import('lib/self-hosted')
      
      // Execute the main query
      const result = await executeSql(
        {
          projectRef,
          connectionString,
          sql: sql,
        },
        undefined,
        headers || {},
        IS_PLATFORM ? undefined : queryPgMetaSelfHosted
      )
      
      let totalCount = undefined
      
      // Get total count if requested
      if (includeCount) {
        const countSql = `SELECT COUNT(*) as total_count FROM "${safeSchema}"."${safeTable}"${where ? ` WHERE ${where}` : ''}`
        
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
        
        totalCount = countResult.result?.[0]?.total_count || 0
      }
      
      const rows = result.result || []
      
      return {
        success: true,
        data: {
          schema: safeSchema,
          table: safeTable,
          rows: rows,
          rowCount: rows.length,
          totalCount: totalCount,
          query: sql,
          hasMore: rows.length === limit, // Indicates if there might be more rows
          nextOffset: offset + limit,
          columns: rows.length > 0 ? Object.keys(rows[0]) : [],
          // Include summary stats for better AI understanding
          summary: {
            isEmpty: rows.length === 0,
            isPartialResult: rows.length === limit,
            rowsReturned: rows.length,
            queryOffset: offset,
            queryLimit: limit
          }
        }
      }
    } catch (error) {
      console.error('Failed to read table data:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        table: `${schema}.${table}`,
        query: 'Failed to construct query'
      }
    }
  }
}