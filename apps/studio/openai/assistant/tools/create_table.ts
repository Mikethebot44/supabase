import { z } from 'zod'
import { executeSql } from 'data/sql/execute-sql-query'
import { IS_PLATFORM } from 'common'
import { queryPgMetaSelfHosted } from 'lib/self-hosted'

export const tool = {
  name: 'create_table',
  description: 'Create a new table with specified columns and constraints.',
  parameters: z.object({
    name: z.string().describe('The table name to create'),
    columns: z.array(z.object({
      name: z.string().describe('Column name'),
      type: z.string().describe('PostgreSQL data type (e.g., text, integer, boolean, uuid, timestamp)'),
      nullable: z.boolean().optional().describe('Whether the column can be null (default: true)'),
      defaultValue: z.string().optional().describe('Default value for the column'),
      primaryKey: z.boolean().optional().describe('Whether this column is a primary key'),
      unique: z.boolean().optional().describe('Whether this column should be unique')
    })).describe('Array of column definitions'),
    schema: z.string().optional().describe('The schema name (defaults to "public")'),
    enableRls: z.boolean().optional().describe('Whether to enable Row Level Security (default: true)')
  }),
  execute: async (args: {
    name: string
    columns: Array<{
      name: string
      type: string
      nullable?: boolean
      defaultValue?: string
      primaryKey?: boolean
      unique?: boolean
    }>
    schema?: string
    enableRls?: boolean
  }, context: {
    projectRef: string
    connectionString: string
    headers?: Record<string, string>
  }) => {
    const { name, columns, schema = 'public', enableRls = true } = args
    const { projectRef, connectionString, headers } = context
    
    try {
      // Validate table name (prevent SQL injection)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error('Invalid table name. Use only letters, numbers, and underscores, starting with a letter or underscore.')
      }
      
      // Validate column names
      for (const column of columns) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column.name)) {
          throw new Error(`Invalid column name "${column.name}". Use only letters, numbers, and underscores, starting with a letter or underscore.`)
        }
      }
      
      // Build column definitions
      const columnDefs = columns.map(column => {
        let def = `"${column.name}" ${column.type}`
        
        if (column.nullable === false) {
          def += ' NOT NULL'
        }
        
        if (column.defaultValue) {
          def += ` DEFAULT ${column.defaultValue}`
        }
        
        if (column.primaryKey) {
          def += ' PRIMARY KEY'
        }
        
        if (column.unique && !column.primaryKey) {
          def += ' UNIQUE'
        }
        
        return def
      }).join(',\n  ')
      
      // Create the table
      const createTableSql = `
        CREATE TABLE "${schema}"."${name}" (
          ${columnDefs}
        );
      `
      
      const result = await executeSql(
        {
          projectRef,
          connectionString,
          sql: createTableSql,
        },
        undefined,
        headers || {},
        IS_PLATFORM ? undefined : queryPgMetaSelfHosted
      )
      
      // Enable RLS if requested
      let rlsResult = null
      if (enableRls) {
        const rlsSql = `ALTER TABLE "${schema}"."${name}" ENABLE ROW LEVEL SECURITY;`
        rlsResult = await executeSql(
          {
            projectRef,
            connectionString,
            sql: rlsSql,
          },
          undefined,
          headers || {},
          IS_PLATFORM ? undefined : queryPgMetaSelfHosted
        )
      }
      
      return {
        success: true,
        message: `Table "${schema}.${name}" created successfully`,
        tableName: `${schema}.${name}`,
        columnsCreated: columns.length,
        rlsEnabled: enableRls,
        sql: createTableSql.trim()
      }
    } catch (error) {
      console.error('Failed to create table:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
} 