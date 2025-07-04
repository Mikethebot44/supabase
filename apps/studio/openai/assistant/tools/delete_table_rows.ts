import { z } from 'zod'

export const tool = {
  name: 'delete_table_rows',
  description: 'Delete rows from a database table with WHERE conditions. Includes safety checks to prevent accidental mass deletions.',
  parameters: z.object({
    schema: z.string().describe('Schema name (e.g., "public", "auth")').default('public'),
    table: z.string().describe('Table name to delete data from'),
    where: z.string().describe('WHERE clause to specify which rows to delete (e.g., "id = 123" or "status = \'inactive\'")'),
    returning: z.boolean().optional().describe('Whether to return the deleted row data').default(false),
    limit: z.number().optional().describe('Maximum number of rows to delete (safety limit)').default(1000),
    confirmMassDelete: z.boolean().optional().describe('Required confirmation for operations affecting more than 100 rows').default(false)
  }),
  execute: async (args: {
    schema?: string
    table: string
    where: string
    returning?: boolean
    limit?: number
    confirmMassDelete?: boolean
  }, context: {
    projectRef: string
    connectionString: string
    headers?: Record<string, string>
  }) => {
    const { 
      schema = 'public', 
      table, 
      where,
      returning = false,
      limit = 1000,
      confirmMassDelete = false
    } = args
    const { projectRef, connectionString, headers } = context
    
    try {
      // Validate inputs
      if (!where || where.trim() === '') {
        throw new Error('WHERE clause is required for DELETE operations to prevent accidental mass deletions. Use "1=1" to delete all rows if intended.')
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
      
      const executeQuery = async (sql: string) => {
        return await executeSql(
          { projectRef, connectionString, sql },
          undefined,
          headers || {},
          IS_PLATFORM ? undefined : queryPgMetaSelfHosted
        )
      }
      
      // First, check how many rows would be affected
      const countQuery = `SELECT COUNT(*) as affected_count FROM "${safeSchema}"."${safeTable}" WHERE ${where}`
      const countResult = await executeQuery(countQuery)
      const affectedCount = countResult.result?.[0]?.affected_count || 0
      
      if (affectedCount === 0) {
        return {
          success: true,
          data: {
            schema: safeSchema,
            table: safeTable,
            deleted: [],
            rowCount: 0,
            query: countQuery,
            whereClause: where,
            summary: {
              operation: 'DELETE',
              rowsAffected: 0,
              rowsChecked: 0,
              returningData: returning,
              safetyLimit: limit,
              message: 'No rows matched the WHERE condition'
            }
          }
        }
      }
      
      if (affectedCount > limit) {
        throw new Error(`Delete would affect ${affectedCount} rows, which exceeds the safety limit of ${limit}. Consider using a more specific WHERE clause or increase the limit parameter.`)
      }
      
      // Check for mass delete confirmation
      if (affectedCount > 100 && !confirmMassDelete) {
        throw new Error(`Delete would affect ${affectedCount} rows (>100). This requires confirmation. Set confirmMassDelete=true to proceed with this mass deletion.`)
      }
      
      // Check if table has foreign key dependencies
      const dependencyQuery = `
        SELECT DISTINCT
          tc.table_schema as referencing_schema,
          tc.table_name as referencing_table,
          kcu.column_name as referencing_column,
          rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
          ON tc.constraint_name = ccu.constraint_name
        JOIN information_schema.referential_constraints rc 
          ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_schema = '${safeSchema}' 
          AND ccu.table_name = '${safeTable}'
      `
      
      const dependencyResult = await executeQuery(dependencyQuery)
      const dependencies = dependencyResult.result || []
      
      // Warn about foreign key dependencies
      const restrictDependencies = dependencies.filter((dep: any) => dep.delete_rule === 'RESTRICT')
      if (restrictDependencies.length > 0) {
        const depList = restrictDependencies.map((dep: any) => 
          `${dep.referencing_schema}.${dep.referencing_table}.${dep.referencing_column}`
        ).join(', ')
        console.warn(`Warning: This table has RESTRICT foreign key dependencies in: ${depList}`)
      }
      
      const returningClause = returning ? ' RETURNING *' : ''
      
      const deleteSql = `
        DELETE FROM "${safeSchema}"."${safeTable}"
        WHERE ${where}${returningClause}
      `
      
      // Execute the delete
      const result = await executeQuery(deleteSql)
      
      return {
        success: true,
        data: {
          schema: safeSchema,
          table: safeTable,
          deleted: result.result || [],
          rowCount: result.result?.length || affectedCount,
          query: deleteSql,
          whereClause: where,
          dependencies: dependencies.length > 0 ? dependencies : undefined,
          summary: {
            operation: 'DELETE',
            rowsAffected: result.result?.length || affectedCount,
            rowsChecked: affectedCount,
            returningData: returning,
            safetyLimit: limit,
            hasDependencies: dependencies.length > 0,
            massDeleteConfirmed: confirmMassDelete && affectedCount > 100
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to delete table rows:', error)
      
      // Provide more specific error messages
      let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      if (errorMessage.includes('foreign key')) {
        errorMessage = 'Delete failed: Foreign key constraint violation. Other records still reference these rows. Delete or update the referencing records first, or use CASCADE delete rule.'
      } else if (errorMessage.includes('violates check constraint')) {
        errorMessage = 'Delete failed: Check constraint violation during cascading delete.'
      } else if (errorMessage.includes('syntax error')) {
        errorMessage = 'Delete failed: Invalid WHERE clause syntax. Check your condition format.'
      }
      
      return {
        success: false,
        error: errorMessage,
        table: `${schema}.${table}`,
        where: args.where,
        query: 'Failed to construct DELETE query'
      }
    }
  }
}