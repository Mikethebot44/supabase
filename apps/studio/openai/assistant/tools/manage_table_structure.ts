import { z } from 'zod'

export const tool = {
  name: 'manage_table_structure',
  description: 'Create new tables or modify existing table structure by adding/dropping columns, indexes, and constraints. Comprehensive table schema management.',
  parameters: z.object({
    schema: z.string().describe('Schema name (e.g., "public", "auth")').default('public'),
    action: z.enum(['create_table', 'add_column', 'drop_column', 'modify_column', 'add_index', 'drop_index', 'add_constraint', 'drop_constraint']).describe('Action to perform on the table structure'),
    table: z.string().describe('Table name to create or modify'),
    
    // For create_table action
    columns: z.array(z.object({
      name: z.string().describe('Column name'),
      type: z.string().describe('PostgreSQL data type (e.g., "varchar(255)", "integer", "timestamp", "jsonb")'),
      nullable: z.boolean().optional().describe('Whether column allows NULL values').default(true),
      default: z.string().optional().describe('Default value expression'),
      primaryKey: z.boolean().optional().describe('Whether this column is part of primary key').default(false),
      unique: z.boolean().optional().describe('Whether this column has unique constraint').default(false)
    })).optional().describe('Columns definition for create_table action'),
    
    // For column operations
    columnName: z.string().optional().describe('Column name for add/drop/modify operations'),
    columnType: z.string().optional().describe('Data type for new or modified column'),
    columnDefault: z.string().optional().describe('Default value for new or modified column'),
    columnNullable: z.boolean().optional().describe('Whether column allows nulls'),
    
    // For index operations
    indexName: z.string().optional().describe('Index name for index operations'),
    indexColumns: z.array(z.string()).optional().describe('Columns to include in index'),
    indexType: z.enum(['btree', 'hash', 'gin', 'gist']).optional().describe('Type of index').default('btree'),
    unique: z.boolean().optional().describe('Whether index should be unique').default(false),
    
    // For constraint operations
    constraintName: z.string().optional().describe('Constraint name'),
    constraintType: z.enum(['primary_key', 'foreign_key', 'unique', 'check']).optional().describe('Type of constraint'),
    constraintDefinition: z.string().optional().describe('Full constraint definition SQL'),
    
    // General options
    ifNotExists: z.boolean().optional().describe('Use IF NOT EXISTS for create operations').default(true),
    cascade: z.boolean().optional().describe('Use CASCADE for drop operations').default(false)
  }),
  execute: async (args: {
    schema?: string
    action: 'create_table' | 'add_column' | 'drop_column' | 'modify_column' | 'add_index' | 'drop_index' | 'add_constraint' | 'drop_constraint'
    table: string
    columns?: Array<{
      name: string
      type: string
      nullable?: boolean
      default?: string
      primaryKey?: boolean
      unique?: boolean
    }>
    columnName?: string
    columnType?: string
    columnDefault?: string
    columnNullable?: boolean
    indexName?: string
    indexColumns?: string[]
    indexType?: 'btree' | 'hash' | 'gin' | 'gist'
    unique?: boolean
    constraintName?: string
    constraintType?: 'primary_key' | 'foreign_key' | 'unique' | 'check'
    constraintDefinition?: string
    ifNotExists?: boolean
    cascade?: boolean
  }, context: {
    projectRef: string
    connectionString: string
    headers?: Record<string, string>
  }) => {
    const { 
      schema = 'public', 
      action,
      table,
      columns,
      columnName,
      columnType,
      columnDefault,
      columnNullable = true,
      indexName,
      indexColumns,
      indexType = 'btree',
      unique = false,
      constraintName,
      constraintType,
      constraintDefinition,
      ifNotExists = true,
      cascade = false
    } = args
    const { projectRef, connectionString, headers } = context
    
    try {
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
      
      let sql = ''
      let description = ''
      
      switch (action) {
        case 'create_table': {
          if (!columns || columns.length === 0) {
            throw new Error('Columns array is required for create_table action')
          }
          
          let columnDefs = columns.map(col => {
            let colDef = `"${col.name}" ${col.type}`
            
            if (!col.nullable) {
              colDef += ' NOT NULL'
            }
            
            if (col.default) {
              colDef += ` DEFAULT ${col.default}`
            }
            
            if (col.unique) {
              colDef += ' UNIQUE'
            }
            
            return colDef
          }).join(',\n  ')
          
          // Add primary key constraint if any columns are marked as primary key
          const pkColumns = columns.filter(col => col.primaryKey).map(col => `"${col.name}"`).join(', ')
          if (pkColumns) {
            columnDefs += `,\n  PRIMARY KEY (${pkColumns})`
          }
          
          const ifNotExistsClause = ifNotExists ? 'IF NOT EXISTS ' : ''
          sql = `CREATE TABLE ${ifNotExistsClause}"${safeSchema}"."${safeTable}" (\n  ${columnDefs}\n)`
          description = `Create table ${safeSchema}.${safeTable} with ${columns.length} columns`
          break
        }
        
        case 'add_column': {
          if (!columnName || !columnType) {
            throw new Error('columnName and columnType are required for add_column action')
          }
          
          let colDef = `"${columnName}" ${columnType}`
          
          if (!columnNullable) {
            colDef += ' NOT NULL'
          }
          
          if (columnDefault) {
            colDef += ` DEFAULT ${columnDefault}`
          }
          
          sql = `ALTER TABLE "${safeSchema}"."${safeTable}" ADD COLUMN ${colDef}`
          description = `Add column ${columnName} to ${safeSchema}.${safeTable}`
          break
        }
        
        case 'drop_column': {
          if (!columnName) {
            throw new Error('columnName is required for drop_column action')
          }
          
          const cascadeClause = cascade ? ' CASCADE' : ''
          sql = `ALTER TABLE "${safeSchema}"."${safeTable}" DROP COLUMN "${columnName}"${cascadeClause}`
          description = `Drop column ${columnName} from ${safeSchema}.${safeTable}`
          break
        }
        
        case 'modify_column': {
          if (!columnName) {
            throw new Error('columnName is required for modify_column action')
          }
          
          const alterations = []
          
          if (columnType) {
            alterations.push(`ALTER COLUMN "${columnName}" TYPE ${columnType}`)
          }
          
          if (columnNullable !== undefined) {
            alterations.push(`ALTER COLUMN "${columnName}" ${columnNullable ? 'DROP NOT NULL' : 'SET NOT NULL'}`)
          }
          
          if (columnDefault !== undefined) {
            if (columnDefault) {
              alterations.push(`ALTER COLUMN "${columnName}" SET DEFAULT ${columnDefault}`)
            } else {
              alterations.push(`ALTER COLUMN "${columnName}" DROP DEFAULT`)
            }
          }
          
          if (alterations.length === 0) {
            throw new Error('At least one column property (type, nullable, default) must be specified for modify_column action')
          }
          
          sql = `ALTER TABLE "${safeSchema}"."${safeTable}" ${alterations.join(', ')}`
          description = `Modify column ${columnName} in ${safeSchema}.${safeTable}`
          break
        }
        
        case 'add_index': {
          if (!indexName || !indexColumns || indexColumns.length === 0) {
            throw new Error('indexName and indexColumns are required for add_index action')
          }
          
          const uniqueClause = unique ? 'UNIQUE ' : ''
          const columns = indexColumns.map(col => `"${col}"`).join(', ')
          const usingClause = indexType !== 'btree' ? ` USING ${indexType.toUpperCase()}` : ''
          
          sql = `CREATE ${uniqueClause}INDEX "${indexName}" ON "${safeSchema}"."${safeTable}"${usingClause} (${columns})`
          description = `Create ${unique ? 'unique ' : ''}index ${indexName} on ${safeSchema}.${safeTable}`
          break
        }
        
        case 'drop_index': {
          if (!indexName) {
            throw new Error('indexName is required for drop_index action')
          }
          
          const cascadeClause = cascade ? ' CASCADE' : ''
          sql = `DROP INDEX "${safeSchema}"."${indexName}"${cascadeClause}`
          description = `Drop index ${indexName} from ${safeSchema}`
          break
        }
        
        case 'add_constraint': {
          if (!constraintName || !constraintDefinition) {
            throw new Error('constraintName and constraintDefinition are required for add_constraint action')
          }
          
          sql = `ALTER TABLE "${safeSchema}"."${safeTable}" ADD CONSTRAINT "${constraintName}" ${constraintDefinition}`
          description = `Add constraint ${constraintName} to ${safeSchema}.${safeTable}`
          break
        }
        
        case 'drop_constraint': {
          if (!constraintName) {
            throw new Error('constraintName is required for drop_constraint action')
          }
          
          const cascadeClause = cascade ? ' CASCADE' : ''
          sql = `ALTER TABLE "${safeSchema}"."${safeTable}" DROP CONSTRAINT "${constraintName}"${cascadeClause}`
          description = `Drop constraint ${constraintName} from ${safeSchema}.${safeTable}`
          break
        }
        
        default: {
          throw new Error(`Unknown action: ${action}`)
        }
      }
      
      // Execute the DDL statement
      const result = await executeQuery(sql)
      
      return {
        success: true,
        data: {
          schema: safeSchema,
          table: safeTable,
          action: action,
          description: description,
          query: sql,
          result: result.result,
          summary: {
            operation: 'DDL',
            action: action,
            table: `${safeSchema}.${safeTable}`,
            executed: true
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to manage table structure:', error)
      
      // Provide more specific error messages
      let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      if (errorMessage.includes('already exists')) {
        errorMessage = 'Operation failed: Object already exists. Use ifNotExists=false to override or choose a different name.'
      } else if (errorMessage.includes('does not exist')) {
        errorMessage = 'Operation failed: Target object does not exist. Check the table/column/index/constraint name.'
      } else if (errorMessage.includes('cannot drop')) {
        errorMessage = 'Operation failed: Cannot drop object due to dependencies. Use cascade=true to force removal with dependencies.'
      } else if (errorMessage.includes('invalid data type')) {
        errorMessage = 'Operation failed: Invalid data type specified. Check PostgreSQL documentation for valid types.'
      } else if (errorMessage.includes('violates foreign key')) {
        errorMessage = 'Operation failed: Foreign key constraint violation. Check referential integrity.'
      }
      
      return {
        success: false,
        error: errorMessage,
        table: `${args.schema || 'public'}.${args.table}`,
        action: args.action,
        query: 'Failed to construct DDL statement'
      }
    }
  }
}