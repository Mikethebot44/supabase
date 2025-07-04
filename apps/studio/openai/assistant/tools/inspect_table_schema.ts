import { z } from 'zod'

export const tool = {
  name: 'inspect_table_schema',
  description: 'Get comprehensive schema information for a table including columns, constraints, indexes, policies, and relationships. This provides the AI with complete table structure understanding.',
  parameters: z.object({
    schema: z.string().describe('Schema name (e.g., "public", "auth")').default('public'),
    table: z.string().describe('Table name to inspect'),
    includeIndexes: z.boolean().optional().describe('Include index information').default(true),
    includePolicies: z.boolean().optional().describe('Include RLS policy information').default(true),
    includeConstraints: z.boolean().optional().describe('Include constraint information').default(true),
    includeRelationships: z.boolean().optional().describe('Include foreign key relationships').default(true),
    includeStats: z.boolean().optional().describe('Include table statistics (row count, size)').default(false)
  }),
  execute: async (args: {
    schema?: string
    table: string
    includeIndexes?: boolean
    includePolicies?: boolean
    includeConstraints?: boolean
    includeRelationships?: boolean
    includeStats?: boolean
  }, context: {
    projectRef: string
    connectionString: string
    headers?: Record<string, string>
  }) => {
    const { 
      schema = 'public', 
      table, 
      includeIndexes = true,
      includePolicies = true,
      includeConstraints = true,
      includeRelationships = true,
      includeStats = false
    } = args
    const { projectRef, connectionString, headers } = context
    
    try {
      // Sanitize inputs
      const safeSchema = schema.replace(/[^a-zA-Z0-9_]/g, '')
      const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '')
      
      if (safeSchema !== schema || safeTable !== table) {
        throw new Error('Schema and table names can only contain letters, numbers, and underscores')
      }
      
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
      
      // 1. Get basic table information and columns
      const tableInfoSql = `
        SELECT 
          t.table_name,
          t.table_schema,
          t.table_type,
          obj_description(c.oid) as table_comment
        FROM information_schema.tables t
        LEFT JOIN pg_class c ON c.relname = t.table_name
        LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
        WHERE t.table_schema = $1 AND t.table_name = $2
      `
      
      // Get column information
      const columnsSql = `
        SELECT 
          c.column_name,
          c.data_type,
          c.character_maximum_length,
          c.numeric_precision,
          c.numeric_scale,
          c.is_nullable,
          c.column_default,
          c.ordinal_position,
          col_description(pgc.oid, c.ordinal_position) as column_comment,
          c.udt_name,
          CASE 
            WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name
            ELSE c.data_type
          END as full_data_type
        FROM information_schema.columns c
        LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
        LEFT JOIN pg_namespace pgn ON pgn.oid = pgc.relnamespace AND pgn.nspname = c.table_schema
        WHERE c.table_schema = '${safeSchema}' AND c.table_name = '${safeTable}'
        ORDER BY c.ordinal_position
      `
      
      const [tableResult, columnsResult] = await Promise.all([
        executeQuery(tableInfoSql.replace('$1', `'${safeSchema}'`).replace('$2', `'${safeTable}'`)),
        executeQuery(columnsSql)
      ])
      
      if (!tableResult.result || tableResult.result.length === 0) {
        throw new Error(`Table "${safeSchema}"."${safeTable}" not found`)
      }
      
      const tableInfo = tableResult.result[0]
      const columns = columnsResult.result || []
      
      // Prepare response object
      const response: any = {
        success: true,
        table: {
          schema: safeSchema,
          name: safeTable,
          type: tableInfo.table_type,
          comment: tableInfo.table_comment,
          columns: columns.map((col: any) => ({
            name: col.column_name,
            type: col.full_data_type,
            nullable: col.is_nullable === 'YES',
            default: col.column_default,
            maxLength: col.character_maximum_length,
            precision: col.numeric_precision,
            scale: col.numeric_scale,
            position: col.ordinal_position,
            comment: col.column_comment
          }))
        }
      }
      
      // 2. Get constraints if requested
      if (includeConstraints) {
        const constraintsSql = `
          SELECT 
            tc.constraint_name,
            tc.constraint_type,
            kcu.column_name,
            tc.is_deferrable,
            tc.initially_deferred,
            rc.match_option,
            rc.update_rule,
            rc.delete_rule,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints tc
          LEFT JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name 
            AND tc.table_schema = kcu.table_schema
          LEFT JOIN information_schema.referential_constraints rc 
            ON tc.constraint_name = rc.constraint_name 
            AND tc.table_schema = rc.constraint_schema
          LEFT JOIN information_schema.constraint_column_usage ccu 
            ON rc.unique_constraint_name = ccu.constraint_name 
            AND rc.unique_constraint_schema = ccu.constraint_schema
          WHERE tc.table_schema = '${safeSchema}' AND tc.table_name = '${safeTable}'
          ORDER BY tc.constraint_type, tc.constraint_name
        `
        
        const constraintsResult = await executeQuery(constraintsSql)
        response.table.constraints = constraintsResult.result || []
      }
      
      // 3. Get indexes if requested
      if (includeIndexes) {
        const indexesSql = `
          SELECT 
            i.indexname as index_name,
            i.indexdef as index_definition,
            i.tablespace,
            pg_size_pretty(pg_relation_size(pi.indexrelid)) as index_size
          FROM pg_indexes i
          LEFT JOIN pg_class pc ON pc.relname = i.indexname
          LEFT JOIN pg_index pi ON pi.indexrelid = pc.oid
          WHERE i.schemaname = '${safeSchema}' AND i.tablename = '${safeTable}'
          ORDER BY i.indexname
        `
        
        const indexesResult = await executeQuery(indexesSql)
        response.table.indexes = indexesResult.result || []
      }
      
      // 4. Get RLS policies if requested
      if (includePolicies) {
        const policiesSql = `
          SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
          FROM pg_policies 
          WHERE schemaname = '${safeSchema}' AND tablename = '${safeTable}'
          ORDER BY policyname
        `
        
        const policiesResult = await executeQuery(policiesSql)
        response.table.policies = policiesResult.result || []
        
        // Also check if RLS is enabled
        const rlsStatusSql = `
          SELECT 
            relname as table_name,
            relrowsecurity as rls_enabled,
            relforcerowsecurity as rls_forced
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = '${safeSchema}' AND c.relname = '${safeTable}'
        `
        
        const rlsResult = await executeQuery(rlsStatusSql)
        if (rlsResult.result && rlsResult.result.length > 0) {
          response.table.rls_enabled = rlsResult.result[0].rls_enabled
          response.table.rls_forced = rlsResult.result[0].rls_forced
        }
      }
      
      // 5. Get relationships if requested
      if (includeRelationships) {
        // Foreign keys pointing FROM this table
        const outgoingFkSql = `
          SELECT 
            kcu.column_name as local_column,
            ccu.table_schema as foreign_schema,
            ccu.table_name as foreign_table,
            ccu.column_name as foreign_column,
            tc.constraint_name,
            rc.update_rule,
            rc.delete_rule
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu 
            ON tc.constraint_name = ccu.constraint_name
          JOIN information_schema.referential_constraints rc 
            ON tc.constraint_name = rc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_schema = '${safeSchema}' 
            AND tc.table_name = '${safeTable}'
        `
        
        // Foreign keys pointing TO this table
        const incomingFkSql = `
          SELECT 
            tc.table_schema as referencing_schema,
            tc.table_name as referencing_table,
            kcu.column_name as referencing_column,
            ccu.column_name as local_column,
            tc.constraint_name,
            rc.update_rule,
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
        
        const [outgoingResult, incomingResult] = await Promise.all([
          executeQuery(outgoingFkSql),
          executeQuery(incomingFkSql)
        ])
        
        response.table.relationships = {
          outgoing: outgoingResult.result || [],
          incoming: incomingResult.result || []
        }
      }
      
      // 6. Get table statistics if requested
      if (includeStats) {
        const statsSql = `
          SELECT 
            schemaname,
            tablename,
            attname as column_name,
            n_distinct,
            correlation,
            null_frac,
            avg_width
          FROM pg_stats 
          WHERE schemaname = '${safeSchema}' AND tablename = '${safeTable}'
        `
        
        const tableSizeSql = `
          SELECT 
            pg_size_pretty(pg_total_relation_size('${safeSchema}.${safeTable}')) as table_size,
            pg_size_pretty(pg_relation_size('${safeSchema}.${safeTable}')) as table_size_without_indexes,
            (SELECT COUNT(*) FROM "${safeSchema}"."${safeTable}") as estimated_row_count
        `
        
        const [statsResult, sizeResult] = await Promise.all([
          executeQuery(statsSql),
          executeQuery(tableSizeSql)
        ])
        
        response.table.statistics = {
          size_info: sizeResult.result?.[0] || {},
          column_stats: statsResult.result || []
        }
      }
      
      return response
      
    } catch (error) {
      console.error('Failed to inspect table schema:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        table: `${schema}.${table}`
      }
    }
  }
}