import { z } from 'zod'

export const tool = {
  name: 'manage_rls_policies',
  description: 'Comprehensive Row Level Security (RLS) policy management. Create, update, delete, and manage RLS policies for database tables with templates and validation.',
  parameters: z.object({
    schema: z.string().describe('Schema name (e.g., "public", "auth")').default('public'),
    action: z.enum(['create_policy', 'update_policy', 'delete_policy', 'enable_rls', 'disable_rls', 'list_policies', 'get_policy_templates']).describe('Action to perform on RLS policies'),
    table: z.string().optional().describe('Table name for policy operations'),
    
    // For policy CRUD operations
    policyName: z.string().optional().describe('Name of the policy (required for create/update/delete)'),
    command: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL']).optional().describe('SQL command the policy applies to').default('ALL'),
    roles: z.array(z.string()).optional().describe('Database roles the policy applies to (empty array = all roles)').default([]),
    definition: z.string().optional().describe('USING clause - condition for policy (e.g., "auth.uid() = user_id")'),
    check: z.string().optional().describe('WITH CHECK clause - condition for INSERT/UPDATE operations'),
    action: z.enum(['PERMISSIVE', 'RESTRICTIVE']).optional().describe('Policy action type').default('PERMISSIVE'),
    
    // Template and utility options
    template: z.enum(['user_based', 'role_based', 'team_based', 'public_read', 'owner_only', 'custom']).optional().describe('Use predefined policy template'),
    templateParams: z.record(z.string()).optional().describe('Parameters for template (e.g., {"user_column": "user_id", "role_column": "role"})'),
    
    // Update specific options
    newPolicyName: z.string().optional().describe('New policy name for update operations'),
    
    // General options
    force: z.boolean().optional().describe('Force operation even if potentially destructive').default(false)
  }),
  execute: async (args: {
    schema?: string
    action: 'create_policy' | 'update_policy' | 'delete_policy' | 'enable_rls' | 'disable_rls' | 'list_policies' | 'get_policy_templates'
    table?: string
    policyName?: string
    command?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL'
    roles?: string[]
    definition?: string
    check?: string
    action?: 'PERMISSIVE' | 'RESTRICTIVE'
    template?: 'user_based' | 'role_based' | 'team_based' | 'public_read' | 'owner_only' | 'custom'
    templateParams?: Record<string, string>
    newPolicyName?: string
    force?: boolean
  }, context: {
    projectRef: string
    connectionString: string
    headers?: Record<string, string>
  }) => {
    const { 
      schema = 'public', 
      action,
      table,
      policyName,
      command = 'ALL',
      roles = [],
      definition,
      check,
      action: policyAction = 'PERMISSIVE',
      template,
      templateParams = {},
      newPolicyName,
      force = false
    } = args
    const { projectRef, connectionString, headers } = context
    
    try {
      // Sanitize schema and table names
      const safeSchema = schema.replace(/[^a-zA-Z0-9_]/g, '')
      let safeTable = ''
      if (table) {
        safeTable = table.replace(/[^a-zA-Z0-9_]/g, '')
        if (safeTable !== table) {
          throw new Error('Table name can only contain letters, numbers, and underscores')
        }
      }
      
      if (safeSchema !== schema) {
        throw new Error('Schema name can only contain letters, numbers, and underscores')
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
      
      // Handle different actions
      switch (action) {
        case 'get_policy_templates': {
          const templates = {
            user_based: {
              name: 'User-based Access',
              description: 'Users can only access their own records',
              example: 'auth.uid() = user_id',
              params: ['user_column'],
              definition: (params: Record<string, string>) => 
                `auth.uid() = ${params.user_column || 'user_id'}`
            },
            role_based: {
              name: 'Role-based Access',
              description: 'Access based on user roles',
              example: "auth.jwt()->>'role' = 'admin'",
              params: ['role_value'],
              definition: (params: Record<string, string>) => 
                `auth.jwt()->>'role' = '${params.role_value || 'admin'}'`
            },
            team_based: {
              name: 'Team-based Access',
              description: 'Users can access records from their team',
              example: 'team_id IN (SELECT team_id FROM user_teams WHERE user_id = auth.uid())',
              params: ['team_column', 'user_teams_table'],
              definition: (params: Record<string, string>) => 
                `${params.team_column || 'team_id'} IN (SELECT team_id FROM ${params.user_teams_table || 'user_teams'} WHERE user_id = auth.uid())`
            },
            public_read: {
              name: 'Public Read Access',
              description: 'Anyone can read, only authenticated users can modify',
              example: 'true (for SELECT), auth.uid() IS NOT NULL (for others)',
              params: [],
              definition: (params: Record<string, string>) => 'true',
              checkDefinition: (params: Record<string, string>) => 'auth.uid() IS NOT NULL'
            },
            owner_only: {
              name: 'Owner Only Access',
              description: 'Only the record owner can access',
              example: 'auth.uid() = owner_id',
              params: ['owner_column'],
              definition: (params: Record<string, string>) => 
                `auth.uid() = ${params.owner_column || 'owner_id'}`
            }
          }
          
          return {
            success: true,
            data: {
              templates: templates,
              usage: 'Use the template parameter with templateParams to create policies from templates'
            }
          }
        }
        
        case 'list_policies': {
          const listSql = table 
            ? `SELECT * FROM pg_policies WHERE schemaname = '${safeSchema}' AND tablename = '${safeTable}' ORDER BY policyname`
            : `SELECT * FROM pg_policies WHERE schemaname = '${safeSchema}' ORDER BY tablename, policyname`
          
          const result = await executeQuery(listSql)
          
          // Also get RLS status for tables
          const rlsStatusSql = table
            ? `SELECT relname as table_name, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = '${safeSchema}' AND c.relname = '${safeTable}'`
            : `SELECT relname as table_name, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = '${safeSchema}' AND c.relkind = 'r'`
          
          const rlsResult = await executeQuery(rlsStatusSql)
          
          return {
            success: true,
            data: {
              schema: safeSchema,
              table: table || 'all',
              policies: result.result || [],
              rlsStatus: rlsResult.result || [],
              summary: {
                policyCount: result.result?.length || 0,
                tablesChecked: rlsResult.result?.length || 0
              }
            }
          }
        }
        
        case 'enable_rls':
        case 'disable_rls': {
          if (!table) {
            throw new Error('Table name is required for RLS enable/disable operations')
          }
          
          const rlsAction = action === 'enable_rls' ? 'ENABLE' : 'DISABLE'
          const sql = `ALTER TABLE "${safeSchema}"."${safeTable}" ${rlsAction} ROW LEVEL SECURITY`
          
          await executeQuery(sql)
          
          return {
            success: true,
            data: {
              schema: safeSchema,
              table: safeTable,
              action: rlsAction,
              query: sql,
              summary: {
                operation: `RLS_${rlsAction}`,
                table: `${safeSchema}.${safeTable}`
              }
            }
          }
        }
        
        case 'create_policy': {
          if (!table || !policyName) {
            throw new Error('Table name and policy name are required for policy creation')
          }
          
          let policyDefinition = definition
          let policyCheck = check
          
          // Apply template if specified
          if (template && template !== 'custom') {
            const templates = {
              user_based: (params: Record<string, string>) => 
                `auth.uid() = ${params.user_column || 'user_id'}`,
              role_based: (params: Record<string, string>) => 
                `auth.jwt()->>'role' = '${params.role_value || 'admin'}'`,
              team_based: (params: Record<string, string>) => 
                `${params.team_column || 'team_id'} IN (SELECT team_id FROM ${params.user_teams_table || 'user_teams'} WHERE user_id = auth.uid())`,
              public_read: (params: Record<string, string>) => 'true',
              owner_only: (params: Record<string, string>) => 
                `auth.uid() = ${params.owner_column || 'owner_id'}`
            }
            
            if (template in templates) {
              policyDefinition = templates[template as keyof typeof templates](templateParams)
              
              if (template === 'public_read' && (command === 'INSERT' || command === 'UPDATE' || command === 'ALL')) {
                policyCheck = 'auth.uid() IS NOT NULL'
              }
            }
          }
          
          if (!policyDefinition) {
            throw new Error('Policy definition is required (either directly or via template)')
          }
          
          // Build roles clause
          const rolesClause = roles.length > 0 ? ` TO ${roles.map(r => `"${r}"`).join(', ')}` : ''
          
          // Build check clause
          const checkClause = policyCheck ? ` WITH CHECK (${policyCheck})` : ''
          
          const sql = `CREATE POLICY "${policyName}" ON "${safeSchema}"."${safeTable}" AS ${policyAction} FOR ${command}${rolesClause} USING (${policyDefinition})${checkClause}`
          
          await executeQuery(sql)
          
          return {
            success: true,
            data: {
              schema: safeSchema,
              table: safeTable,
              policyName: policyName,
              command: command,
              roles: roles,
              definition: policyDefinition,
              check: policyCheck,
              template: template,
              query: sql,
              summary: {
                operation: 'CREATE_POLICY',
                policy: `${safeSchema}.${safeTable}.${policyName}`
              }
            }
          }
        }
        
        case 'update_policy': {
          if (!table || !policyName) {
            throw new Error('Table name and policy name are required for policy updates')
          }
          
          // For PostgreSQL, we need to drop and recreate the policy
          const dropSql = `DROP POLICY "${policyName}" ON "${safeSchema}"."${safeTable}"`
          
          // Get current policy details if not all fields provided
          if (!definition && !newPolicyName) {
            const currentPolicySql = `SELECT * FROM pg_policies WHERE schemaname = '${safeSchema}' AND tablename = '${safeTable}' AND policyname = '${policyName}'`
            const currentResult = await executeQuery(currentPolicySql)
            
            if (!currentResult.result || currentResult.result.length === 0) {
              throw new Error(`Policy "${policyName}" not found`)
            }
          }
          
          await executeQuery(dropSql)
          
          // Recreate with new values
          const finalPolicyName = newPolicyName || policyName
          const rolesClause = roles.length > 0 ? ` TO ${roles.map(r => `"${r}"`).join(', ')}` : ''
          const checkClause = check ? ` WITH CHECK (${check})` : ''
          
          const createSql = `CREATE POLICY "${finalPolicyName}" ON "${safeSchema}"."${safeTable}" AS ${policyAction} FOR ${command}${rolesClause} USING (${definition})${checkClause}`
          
          await executeQuery(createSql)
          
          return {
            success: true,
            data: {
              schema: safeSchema,
              table: safeTable,
              oldPolicyName: policyName,
              newPolicyName: finalPolicyName,
              command: command,
              roles: roles,
              definition: definition,
              check: check,
              queries: [dropSql, createSql],
              summary: {
                operation: 'UPDATE_POLICY',
                policy: `${safeSchema}.${safeTable}.${finalPolicyName}`
              }
            }
          }
        }
        
        case 'delete_policy': {
          if (!table || !policyName) {
            throw new Error('Table name and policy name are required for policy deletion')
          }
          
          // Check if policy exists
          const existsSql = `SELECT 1 FROM pg_policies WHERE schemaname = '${safeSchema}' AND tablename = '${safeTable}' AND policyname = '${policyName}'`
          const existsResult = await executeQuery(existsSql)
          
          if (!existsResult.result || existsResult.result.length === 0) {
            throw new Error(`Policy "${policyName}" not found on table "${safeSchema}"."${safeTable}"`)
          }
          
          const sql = `DROP POLICY "${policyName}" ON "${safeSchema}"."${safeTable}"`
          await executeQuery(sql)
          
          return {
            success: true,
            data: {
              schema: safeSchema,
              table: safeTable,
              policyName: policyName,
              query: sql,
              summary: {
                operation: 'DELETE_POLICY',
                policy: `${safeSchema}.${safeTable}.${policyName}`
              }
            }
          }
        }
        
        default: {
          throw new Error(`Unknown action: ${action}`)
        }
      }
      
    } catch (error) {
      console.error('Failed to manage RLS policies:', error)
      
      // Provide more specific error messages
      let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      if (errorMessage.includes('already exists')) {
        errorMessage = 'Policy creation failed: A policy with this name already exists on the table.'
      } else if (errorMessage.includes('does not exist')) {
        errorMessage = 'Policy operation failed: The specified policy or table does not exist.'
      } else if (errorMessage.includes('permission denied')) {
        errorMessage = 'Policy operation failed: Insufficient permissions to manage RLS policies.'
      } else if (errorMessage.includes('syntax error')) {
        errorMessage = 'Policy operation failed: Invalid policy definition syntax. Check your USING/WITH CHECK expressions.'
      } else if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        errorMessage = 'Policy operation failed: The specified table does not exist.'
      }
      
      return {
        success: false,
        error: errorMessage,
        table: table ? `${schema}.${table}` : undefined,
        policy: policyName,
        action: action
      }
    }
  }
}