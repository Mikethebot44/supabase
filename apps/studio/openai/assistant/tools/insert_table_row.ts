import { z } from 'zod'

export const tool = {
  name: 'insert_table_row',
  description: 'Insert a new row into a database table. Supports single row insertion with comprehensive validation and error handling.',
  parameters: z.object({
    schema: z.string().describe('Schema name (e.g., "public", "auth")').default('public'),
    table: z.string().describe('Table name to insert data into'),
    data: z.record(z.any()).describe('Object containing column names as keys and values to insert'),
    returning: z.boolean().optional().describe('Whether to return the inserted row data').default(true),
    onConflict: z.enum(['ignore', 'update', 'error']).optional().describe('How to handle conflicts (duplicate keys)').default('error')
  }),
  execute: async (args: {
    schema?: string
    table: string
    data: Record<string, any>
    returning?: boolean
    onConflict?: 'ignore' | 'update' | 'error'
  }, context: {
    projectRef: string
    connectionString: string
    headers?: Record<string, string>
  }) => {
    const { 
      schema = 'public', 
      table, 
      data, 
      returning = true,
      onConflict = 'error'
    } = args
    const { projectRef, connectionString, headers } = context
    
    try {
      // Validate inputs
      if (!data || Object.keys(data).length === 0) {
        throw new Error('Data object cannot be empty')
      }
      
      // Sanitize schema and table names
      const safeSchema = schema.replace(/[^a-zA-Z0-9_]/g, '')
      const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '')
      
      if (safeSchema !== schema || safeTable !== table) {
        throw new Error('Schema and table names can only contain letters, numbers, and underscores')
      }
      
      // Import required modules
      const { executeSql } = await import('data/sql/execute-sql-query')
      const { IS_PLATFORM } = await import('common')
      const { queryPgMetaSelfHosted } = await import('lib/self-hosted')
      
      // Get table schema to validate columns
      const schemaQuery = `
        SELECT 
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.udt_name,
          tc.constraint_type
        FROM information_schema.columns c
        LEFT JOIN information_schema.constraint_column_usage ccu 
          ON c.column_name = ccu.column_name 
          AND c.table_name = ccu.table_name 
          AND c.table_schema = ccu.table_schema
        LEFT JOIN information_schema.table_constraints tc 
          ON ccu.constraint_name = tc.constraint_name
        WHERE c.table_schema = '${safeSchema}' AND c.table_name = '${safeTable}'
        ORDER BY c.ordinal_position
      `
      
      const executeQuery = async (sql: string) => {
        return await executeSql(
          { projectRef, connectionString, sql },
          undefined,
          headers || {},
          IS_PLATFORM ? undefined : queryPgMetaSelfHosted
        )
      }
      
      const schemaResult = await executeQuery(schemaQuery)
      const columns = schemaResult.result || []
      
      if (columns.length === 0) {
        throw new Error(`Table "${safeSchema}"."${safeTable}" not found or has no accessible columns`)
      }
      
      // Validate that all data columns exist in the table
      const validColumns = new Set(columns.map((col: any) => col.column_name))
      const dataColumns = Object.keys(data)
      const invalidColumns = dataColumns.filter(col => !validColumns.has(col))
      
      if (invalidColumns.length > 0) {
        throw new Error(`Invalid columns: ${invalidColumns.join(', ')}. Valid columns are: ${Array.from(validColumns).join(', ')}`)
      }
      
      // Build the INSERT query
      const columnNames = dataColumns.map(col => `"${col}"`).join(', ')
      const placeholders = dataColumns.map((_, index) => `$${index + 1}`).join(', ')
      const values = dataColumns.map(col => data[col])
      
      // Handle conflict resolution
      let conflictClause = ''
      if (onConflict === 'ignore') {
        conflictClause = ' ON CONFLICT DO NOTHING'
      } else if (onConflict === 'update') {
        const updateSet = dataColumns
          .map(col => `"${col}" = EXCLUDED."${col}"`)
          .join(', ')
        conflictClause = ` ON CONFLICT DO UPDATE SET ${updateSet}`
      }
      
      const returningClause = returning ? ' RETURNING *' : ''
      
      let insertSql = `
        INSERT INTO "${safeSchema}"."${safeTable}" (${columnNames})
        VALUES (${placeholders})${conflictClause}${returningClause}
      `
      
      // Replace placeholders with actual values (basic implementation)
      values.forEach((value, index) => {
        const placeholder = `$${index + 1}`
        let sqlValue: string
        
        if (value === null || value === undefined) {
          sqlValue = 'NULL'
        } else if (typeof value === 'string') {
          // Escape single quotes and wrap in quotes
          sqlValue = `'${value.replace(/'/g, "''")}'`
        } else if (typeof value === 'boolean') {
          sqlValue = value ? 'TRUE' : 'FALSE'
        } else if (typeof value === 'number') {
          sqlValue = value.toString()
        } else if (Array.isArray(value)) {
          // Handle arrays (for PostgreSQL array types)
          const arrayValues = value.map(v => 
            typeof v === 'string' ? `"${v.replace(/"/g, '\\"')}"` : v
          ).join(',')
          sqlValue = `ARRAY[${arrayValues}]`
        } else {
          // Handle objects (for JSON/JSONB columns)
          sqlValue = `'${JSON.stringify(value).replace(/'/g, "''")}'`
        }
        
        insertSql = insertSql.replace(placeholder, sqlValue)
      })
      
      // Execute the insert
      const result = await executeQuery(insertSql)
      
      return {
        success: true,
        data: {
          schema: safeSchema,
          table: safeTable,
          inserted: result.result || [],
          rowCount: result.result?.length || 0,
          query: insertSql,
          columns: dataColumns,
          summary: {
            operation: 'INSERT',
            rowsAffected: result.result?.length || 0,
            conflictHandling: onConflict,
            returningData: returning
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to insert table row:', error)
      
      // Provide more specific error messages
      let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      if (errorMessage.includes('duplicate key')) {
        errorMessage = 'Insert failed: Duplicate key violation. Consider using onConflict parameter to handle duplicates.'
      } else if (errorMessage.includes('foreign key')) {
        errorMessage = 'Insert failed: Foreign key constraint violation. Check that referenced records exist.'
      } else if (errorMessage.includes('not null')) {
        errorMessage = 'Insert failed: Required field missing. Check that all non-nullable columns have values.'
      } else if (errorMessage.includes('invalid input syntax')) {
        errorMessage = 'Insert failed: Invalid data format. Check that data types match column requirements.'
      }
      
      return {
        success: false,
        error: errorMessage,
        table: `${schema}.${table}`,
        data: args.data,
        query: 'Failed to construct INSERT query'
      }
    }
  }
}