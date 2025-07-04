import { z } from 'zod'

export const tool = {
  name: 'update_table_row',
  description: 'Update existing rows in a database table with optional WHERE conditions. Supports updating multiple rows at once with comprehensive validation.',
  parameters: z.object({
    schema: z.string().describe('Schema name (e.g., "public", "auth")').default('public'),
    table: z.string().describe('Table name to update data in'),
    data: z.record(z.any()).describe('Object containing column names as keys and new values to update'),
    where: z.string().optional().describe('WHERE clause to specify which rows to update (e.g., "id = 123" or "status = \'active\'")'),
    returning: z.boolean().optional().describe('Whether to return the updated row data').default(true),
    limit: z.number().optional().describe('Maximum number of rows to update (safety limit)').default(1000)
  }),
  execute: async (args: {
    schema?: string
    table: string
    data: Record<string, any>
    where?: string
    returning?: boolean
    limit?: number
  }, context: {
    projectRef: string
    connectionString: string
    headers?: Record<string, string>
  }) => {
    const { 
      schema = 'public', 
      table, 
      data, 
      where,
      returning = true,
      limit = 1000
    } = args
    const { projectRef, connectionString, headers } = context
    
    try {
      // Validate inputs
      if (!data || Object.keys(data).length === 0) {
        throw new Error('Data object cannot be empty')
      }
      
      if (!where) {
        throw new Error('WHERE clause is required for UPDATE operations to prevent accidental mass updates. Use "1=1" to update all rows if intended.')
      }
      
      if (limit <= 0 || limit > 10000) {
        throw new Error('Limit must be between 1 and 10000 for safety')
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
      
      // First, check how many rows would be affected
      const countQuery = `SELECT COUNT(*) as affected_count FROM "${safeSchema}"."${safeTable}" WHERE ${where}`
      const countResult = await executeQuery(countQuery)
      const affectedCount = countResult.result?.[0]?.affected_count || 0
      
      if (affectedCount > limit) {
        throw new Error(`Update would affect ${affectedCount} rows, which exceeds the safety limit of ${limit}. Consider using a more specific WHERE clause or increase the limit parameter.`)
      }
      
      // Build the SET clause
      const setClause = dataColumns.map(col => {
        const value = data[col]
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
        
        return `"${col}" = ${sqlValue}`
      }).join(', ')
      
      const returningClause = returning ? ' RETURNING *' : ''
      
      const updateSql = `
        UPDATE "${safeSchema}"."${safeTable}"
        SET ${setClause}
        WHERE ${where}${returningClause}
      `
      
      // Execute the update
      const result = await executeQuery(updateSql)
      
      return {
        success: true,
        data: {
          schema: safeSchema,
          table: safeTable,
          updated: result.result || [],
          rowCount: result.result?.length || 0,
          query: updateSql,
          whereClause: where,
          columns: dataColumns,
          summary: {
            operation: 'UPDATE',
            rowsAffected: result.result?.length || 0,
            rowsChecked: affectedCount,
            returningData: returning,
            safetyLimit: limit
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to update table row:', error)
      
      // Provide more specific error messages
      let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      if (errorMessage.includes('foreign key')) {
        errorMessage = 'Update failed: Foreign key constraint violation. Check that referenced records exist.'
      } else if (errorMessage.includes('not null')) {
        errorMessage = 'Update failed: Cannot set required field to null. Check that all non-nullable columns have values.'
      } else if (errorMessage.includes('invalid input syntax')) {
        errorMessage = 'Update failed: Invalid data format. Check that data types match column requirements.'
      } else if (errorMessage.includes('check constraint')) {
        errorMessage = 'Update failed: Check constraint violation. The new values do not meet table constraints.'
      }
      
      return {
        success: false,
        error: errorMessage,
        table: `${schema}.${table}`,
        data: args.data,
        where: args.where,
        query: 'Failed to construct UPDATE query'
      }
    }
  }
}